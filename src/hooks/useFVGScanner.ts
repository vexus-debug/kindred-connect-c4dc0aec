import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchTickers, fetchKlines } from '@/lib/bybit-api';
import { detectPureFVGs, type FVGScanResult } from '@/lib/fvg-scanner';
import type { Timeframe } from '@/types/scanner';

const FVG_TIMEFRAMES: Timeframe[] = ['60', '240', 'D'];
const BATCH_SIZE = 15;
const SCAN_INTERVAL = 60 * 60 * 1000;

export function useFVGScanner() {
  const [results, setResults] = useState<FVGScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(0);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const scanRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const runScan = useCallback(async () => {
    if (scanRef.current) return;
    scanRef.current = true;
    setScanning(true);

    try {
      const tickerData = await fetchTickers('linear');
      if (tickerData.retCode !== 0 || !tickerData.result?.list) return;

      // All USDT perpetuals
      const symbols = tickerData.result.list
        .filter(t => t.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h));

      const total = symbols.length;
      setProgress({ current: 0, total });
      const allResults: FVGScanResult[] = [];

      for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
        const batch = symbols.slice(i, i + BATCH_SIZE);

        // For each symbol, fetch ALL 3 timeframes in parallel (not sequentially)
        const batchPromises = batch.map(async (ticker) => {
          const sym = ticker.symbol;
          const price = parseFloat(ticker.lastPrice);
          const change = parseFloat(ticker.price24hPcnt) * 100;

          // Fetch all timeframes in parallel for this symbol
          const tfPromises = FVG_TIMEFRAMES.map(async (tf) => {
            try {
              const candles = await fetchKlines(sym, tf, 'linear', 200);
              if (candles.length < 10) return null;

              const fvgs = detectPureFVGs(candles, tf);
              if (fvgs.length === 0) return null;

              const bullish = fvgs.filter(f => f.type === 'bullish');
              const bearish = fvgs.filter(f => f.type === 'bearish');

              let nearest = fvgs[0];
              let minDist = Math.abs(price - fvgs[0].midpoint);
              for (const f of fvgs) {
                const d = Math.abs(price - f.midpoint);
                if (d < minDist) { minDist = d; nearest = f; }
              }

              return {
                symbol: sym, price, change24h: change, timeframe: tf, fvgs,
                bullishCount: bullish.length, bearishCount: bearish.length,
                strongestFVG: fvgs[0] || null, nearestFVG: nearest || null,
                distToNearest: nearest ? ((price - nearest.midpoint) / price) * 100 : null,
              } as FVGScanResult;
            } catch { return null; }
          });

          return (await Promise.all(tfPromises)).filter(Boolean) as FVGScanResult[];
        });

        const batchResults = await Promise.all(batchPromises);
        for (const symbolResults of batchResults) {
          allResults.push(...symbolResults);
        }

        // Stream partial results to UI every batch
        const sorted = [...allResults].sort((a, b) => (b.strongestFVG?.strength ?? 0) - (a.strongestFVG?.strength ?? 0));
        setResults(sorted);
        setProgress({ current: Math.min(i + BATCH_SIZE, total), total });

        if (i + BATCH_SIZE < symbols.length) {
          await new Promise(r => setTimeout(r, 50));
        }
      }

      setLastScan(Date.now());
    } catch (err) {
      console.error('FVG scan error:', err);
    } finally {
      scanRef.current = false;
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    runScan();
    intervalRef.current = setInterval(runScan, SCAN_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [runScan]);

  return { results, scanning, lastScan, progress, runScan };
}
