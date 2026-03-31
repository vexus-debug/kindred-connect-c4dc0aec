import type { Candle } from '@/types/scanner';
import type { SwingPoint, SmcEvent } from './types';

/** Calculate momentum of a candle or series of candles (0-100) */
function calcMomentum(candles: Candle[], startIdx: number, endIdx: number): number {
  if (startIdx < 0 || endIdx >= candles.length || startIdx >= endIdx) return 50;
  const span = candles.slice(startIdx, endIdx + 1);
  const totalRange = span.reduce((s, c) => s + (c.high - c.low), 0);
  const netMove = Math.abs(candles[endIdx].close - candles[startIdx].open);
  const avgVolume = span.reduce((s, c) => s + c.volume, 0) / span.length;
  const lastVolume = candles[endIdx].volume;
  const volumeRatio = avgVolume > 0 ? lastVolume / avgVolume : 1;
  const efficiency = totalRange > 0 ? netMove / totalRange : 0;
  // Combine efficiency and volume ratio into a 0-100 score
  return Math.min(100, Math.round(efficiency * 50 + Math.min(volumeRatio, 3) * 16.7));
}

/** Detect if a BOS failed (price returned to previous range within N candles) */
function isBosFailure(candles: Candle[], breakIndex: number, breakPrice: number, isBullish: boolean, lookforward: number = 5): boolean {
  const end = Math.min(breakIndex + lookforward, candles.length);
  for (let i = breakIndex + 1; i < end; i++) {
    if (isBullish && candles[i].close < breakPrice) return true;
    if (!isBullish && candles[i].close > breakPrice) return true;
  }
  return false;
}

/** Evaluate CHoCH strength (0-100) based on momentum, candle size, break distance */
function chochStrength(candles: Candle[], breakIndex: number, prevSwingPrice: number, breakPrice: number): number {
  const c = candles[breakIndex];
  const bodySize = Math.abs(c.close - c.open);
  const totalRange = c.high - c.low;
  const bodyRatio = totalRange > 0 ? bodySize / totalRange : 0;
  const breakDistance = Math.abs(breakPrice - prevSwingPrice) / prevSwingPrice * 100;
  const momentum = calcMomentum(candles, Math.max(0, breakIndex - 2), breakIndex);
  // Weight: 40% momentum, 30% body ratio, 30% break distance
  return Math.min(100, Math.round(momentum * 0.4 + bodyRatio * 100 * 0.3 + Math.min(breakDistance * 10, 30)));
}

export function detectBosChoch(candles: Candle[], swings: SwingPoint[]): SmcEvent[] {
  const events: SmcEvent[] = [];
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  const recentThreshold = candles.length - 8;

  // === BOS Detection with momentum & failure ===
  for (let i = 1; i < highs.length; i++) {
    const prevHigh = highs[i - 1];
    for (let j = prevHigh.index + 1; j < candles.length; j++) {
      if (candles[j].close > prevHigh.price) {
        if (j >= recentThreshold) {
          const momentum = calcMomentum(candles, Math.max(0, j - 3), j);
          const failure = isBosFailure(candles, j, prevHigh.price, true);
          const sig = failure ? 'low' : momentum > 60 ? 'high' : 'medium';
          
          if (failure) {
            events.push({
              name: 'Bullish BOS Failure',
              type: 'bearish',
              significance: 'high',
              description: `Price broke above $${prevHigh.price.toPrecision(5)} but failed to hold — potential bear trap`,
              candleIndex: j,
              price: prevHigh.price,
              meta: { momentum, bosFailure: true, isTrap: true },
            });
          } else {
            events.push({
              name: 'Bullish BOS',
              type: 'bullish',
              significance: sig,
              description: `Break above $${prevHigh.price.toPrecision(5)} — momentum ${momentum}/100`,
              candleIndex: j,
              price: prevHigh.price,
              meta: { momentum, bosFailure: false },
            });
          }
        }
        break;
      }
    }
  }

  for (let i = 1; i < lows.length; i++) {
    const prevLow = lows[i - 1];
    for (let j = prevLow.index + 1; j < candles.length; j++) {
      if (candles[j].close < prevLow.price) {
        if (j >= recentThreshold) {
          const momentum = calcMomentum(candles, Math.max(0, j - 3), j);
          const failure = isBosFailure(candles, j, prevLow.price, false);
          const sig = failure ? 'low' : momentum > 60 ? 'high' : 'medium';
          
          if (failure) {
            events.push({
              name: 'Bearish BOS Failure',
              type: 'bullish',
              significance: 'high',
              description: `Price broke below $${prevLow.price.toPrecision(5)} but failed to hold — potential bull trap`,
              candleIndex: j,
              price: prevLow.price,
              meta: { momentum, bosFailure: true, isTrap: true },
            });
          } else {
            events.push({
              name: 'Bearish BOS',
              type: 'bearish',
              significance: sig,
              description: `Break below $${prevLow.price.toPrecision(5)} — momentum ${momentum}/100`,
              candleIndex: j,
              price: prevLow.price,
              meta: { momentum, bosFailure: false },
            });
          }
        }
        break;
      }
    }
  }

  // === CHoCH with strength evaluation ===
  if (highs.length >= 3) {
    const last3 = highs.slice(-3);
    if (last3[1].price < last3[0].price && last3[2].price > last3[1].price) {
      const strength = chochStrength(candles, last3[2].index, last3[1].price, last3[2].price);
      events.push({
        name: 'Bullish CHoCH',
        type: 'bullish',
        significance: strength > 65 ? 'high' : strength > 40 ? 'medium' : 'low',
        description: `Change of character — strength ${strength}/100 — first HH after downtrend`,
        candleIndex: last3[2].index,
        price: last3[2].price,
        meta: { chochStrength: strength },
      });
    }
  }

  if (lows.length >= 3) {
    const last3 = lows.slice(-3);
    if (last3[1].price > last3[0].price && last3[2].price < last3[1].price) {
      const strength = chochStrength(candles, last3[2].index, last3[1].price, last3[2].price);
      events.push({
        name: 'Bearish CHoCH',
        type: 'bearish',
        significance: strength > 65 ? 'high' : strength > 40 ? 'medium' : 'low',
        description: `Change of character — strength ${strength}/100 — first LL after uptrend`,
        candleIndex: last3[2].index,
        price: last3[2].price,
        meta: { chochStrength: strength },
      });
    }
  }

  return events;
}

/** Detect trend continuation: BOS → pullback → BOS */
/**
 * Count REAL failed CHoCH attempts in the current trend.
 *
 * A failed CHoCH is NOT just any minor swing — it requires:
 * 1. An established trend (sequence of HH/HL or LH/LL)
 * 2. A swing that ACTUALLY breaks the previous structural level
 *    (e.g., in an uptrend, price closes below the previous higher-low)
 * 3. But the trend then RESUMES — price makes a new swing in the original
 *    trend direction, invalidating the CHoCH attempt
 * 4. The break must be significant (> 0.3x ATR to filter noise)
 */
export function countFailedChoch(candles: Candle[], swings: SwingPoint[]): number {
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');

  if (highs.length < 3 || lows.length < 3) return 0;

  // Calculate ATR for significance filter
  const atr = calcMinATR(candles);
  if (atr === 0) return 0;

  // Determine current trend direction from the last two swing pairs
  const lastHH = highs[highs.length - 1].price > highs[highs.length - 2].price;
  const lastHL = lows[lows.length - 1].price > lows[lows.length - 2].price;
  const lastLH = highs[highs.length - 1].price < highs[highs.length - 2].price;
  const lastLL = lows[lows.length - 1].price < lows[lows.length - 2].price;

  const isBullTrend = lastHH && lastHL;
  const isBearTrend = lastLH && lastLL;

  if (!isBullTrend && !isBearTrend) return 0;

  let failures = 0;
  const minBreakSize = atr * 0.3; // minimum break size to count as real CHoCH attempt

  if (isBullTrend) {
    // In a bullish trend (HH/HL), a failed CHoCH attempt is:
    // Price breaks BELOW a previous higher-low (actual structure break, not just a wick)
    // but then recovers and makes a new higher-low above the broken level
    for (let i = 1; i < lows.length - 1; i++) {
      const prevLow = lows[i - 1]; // the structural level (previous HL)
      const breakLow = lows[i];    // the potential CHoCH break
      const nextLow = lows[i + 1]; // the recovery

      // Must break below previous structural low significantly
      const breakSize = prevLow.price - breakLow.price;
      if (breakSize < minBreakSize) continue; // Not significant enough

      // Must have a candle that CLOSED below the structural level (not just wicked)
      let hadCloseBelow = false;
      for (let j = breakLow.index - 2; j <= Math.min(breakLow.index + 2, candles.length - 1); j++) {
        if (j >= 0 && j < candles.length && candles[j].close < prevLow.price) {
          hadCloseBelow = true;
          break;
        }
      }
      if (!hadCloseBelow) continue; // Was just a wick — not a real break

      // Recovery: next low must be above the broken level (trend resumed)
      if (nextLow.price > prevLow.price) {
        failures++;
      }
    }
  } else {
    // In a bearish trend (LH/LL), a failed CHoCH attempt is:
    // Price breaks ABOVE a previous lower-high (actual structure break)
    // but then fails and makes a new lower-high below the broken level
    for (let i = 1; i < highs.length - 1; i++) {
      const prevHigh = highs[i - 1]; // the structural level (previous LH)
      const breakHigh = highs[i];     // the potential CHoCH break
      const nextHigh = highs[i + 1]; // the recovery

      const breakSize = breakHigh.price - prevHigh.price;
      if (breakSize < minBreakSize) continue;

      let hadCloseAbove = false;
      for (let j = breakHigh.index - 2; j <= Math.min(breakHigh.index + 2, candles.length - 1); j++) {
        if (j >= 0 && j < candles.length && candles[j].close > prevHigh.price) {
          hadCloseAbove = true;
          break;
        }
      }
      if (!hadCloseAbove) continue;

      if (nextHigh.price < prevHigh.price) {
        failures++;
      }
    }
  }

  return failures;
}

/** Simple ATR calculation for significance filtering */
function calcMinATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    sum += tr;
  }
  return sum / period;
}

export function detectContinuationPatterns(candles: Candle[], swings: SwingPoint[]): SmcEvent[] {
  const events: SmcEvent[] = [];
  const highs = swings.filter(s => s.type === 'high');
  const lows = swings.filter(s => s.type === 'low');
  
  // Bullish continuation: HH → HL → HH
  if (highs.length >= 2 && lows.length >= 1) {
    const h1 = highs[highs.length - 2];
    const h2 = highs[highs.length - 1];
    const pullbackLow = lows.find(l => l.index > h1.index && l.index < h2.index);
    if (h2.price > h1.price && pullbackLow && pullbackLow.price > lows[lows.length - 2]?.price) {
      events.push({
        name: 'Bullish Continuation',
        type: 'bullish',
        significance: 'high',
        description: 'BOS → pullback → BOS confirming bullish trend continuation',
        candleIndex: h2.index,
        price: h2.price,
        meta: { isContinuation: true },
      });
    }
  }

  // Bearish continuation: LL → LH → LL
  if (lows.length >= 2 && highs.length >= 1) {
    const l1 = lows[lows.length - 2];
    const l2 = lows[lows.length - 1];
    const pullbackHigh = highs.find(h => h.index > l1.index && h.index < l2.index);
    if (l2.price < l1.price && pullbackHigh && pullbackHigh.price < highs[highs.length - 2]?.price) {
      events.push({
        name: 'Bearish Continuation',
        type: 'bearish',
        significance: 'high',
        description: 'BOS → pullback → BOS confirming bearish trend continuation',
        candleIndex: l2.index,
        price: l2.price,
        meta: { isContinuation: true },
      });
    }
  }

  return events;
}
