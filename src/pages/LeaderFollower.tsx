import { useState } from 'react';
import { useLeaderLag } from '@/hooks/useLeaderLag';
import {
  RefreshCw, TrendingUp, Users, AlertTriangle, Filter,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getSectorEmoji } from '@/lib/sectors';
import { ALL_SECTORS, type CryptoSector } from '@/lib/sectors';
import type { LeaderLagTimeframe } from '@/types/leader-lag';
import { LEADER_LAG_TIMEFRAME_LABELS } from '@/types/leader-lag';

export default function LeaderFollower() {
  const {
    settings, updateSettings,
    leaders, signals,
    scanning, progress,
    lastScan, alerts, scan,
  } = useLeaderLag();

  const [showFilters, setShowFilters] = useState(false);

  const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-sm font-bold">Leader → Follower Opportunities</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-3.5 w-3.5 mr-1" />
              Filters
              {showFilters ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
            </Button>
            <Button size="sm" onClick={scan} disabled={scanning}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', scanning && 'animate-spin')} />
              {scanning ? 'Scanning…' : 'Scan'}
            </Button>
          </div>
        </div>

        {scanning && (
          <div className="mt-2">
            <Progress value={pct} className="h-1" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Scanning {progress.current}/{progress.total} coins…
            </p>
          </div>
        )}

        {lastScan > 0 && !scanning && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Last scan: {new Date(lastScan).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex-shrink-0 border-b border-border bg-card/50 px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Timeframe</label>
              <Select
                value={settings.timeframe}
                onValueChange={(v) => updateSettings({ timeframe: v as LeaderLagTimeframe })}
              >
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEADER_LAG_TIMEFRAME_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Min Leader Move %</label>
              <Select
                value={String(settings.minPriceChange)}
                onValueChange={(v) => updateSettings({ minPriceChange: parseFloat(v) })}
              >
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['1', '1.5', '2', '3', '5'].map(v => (
                    <SelectItem key={v} value={v}>{v}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Min Correlation</label>
              <Select
                value={String(settings.minCorrelation)}
                onValueChange={(v) => updateSettings({ minCorrelation: parseFloat(v) })}
              >
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['0.5', '0.6', '0.7', '0.8', '0.9'].map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Sector</label>
              <Select
                value={settings.sectorFilter}
                onValueChange={(v) => updateSettings({ sectorFilter: v as CryptoSector | 'all' })}
              >
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sectors</SelectItem>
                  {ALL_SECTORS.map(s => (
                    <SelectItem key={s} value={s}>{getSectorEmoji(s)} {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                Recent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1.5">
              {alerts.map((a, i) => (
                <p key={i} className="text-[11px] text-foreground/80 leading-snug">{a}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Market Leaders */}
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Market Leaders
              {leaders.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1">{leaders.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {leaders.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                {lastScan === 0 ? 'Click Scan to detect leader coins' : 'No leaders detected with current settings'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Coin</TableHead>
                    <TableHead className="text-[10px] text-right">Move</TableHead>
                    <TableHead className="text-[10px] text-right">Vol Spike</TableHead>
                    <TableHead className="text-[10px] text-right">Impulse</TableHead>
                    <TableHead className="text-[10px]">Sector</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaders.slice(0, 15).map(l => (
                    <TableRow key={l.symbol}>
                      <TableCell className="text-xs font-medium">{l.symbol.replace('USDT', '')}</TableCell>
                      <TableCell className={cn('text-xs text-right font-mono', l.priceChange > 0 ? 'text-green-400' : 'text-red-400')}>
                        {l.priceChange > 0 ? '+' : ''}{l.priceChange.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">{l.volumeChange.toFixed(1)}×</TableCell>
                      <TableCell className="text-xs text-right">
                        <Badge variant={l.impulseStrength >= 60 ? 'default' : 'secondary'} className="text-[10px]">
                          {l.impulseStrength}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px]">{getSectorEmoji(l.sector)} {l.sector}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Follower Opportunities */}
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              Lagging Coins — Catch-Up Opportunities
              {signals.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1">{signals.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {signals.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                {lastScan === 0 ? 'Click Scan to find opportunities' : 'No follower signals found'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Leader</TableHead>
                      <TableHead className="text-[10px] text-right">Leader %</TableHead>
                      <TableHead className="text-[10px]">Follower</TableHead>
                      <TableHead className="text-[10px] text-right">Follower %</TableHead>
                      <TableHead className="text-[10px] text-right">Corr</TableHead>
                      <TableHead className="text-[10px] text-right">Signal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signals.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs font-medium">
                          {getSectorEmoji(s.leader.sector)} {s.leader.symbol.replace('USDT', '')}
                        </TableCell>
                        <TableCell className={cn('text-xs text-right font-mono', s.leader.priceChange > 0 ? 'text-green-400' : 'text-red-400')}>
                          {s.leader.priceChange > 0 ? '+' : ''}{s.leader.priceChange.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {getSectorEmoji(s.follower.sector)} {s.follower.symbol.replace('USDT', '')}
                        </TableCell>
                        <TableCell className={cn('text-xs text-right font-mono', s.follower.priceChange > 0 ? 'text-green-400' : 'text-red-400')}>
                          {s.follower.priceChange > 0 ? '+' : ''}{s.follower.priceChange.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">{s.correlation.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-right">
                          <Badge
                            variant={s.signalStrength >= 60 ? 'default' : s.signalStrength >= 40 ? 'secondary' : 'outline'}
                            className="text-[10px]"
                          >
                            {s.signalStrength}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
