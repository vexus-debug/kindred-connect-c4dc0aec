import type { CryptoSector } from '@/lib/sectors';

export type LeaderLagTimeframe = '1' | '3' | '5' | '15';

export const LEADER_LAG_TIMEFRAME_LABELS: Record<LeaderLagTimeframe, string> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
};

export interface CoinSnapshot {
  symbol: string;
  price: number;
  priceChange: number;       // % change over selected interval
  volumeChange: number;      // ratio vs 20-period avg
  volume24h: number;
  sector: CryptoSector;
  momentum: number;          // momentum strength 0-100
}

export interface LeaderCoin extends CoinSnapshot {
  detectedAt: number;
  impulseStrength: number;   // composite score 0-100
}

export interface LeaderLagSignal {
  id: string;
  leader: LeaderCoin;
  follower: CoinSnapshot;
  correlation: number;       // 0-1
  signalStrength: number;    // 0-100 composite ranking
  timestamp: number;
}

export interface LeaderLagSettings {
  timeframe: LeaderLagTimeframe;
  minPriceChange: number;      // leader min % move (default 2)
  maxFollowerChange: number;   // follower max % move (default 0.8)
  minCorrelation: number;      // min correlation (default 0.7)
  minVolumeSpikeRatio: number; // min volume spike ratio (default 1.5)
  minVolume24h: number;        // min 24h volume filter
  sectorFilter: CryptoSector | 'all';
}

export const DEFAULT_LEADER_LAG_SETTINGS: LeaderLagSettings = {
  timeframe: '3',
  minPriceChange: 2,
  maxFollowerChange: 0.8,
  minCorrelation: 0.7,
  minVolumeSpikeRatio: 1.5,
  minVolume24h: 0,
  sectorFilter: 'all',
};
