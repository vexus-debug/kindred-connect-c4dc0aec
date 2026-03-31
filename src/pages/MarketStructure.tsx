import { useState, useMemo } from 'react';
import { useChochScanner, type ChochResult } from '@/hooks/useChochScanner';
import { TIMEFRAME_LABELS, type Timeframe } from '@/types/scanner';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  RefreshCw, Shield, TrendingUp, TrendingDown, X, AlertTriangle,
  Activity, Clock, Zap, Target, Droplets, Gauge, BarChart3, Layers
} from 'lucide-react';

const SCAN_TIMEFRAMES: Timeframe[] = ['1', '5', '15', '60', '240', 'D', 'W'];
const CHOCH_FAIL_OPTIONS = ['all', '1+', '2+', '3+', '5+'] as const;
type ChochFailFilter = typeof CHOCH_FAIL_OPTIONS[number];
type TrendFilter = 'all' | 'bullish' | 'bearish';

const MarketStructurePage = () => {
  const { results, scanning, scanProgress, lastScanTime, runScan, groupByTimeframe, getRankedResults, getMtfChoch } = useChochScanner();
  const [tfFilter, setTfFilter] = useState<Timeframe | 'all'>('all');
  const [chochFailFilter, setChochFailFilter] = useState<ChochFailFilter>('all');
  const [trendFilter, setTrendFilter] = useState<TrendFilter>('all');
  const [activeTab, setActiveTab] = useState('scanner');

  const filtered = useMemo(() => {
    const minFails = chochFailFilter === 'all' ? 0 : parseInt(chochFailFilter);
    return results.filter(r => {
      if (tfFilter !== 'all' && r.timeframe !== tfFilter) return false;
      if (minFails > 0 && r.chochFailures < minFails) return false;
      if (trendFilter !== 'all' && r.trendDirection !== trendFilter) return false;
      if (chochFailFilter === 'all' && r.chochFailures === 0 && r.exhaustion.exhaustionIndex.value < 40) return false;
      return true;
    });
  }, [results, tfFilter, chochFailFilter, trendFilter]);

  const groups = useMemo(() => groupByTimeframe(filtered), [filtered, groupByTimeframe]);
  const ranked = useMemo(() => getRankedResults(results), [results, getRankedResults]);
  const mtfChoch = useMemo(() => getMtfChoch(results), [results, getMtfChoch]);
  const totalResults = filtered.length;
  const hasFilters = tfFilter !== 'all' || chochFailFilter !== 'all' || trendFilter !== 'all';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground">Exhaustion Scanner</h1>
          <p className="text-[10px] text-muted-foreground">Trend exhaustion, CHoCH failures & reversal probability</p>
        </div>
        <div className="flex items-center gap-2">
          {scanning && (
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {scanProgress.current}/{scanProgress.total}
            </span>
          )}
          <span className="text-[10px] tabular-nums text-muted-foreground">{totalResults} results</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={runScan} disabled={scanning}>
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 h-8 bg-secondary/50">
          <TabsTrigger value="scanner" className="text-[10px] h-6">Scanner</TabsTrigger>
          <TabsTrigger value="ranking" className="text-[10px] h-6">Ranking</TabsTrigger>
          <TabsTrigger value="mtf" className="text-[10px] h-6">MTF CHoCH</TabsTrigger>
        </TabsList>

        {/* Filters (shared) */}
        <div className="border-b border-border px-4 py-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              {(['all', 'bullish', 'bearish'] as TrendFilter[]).map(t => (
                <button key={t} onClick={() => setTrendFilter(t)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    trendFilter === t
                      ? t === 'bullish' ? 'bg-primary/20 text-primary'
                      : t === 'bearish' ? 'bg-destructive/20 text-destructive'
                      : 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {t === 'all' ? 'All' : t === 'bullish' ? '↑ Bull' : '↓ Bear'}
                </button>
              ))}
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1 overflow-x-auto">
              <button onClick={() => setTfFilter('all')}
                className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors whitespace-nowrap ${
                  tfFilter === 'all' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>All TF</button>
              {SCAN_TIMEFRAMES.map(tf => (
                <button key={tf} onClick={() => setTfFilter(tf)}
                  className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors whitespace-nowrap ${
                    tfFilter === tf ? 'bg-accent/20 text-accent' : 'text-muted-foreground hover:text-foreground'
                  }`}>{TIMEFRAME_LABELS[tf]}</button>
              ))}
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-muted-foreground mr-0.5">Fails:</span>
              {CHOCH_FAIL_OPTIONS.map(opt => (
                <button key={opt} onClick={() => setChochFailFilter(opt)}
                  className={`rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                    chochFailFilter === opt ? 'bg-destructive/20 text-destructive' : 'text-muted-foreground hover:text-foreground'
                  }`}>{opt === 'all' ? 'Any' : opt}</button>
              ))}
            </div>
            {hasFilters && (
              <button onClick={() => { setTfFilter('all'); setChochFailFilter('all'); setTrendFilter('all'); }}
                className="flex items-center gap-0.5 rounded-full px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
                <X className="h-2.5 w-2.5" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {scanning && (
          <div className="h-0.5 bg-muted">
            <div className="h-full bg-primary transition-all duration-300"
              style={{ width: scanProgress.total > 0 ? `${(scanProgress.current / scanProgress.total) * 100}%` : '0%' }} />
          </div>
        )}

        {/* Scanner Tab */}
        <TabsContent value="scanner" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-5">
              {groups.length === 0 && !scanning && (
                <div className="py-16 text-center text-xs text-muted-foreground">
                  {results.length === 0
                    ? 'Hit ↻ to scan for exhaustion signals across all symbols.'
                    : 'No results match filters. Try adjusting.'}
                </div>
              )}
              {groups.map(group => (
                <div key={group.timeframe}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="rounded-full bg-accent/15 px-3 py-0.5 text-[11px] font-bold text-accent">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {group.results.length} symbol{group.results.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-2">
                    {group.results.map(r => (
                      <ExhaustionCard key={r.id} result={r} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {ranked.length === 0 && !scanning && (
                <div className="py-16 text-center text-xs text-muted-foreground">
                  Hit ↻ to scan and rank markets by reversal probability.
                </div>
              )}
              {ranked.slice(0, 30).map((r, idx) => (
                <RankingCard key={r.id} result={r} rank={idx + 1} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* MTF CHoCH Tab */}
        <TabsContent value="mtf" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {mtfChoch.size === 0 && !scanning && (
                <div className="py-16 text-center text-xs text-muted-foreground">
                  Hit ↻ to track CHoCH failures across timeframes.
                </div>
              )}
              {Array.from(mtfChoch.entries())
                .sort((a, b) => b[1].reduce((s, e) => s + e.failures, 0) - a[1].reduce((s, e) => s + e.failures, 0))
                .slice(0, 30)
                .map(([symbol, entries]) => (
                  <MtfCard key={symbol} symbol={symbol} entries={entries} />
                ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ─── Exhaustion Card ───

function ExhaustionCard({ result }: { result: ChochResult }) {
  const { symbol, chochFailures, trendDirection, price, timeframe, exhaustion: ex } = result;
  const [expanded, setExpanded] = useState(false);
  const isBull = trendDirection === 'bullish';
  const isBear = trendDirection === 'bearish';

  const exhaustionColor =
    ex.exhaustionIndex.value >= 80 ? 'text-destructive' :
    ex.exhaustionIndex.value >= 60 ? 'text-accent' :
    ex.exhaustionIndex.value >= 40 ? 'text-yellow-500' :
    'text-muted-foreground';

  const reversalColor =
    ex.reversalScore.score >= 7 ? 'text-destructive' :
    ex.reversalScore.score >= 4 ? 'text-accent' :
    'text-primary';

  return (
    <div className="rounded-lg border border-border overflow-hidden transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-secondary/30 transition-colors"
      >
        {/* Symbol + trend */}
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{symbol}</h3>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full border-accent/30 text-accent shrink-0">
            {TIMEFRAME_LABELS[timeframe]}
          </Badge>
          {trendDirection !== 'unknown' && (
            <Badge className={`text-[9px] px-1.5 py-0 rounded-full border-0 shrink-0 ${
              isBull ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
            }`}>
              {isBull ? <TrendingUp className="h-2.5 w-2.5 mr-0.5 inline" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5 inline" />}
              {isBull ? 'Up' : 'Down'}
            </Badge>
          )}
        </div>

        <div className="flex-1" />

        {/* Quick metrics */}
        <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
          ${price < 1 ? price.toPrecision(4) : price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>

        {/* Exhaustion index */}
        <div className={`flex items-center gap-1 shrink-0 rounded-full bg-secondary/60 px-2 py-1`}>
          <Gauge className={`h-3 w-3 ${exhaustionColor}`} />
          <span className={`text-xs font-black tabular-nums ${exhaustionColor}`}>{ex.exhaustionIndex.value}%</span>
        </div>

        {/* Reversal score */}
        <div className={`flex items-center gap-1 shrink-0 rounded-full bg-secondary/60 px-2 py-1`}>
          <Target className={`h-3 w-3 ${reversalColor}`} />
          <span className={`text-xs font-black tabular-nums ${reversalColor}`}>{ex.reversalScore.score}/10</span>
        </div>

        {/* CHoCH failures */}
        {chochFailures > 0 && (
          <div className="flex items-center gap-1 shrink-0 rounded-full bg-secondary/60 px-2 py-1">
            <Shield className="h-3 w-3 text-destructive" />
            <span className="text-xs font-black tabular-nums text-destructive">{chochFailures}</span>
          </div>
        )}
      </button>

      {/* Expanded metrics */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
          {/* Row 1: Trend Strength + Trend Age */}
          <div className="grid grid-cols-2 gap-2">
            <MetricBox
              icon={<Activity className="h-3 w-3" />}
              label="Trend Strength"
              value={ex.trendStrength.level.toUpperCase()}
              sub={`Score: ${ex.trendStrength.score}/100`}
              color={ex.trendStrength.level === 'exhausted' ? 'text-destructive' : ex.trendStrength.level === 'weak' ? 'text-accent' : 'text-primary'}
            />
            <MetricBox
              icon={<Clock className="h-3 w-3" />}
              label="Trend Age"
              value={`${ex.trendAge.candles} candles`}
              sub={ex.trendAge.state}
              color={ex.trendAge.state === 'exhaustion' ? 'text-destructive' : ex.trendAge.state === 'aging' ? 'text-accent' : 'text-muted-foreground'}
            />
          </div>

          {/* Row 2: Impulse + Breakout */}
          <div className="grid grid-cols-2 gap-2">
            <MetricBox
              icon={<Zap className="h-3 w-3" />}
              label="Impulse Legs"
              value={`${ex.impulseAnalysis.legCount} legs`}
              sub={ex.impulseAnalysis.isShrinking ? '⚠ Shrinking' : 'Normal'}
              color={ex.impulseAnalysis.isShrinking ? 'text-accent' : 'text-muted-foreground'}
            />
            <MetricBox
              icon={<BarChart3 className="h-3 w-3" />}
              label="Breakout Power"
              value={ex.breakout.type.toUpperCase()}
              sub={`Score: ${ex.breakout.score}/100`}
              color={ex.breakout.type === 'fake' ? 'text-destructive' : ex.breakout.type === 'weak' ? 'text-accent' : 'text-primary'}
            />
          </div>

          {/* Row 3: Liquidity Sweeps + Failure Speed */}
          <div className="grid grid-cols-2 gap-2">
            <MetricBox
              icon={<Droplets className="h-3 w-3" />}
              label="Liquidity Sweeps"
              value={`${ex.liquiditySweeps.count} sweeps`}
              sub={ex.liquiditySweeps.count >= 3 ? 'High sweep activity' : 'Normal'}
              color={ex.liquiditySweeps.count >= 3 ? 'text-destructive' : 'text-muted-foreground'}
            />
            <MetricBox
              icon={<AlertTriangle className="h-3 w-3" />}
              label="Failure Speed"
              value={ex.failureSpeed.speed.toUpperCase()}
              sub={ex.failureSpeed.description}
              color={ex.failureSpeed.speed === 'fast' ? 'text-destructive' : 'text-muted-foreground'}
            />
          </div>

          {/* Row 4: Momentum + Vol Compression */}
          <div className="grid grid-cols-2 gap-2">
            <MetricBox
              icon={<Activity className="h-3 w-3" />}
              label="Momentum"
              value={ex.momentumDecay.decaying ? 'DECAYING' : 'STABLE'}
              sub={`${ex.momentumDecay.current}/100 (was ${ex.momentumDecay.previous})`}
              color={ex.momentumDecay.decaying ? 'text-destructive' : 'text-primary'}
            />
            <MetricBox
              icon={<Layers className="h-3 w-3" />}
              label="Vol Compression"
              value={ex.volatilityCompression.compressed ? 'COMPRESSED' : 'NORMAL'}
              sub={`Ratio: ${ex.volatilityCompression.ratio.toFixed(2)}x`}
              color={ex.volatilityCompression.compressed ? 'text-accent' : 'text-muted-foreground'}
            />
          </div>

          {/* Row 5: Structure Distance + Trend Legs */}
          <div className="grid grid-cols-2 gap-2">
            <MetricBox
              icon={<Target className="h-3 w-3" />}
              label="Dist to High"
              value={`${ex.structureDistance.distToHighPercent}%`}
              sub={ex.structureDistance.nearStructure ? '⚠ Near structure' : 'Away from structure'}
              color={ex.structureDistance.nearStructure ? 'text-accent' : 'text-muted-foreground'}
            />
            <MetricBox
              icon={<BarChart3 className="h-3 w-3" />}
              label="Trend Legs"
              value={`${ex.trendLegs.count} legs`}
              sub={ex.trendLegs.state}
              color={ex.trendLegs.state === 'high_reversal' ? 'text-destructive' : ex.trendLegs.state === 'exhaustion' ? 'text-accent' : 'text-muted-foreground'}
            />
          </div>

          {/* Reversal factors */}
          {ex.reversalScore.factors.length > 0 && (
            <div className="rounded-md bg-secondary/40 px-2.5 py-2">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Reversal Factors</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {ex.reversalScore.factors.map((f, i) => (
                  <span key={i} className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[9px]">{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Impulse legs detail */}
          {ex.impulseAnalysis.legs.length > 0 && (
            <div className="rounded-md bg-secondary/40 px-2.5 py-2">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Impulse Legs</span>
              <div className="mt-1 space-y-0.5">
                {ex.impulseAnalysis.legs.map((leg, i) => (
                  <div key={i} className="flex items-center gap-2 text-[9px]">
                    <span className={leg.direction === 'up' ? 'text-primary' : 'text-destructive'}>
                      {leg.direction === 'up' ? '↑' : '↓'}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {leg.size < 1 ? leg.size.toPrecision(3) : leg.size.toFixed(2)} pts
                    </span>
                    <span className="text-muted-foreground">({leg.candleCount} candles)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ranking Card ───

function RankingCard({ result, rank }: { result: ChochResult; rank: number }) {
  const { symbol, price, exhaustion: ex } = result;
  const scoreColor =
    ex.exhaustionIndex.value >= 80 ? 'text-destructive' :
    ex.exhaustionIndex.value >= 60 ? 'text-accent' :
    ex.exhaustionIndex.value >= 40 ? 'text-yellow-500' :
    'text-muted-foreground';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
      <span className={`text-lg font-black tabular-nums w-6 text-center ${rank <= 3 ? 'text-destructive' : 'text-muted-foreground'}`}>
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-foreground">{symbol}</h3>
          <Badge className={`text-[9px] px-1.5 py-0 rounded-full border-0 ${
            ex.trendDirection === 'bullish' ? 'bg-primary/20 text-primary' :
            ex.trendDirection === 'bearish' ? 'bg-destructive/20 text-destructive' :
            'bg-secondary text-muted-foreground'
          }`}>
            {ex.trendDirection === 'bullish' ? '↑' : ex.trendDirection === 'bearish' ? '↓' : '—'} {ex.trendDirection}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[9px] text-muted-foreground">
          <span>Reversal: {ex.reversalScore.score}/10</span>
          <span>Age: {ex.trendAge.candles}c</span>
          <span>Legs: {ex.trendLegs.count}</span>
          {ex.chochFailures > 0 && <span className="text-destructive">CHoCH fails: {ex.chochFailures}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] tabular-nums text-muted-foreground">
          ${price < 1 ? price.toPrecision(4) : price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <div className={`flex items-center gap-1 rounded-full bg-secondary/60 px-2.5 py-1`}>
          <Gauge className={`h-3.5 w-3.5 ${scoreColor}`} />
          <span className={`text-sm font-black tabular-nums ${scoreColor}`}>{ex.exhaustionIndex.value}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── MTF Card ───

function MtfCard({ symbol, entries }: { symbol: string; entries: { tf: Timeframe; failures: number }[] }) {
  const totalFailures = entries.reduce((s, e) => s + e.failures, 0);
  const tfCount = entries.length;

  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-foreground">{symbol}</h3>
        <span className={`text-[10px] font-bold ${tfCount >= 3 ? 'text-destructive' : 'text-accent'}`}>
          {tfCount} TF{tfCount !== 1 ? 's' : ''} exhausted
        </span>
        <div className="flex-1" />
        <span className="text-[10px] tabular-nums text-muted-foreground">Total: {totalFailures} fails</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {entries.map(e => (
          <div key={e.tf} className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5">
            <span className="text-[9px] font-semibold text-destructive">{TIMEFRAME_LABELS[e.tf]}</span>
            <span className="text-[9px] tabular-nums text-destructive font-black">{e.failures}</span>
          </div>
        ))}
      </div>
      {tfCount >= 3 && (
        <div className="mt-1.5 text-[9px] text-destructive flex items-center gap-1">
          <AlertTriangle className="h-2.5 w-2.5" />
          Multi-timeframe exhaustion — very strong reversal signal
        </div>
      )}
    </div>
  );
}

// ─── Metric Box ───

function MetricBox({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-md bg-secondary/30 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mb-1">
        {icon}
        <span className="uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className={`text-xs font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground truncate">{sub}</div>
    </div>
  );
}

export default MarketStructurePage;
