import type { CoinSnapshot, LeaderCoin, LeaderLagSignal, LeaderLagSettings } from '@/types/leader-lag';
import { getSector } from '@/lib/sectors';

/**
 * Compute Pearson correlation between two arrays of returns.
 */
export function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;

  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }

  const denom = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  if (denom === 0) return 0;
  return (n * sumAB - sumA * sumB) / denom;
}

/**
 * Build coin snapshots from ticker data.
 * priceChanges: map of symbol → array of recent % returns (newest first)
 */
export function buildSnapshots(
  tickers: { symbol: string; lastPrice: string; price24hPcnt: string; volume24h: string; turnover24h: string }[],
  priceChanges: Map<string, number>,
  volumeRatios: Map<string, number>,
  momentumScores: Map<string, number>,
): CoinSnapshot[] {
  return tickers
    .filter(t => t.symbol.endsWith('USDT'))
    .map(t => ({
      symbol: t.symbol,
      price: parseFloat(t.lastPrice),
      priceChange: priceChanges.get(t.symbol) ?? parseFloat(t.price24hPcnt) * 100,
      volumeChange: volumeRatios.get(t.symbol) ?? 1,
      volume24h: parseFloat(t.volume24h),
      sector: getSector(t.symbol),
      momentum: momentumScores.get(t.symbol) ?? 0,
    }));
}

/**
 * Detect leader coins from snapshots.
 */
export function detectLeaders(
  snapshots: CoinSnapshot[],
  settings: LeaderLagSettings
): LeaderCoin[] {
  return snapshots
    .filter(s => {
      const absPriceChange = Math.abs(s.priceChange);
      return (
        absPriceChange >= settings.minPriceChange &&
        s.volumeChange >= settings.minVolumeSpikeRatio &&
        (settings.sectorFilter === 'all' || s.sector === settings.sectorFilter) &&
        s.volume24h >= settings.minVolume24h
      );
    })
    .map(s => ({
      ...s,
      detectedAt: Date.now(),
      impulseStrength: computeImpulseStrength(s),
    }))
    .sort((a, b) => b.impulseStrength - a.impulseStrength);
}

function computeImpulseStrength(s: CoinSnapshot): number {
  const priceScore = Math.min(Math.abs(s.priceChange) / 5 * 40, 40);
  const volumeScore = Math.min(s.volumeChange / 3 * 30, 30);
  const momentumScore = s.momentum * 0.3;
  return Math.round(priceScore + volumeScore + momentumScore);
}

/**
 * Find follower opportunities for a leader.
 */
export function findFollowers(
  leader: LeaderCoin,
  allSnapshots: CoinSnapshot[],
  correlationMap: Map<string, Map<string, number>>,
  settings: LeaderLagSettings,
): LeaderLagSignal[] {
  const signals: LeaderLagSignal[] = [];

  for (const follower of allSnapshots) {
    if (follower.symbol === leader.symbol) continue;
    if (Math.abs(follower.priceChange) > settings.maxFollowerChange) continue;
    if (settings.sectorFilter !== 'all' && follower.sector !== settings.sectorFilter) continue;
    if (follower.volume24h < settings.minVolume24h) continue;

    // Check correlation
    const leaderCorr = correlationMap.get(leader.symbol);
    const corr = leaderCorr?.get(follower.symbol) ?? 0;

    // Also boost if same sector
    const sectorBonus = leader.sector === follower.sector ? 0.15 : 0;
    const effectiveCorr = Math.min(corr + sectorBonus, 1);

    if (effectiveCorr < settings.minCorrelation) continue;

    const signalStrength = computeSignalStrength(leader, follower, effectiveCorr);

    signals.push({
      id: `${leader.symbol}-${follower.symbol}-${Date.now()}`,
      leader,
      follower,
      correlation: Math.round(effectiveCorr * 100) / 100,
      signalStrength,
      timestamp: Date.now(),
    });
  }

  return signals.sort((a, b) => b.signalStrength - a.signalStrength);
}

function computeSignalStrength(leader: LeaderCoin, follower: CoinSnapshot, correlation: number): number {
  const impulse = leader.impulseStrength * 0.35;
  const corrScore = correlation * 30;
  const gapScore = Math.min((Math.abs(leader.priceChange) - Math.abs(follower.priceChange)) / 5 * 20, 20);
  const liquidityScore = Math.min(Math.log10(follower.volume24h + 1) / 8 * 15, 15);
  return Math.round(impulse + corrScore + gapScore + liquidityScore);
}

/**
 * Build a simple correlation map from recent price return series.
 * returnSeries: symbol → array of returns
 */
export function buildCorrelationMap(
  returnSeries: Map<string, number[]>,
  symbols: string[]
): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();

  for (const a of symbols) {
    const aReturns = returnSeries.get(a);
    if (!aReturns || aReturns.length < 5) continue;

    const inner = new Map<string, number>();
    for (const b of symbols) {
      if (a === b) continue;
      const bReturns = returnSeries.get(b);
      if (!bReturns || bReturns.length < 5) continue;
      inner.set(b, pearsonCorrelation(aReturns, bReturns));
    }
    map.set(a, inner);
  }

  return map;
}

export function formatLeaderAlert(signal: LeaderLagSignal): string {
  const dir = signal.leader.priceChange > 0 ? '+' : '';
  const fDir = signal.follower.priceChange > 0 ? '+' : '';
  return `Leader Coin Detected: ${signal.leader.symbol.replace('USDT', '')} ${dir}${signal.leader.priceChange.toFixed(1)}%. ${signal.follower.symbol.replace('USDT', '')} ${fDir}${signal.follower.priceChange.toFixed(1)}% — Possible catch-up trade.`;
}
