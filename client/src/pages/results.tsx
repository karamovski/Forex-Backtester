import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Percent,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  FileSpreadsheet,
  FileJson,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBacktestStore } from "@/lib/backtest-store";
import { useToast } from "@/hooks/use-toast";
import type { BacktestResults, TradeResult } from "@shared/schema";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  Scatter,
  ComposedChart,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
}

function StatCard({ label, value, subValue, icon: Icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-mono font-semibold mt-1">{value}</p>
            {subValue && (
              <p
                className={`text-sm mt-1 ${
                  trend === "up"
                    ? "text-green-600 dark:text-green-400"
                    : trend === "down"
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
                }`}
              >
                {subValue}
              </p>
            )}
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-md ${
              trend === "up"
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : trend === "down"
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function generateCSV(results: BacktestResults): string {
  const headers = [
    "Trade ID",
    "Symbol",
    "Direction",
    "Entry Price",
    "Entry Time",
    "Exit Price",
    "Exit Time",
    "Exit Reason",
    "Lot Size",
    "Pips",
    "Profit/Loss",
    "Balance",
  ];
  
  const rows = results.trades.map((trade) => [
    trade.id,
    trade.symbol,
    trade.direction.toUpperCase(),
    trade.entryPrice.toFixed(5),
    trade.entryTime,
    trade.exitPrice.toFixed(5),
    trade.exitTime,
    trade.exitReason.toUpperCase(),
    trade.lotSize.toFixed(2),
    trade.pips.toFixed(1),
    trade.profit.toFixed(2),
    trade.balance.toFixed(2),
  ]);
  
  const summaryRows = [
    [],
    ["SUMMARY"],
    ["Initial Balance", results.initialBalance.toFixed(2)],
    ["Final Balance", results.finalBalance.toFixed(2)],
    ["Total Trades", results.totalTrades.toString()],
    ["Winning Trades", results.winningTrades.toString()],
    ["Losing Trades", results.losingTrades.toString()],
    ["Win Rate", `${results.winRate.toFixed(2)}%`],
    ["Total Pips", results.totalPips.toFixed(1)],
    ["Profit Factor", results.profitFactor.toFixed(2)],
    ["Max Drawdown (Equity)", `${results.maxDrawdownEquityPercent.toFixed(2)}%`],
    ["Max Drawdown (Balance)", `${results.maxDrawdownBalancePercent.toFixed(2)}%`],
    ["Average Win", results.averageWin.toFixed(2)],
    ["Average Loss", results.averageLoss.toFixed(2)],
    ["Largest Win", results.largestWin.toFixed(2)],
    ["Largest Loss", results.largestLoss.toFixed(2)],
  ];
  
  const symbolStats = getSymbolStats(results);
  const symbolList = Object.values(symbolStats);
  
  const symbolRows: string[][] = [];
  if (symbolList.length > 1) {
    symbolRows.push([]);
    symbolRows.push(["PERFORMANCE BY SYMBOL"]);
    symbolRows.push(["Symbol", "Trades", "Wins", "Losses", "Win Rate", "Total Pips", "Total Profit"]);
    symbolList.forEach(s => {
      const winRate = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;
      symbolRows.push([
        s.symbol,
        s.trades.toString(),
        s.wins.toString(),
        s.losses.toString(),
        `${winRate.toFixed(1)}%`,
        s.totalPips.toFixed(1),
        s.totalProfit.toFixed(2),
      ]);
    });
    
    const correlations = getSymbolCorrelations(results.trades);
    if (correlations.length > 0) {
      symbolRows.push([]);
      symbolRows.push(["CORRELATION ANALYSIS"]);
      symbolRows.push(["Symbol Pair", "Correlation"]);
      correlations.forEach(c => {
        symbolRows.push([c.pair, c.correlation.toFixed(3)]);
      });
    }
  }
  
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
    ...summaryRows.map((row) => row.join(",")),
    ...symbolRows.map((row) => row.join(",")),
  ].join("\n");
  
  return csvContent;
}

function getSymbolStats(results: BacktestResults) {
  return results.trades.reduce((acc, trade) => {
    if (!acc[trade.symbol]) {
      acc[trade.symbol] = {
        symbol: trade.symbol,
        trades: 0,
        wins: 0,
        losses: 0,
        totalProfit: 0,
        totalPips: 0,
      };
    }
    acc[trade.symbol].trades++;
    if (trade.profit >= 0) {
      acc[trade.symbol].wins++;
    } else {
      acc[trade.symbol].losses++;
    }
    acc[trade.symbol].totalProfit += trade.profit;
    acc[trade.symbol].totalPips += trade.pips;
    return acc;
  }, {} as Record<string, { symbol: string; trades: number; wins: number; losses: number; totalProfit: number; totalPips: number }>);
}

function calculateCorrelation(arr1: number[], arr2: number[]): number {
  const n = Math.min(arr1.length, arr2.length);
  if (n < 2) return 0;
  
  const mean1 = arr1.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const mean2 = arr2.slice(0, n).reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denom1 = 0;
  let denom2 = 0;
  
  for (let i = 0; i < n; i++) {
    const d1 = arr1[i] - mean1;
    const d2 = arr2[i] - mean2;
    numerator += d1 * d2;
    denom1 += d1 * d1;
    denom2 += d2 * d2;
  }
  
  if (denom1 === 0 || denom2 === 0) return 0;
  return numerator / Math.sqrt(denom1 * denom2);
}

function getSymbolCorrelations(trades: TradeResult[]) {
  const symbols = Array.from(new Set(trades.map(t => t.symbol)));
  if (symbols.length < 2) return [];
  
  const symbolProfits: Record<string, number[]> = {};
  symbols.forEach(s => { symbolProfits[s] = []; });
  trades.forEach(t => { symbolProfits[t.symbol].push(t.profit); });
  
  const correlations: Array<{ pair: string; correlation: number }> = [];
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const corr = calculateCorrelation(symbolProfits[symbols[i]], symbolProfits[symbols[j]]);
      correlations.push({
        pair: `${symbols[i]} / ${symbols[j]}`,
        correlation: corr,
      });
    }
  }
  return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

function generateJSON(results: BacktestResults): string {
  const symbolStats = getSymbolStats(results);
  const symbolList = Object.values(symbolStats);
  const correlations = getSymbolCorrelations(results.trades);
  
  const exportData = {
    summary: {
      initialBalance: results.initialBalance,
      finalBalance: results.finalBalance,
      totalTrades: results.totalTrades,
      winningTrades: results.winningTrades,
      losingTrades: results.losingTrades,
      winRate: results.winRate,
      totalPips: results.totalPips,
      profitFactor: results.profitFactor,
      maxDrawdownEquity: results.maxDrawdownEquity,
      maxDrawdownEquityPercent: results.maxDrawdownEquityPercent,
      maxDrawdownBalance: results.maxDrawdownBalance,
      maxDrawdownBalancePercent: results.maxDrawdownBalancePercent,
      averageWin: results.averageWin,
      averageLoss: results.averageLoss,
      largestWin: results.largestWin,
      largestLoss: results.largestLoss,
    },
    symbolBreakdown: symbolList.map(s => ({
      symbol: s.symbol,
      trades: s.trades,
      wins: s.wins,
      losses: s.losses,
      winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0,
      totalProfit: s.totalProfit,
      totalPips: s.totalPips,
    })),
    correlationAnalysis: correlations,
    trades: results.trades,
    equityCurve: results.equityCurve,
  };
  
  return JSON.stringify(exportData, null, 2);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Results() {
  const { results, risk } = useBacktestStore();
  const { toast } = useToast();

  const handleExportCSV = () => {
    if (!results) return;
    const csv = generateCSV(results);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadFile(csv, `backtest-report-${timestamp}.csv`, "text/csv");
    toast({
      title: "Export Successful",
      description: "CSV report downloaded successfully",
    });
  };

  const handleExportJSON = () => {
    if (!results) return;
    const json = generateJSON(results);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadFile(json, `backtest-report-${timestamp}.json`, "application/json");
    toast({
      title: "Export Successful",
      description: "JSON report downloaded successfully",
    });
  };

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <BarChart3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold text-center">No Results Yet</h2>
        <p className="text-sm text-muted-foreground text-center mt-2 max-w-md">
          Run a backtest to see your performance results here. Configure your settings and click
          "Run Backtest" to get started.
        </p>
      </div>
    );
  }

  if (!results.trades || results.trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <BarChart3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold text-center">No Trades Executed</h2>
        <p className="text-sm text-muted-foreground text-center mt-2 max-w-md">
          The backtest completed but no trades were executed. Check your signal format and strategy settings.
        </p>
      </div>
    );
  }

  const profitLoss = results.finalBalance - results.initialBalance;
  const profitLossPercent = (profitLoss / results.initialBalance) * 100;
  const isProfit = profitLoss >= 0;

  const chartData = results.equityCurve.map((point, index) => {
    const trade = results.trades.find(
      (t) => t.balance === point.equity && index > 0
    );
    return {
      ...point,
      time: new Date(point.time).toLocaleDateString(),
      tradeResult: trade?.profit !== undefined ? (trade.profit >= 0 ? "win" : "loss") : undefined,
      tradeSymbol: trade?.symbol,
      tradeProfit: trade?.profit,
    };
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Backtest Results</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulated performance analysis from {results.totalTrades} trades
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-export">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV} data-testid="button-export-csv">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJSON} data-testid="button-export-json">
                <FileJson className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge
            variant={isProfit ? "default" : "destructive"}
            className="text-sm px-3 py-1 gap-1"
          >
            {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {formatPercent(profitLossPercent)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Final Balance"
          value={formatCurrency(results.finalBalance)}
          subValue={`${isProfit ? "+" : ""}${formatCurrency(profitLoss)}`}
          icon={DollarSign}
          trend={isProfit ? "up" : "down"}
        />
        <StatCard
          label="Win Rate"
          value={`${results.winRate.toFixed(1)}%`}
          subValue={`${results.winningTrades}W / ${results.losingTrades}L`}
          icon={Target}
          trend={results.winRate >= 50 ? "up" : "down"}
        />
        <StatCard
          label="Max Drawdown (Equity)"
          value={formatPercent(-results.maxDrawdownEquityPercent)}
          subValue={formatCurrency(-results.maxDrawdownEquity)}
          icon={Activity}
          trend="down"
        />
        <StatCard
          label="Profit Factor"
          value={results.profitFactor.toFixed(2)}
          subValue={results.profitFactor >= 1.5 ? "Good" : results.profitFactor >= 1 ? "Breakeven" : "Poor"}
          icon={Percent}
          trend={results.profitFactor >= 1.5 ? "up" : results.profitFactor >= 1 ? "neutral" : "down"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Equity Curve</CardTitle>
            <CardDescription>Account equity over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={isProfit ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)"}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={isProfit ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)"}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number, name: string, props: { payload?: { tradeSymbol?: string; tradeProfit?: number; tradeResult?: string } }) => {
                      const payload = props?.payload;
                      if (name === "equity" && payload?.tradeSymbol && payload?.tradeProfit !== undefined) {
                        return [
                          `${formatCurrency(value)} (${payload.tradeSymbol}: ${payload.tradeProfit >= 0 ? "+" : ""}${formatCurrency(payload.tradeProfit)})`,
                          "Equity"
                        ];
                      }
                      if (name === "equity") {
                        return [formatCurrency(value), "Equity"];
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke={isProfit ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)"}
                    strokeWidth={2}
                    fill="url(#equityGradient)"
                  />
                  <Scatter
                    dataKey="equity"
                    data={chartData.filter(p => p.tradeResult)}
                    shape={(props: unknown) => {
                      const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: { tradeResult?: string } };
                      if (cx === undefined || cy === undefined) return <circle />;
                      const isWin = payload?.tradeResult === "win";
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill={isWin ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)"}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      );
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Trade Statistics</CardTitle>
            <CardDescription>Detailed performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Total Trades</span>
              <span className="font-mono font-medium">{results.totalTrades}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Total Pips</span>
              <span
                className={`font-mono font-medium ${
                  results.totalPips >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {results.totalPips >= 0 ? "+" : ""}
                {results.totalPips.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Average Win</span>
              <span className="font-mono font-medium text-green-600 dark:text-green-400">
                +{formatCurrency(results.averageWin)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Average Loss</span>
              <span className="font-mono font-medium text-red-600 dark:text-red-400">
                {formatCurrency(-results.averageLoss)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Largest Win</span>
              <span className="font-mono font-medium text-green-600 dark:text-green-400">
                +{formatCurrency(results.largestWin)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Largest Loss</span>
              <span className="font-mono font-medium text-red-600 dark:text-red-400">
                {formatCurrency(-results.largestLoss)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Max Balance DD</span>
              <span className="font-mono font-medium text-red-600 dark:text-red-400">
                {formatPercent(-results.maxDrawdownBalancePercent)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Currency Pair Analysis */}
      {(() => {
        const symbolStats = getSymbolStats(results);
        const symbolList = Object.values(symbolStats).sort((a, b) => b.totalProfit - a.totalProfit);

        if (symbolList.length > 1) {
          return (
            <Card data-testid="card-symbol-analysis">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Performance by Symbol</CardTitle>
                <CardDescription>Breakdown of results for each traded instrument</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {symbolList.map((stat, index) => {
                    const winRate = stat.trades > 0 ? (stat.wins / stat.trades) * 100 : 0;
                    const isProfitable = stat.totalProfit >= 0;
                    return (
                      <div
                        key={stat.symbol}
                        className="p-4 rounded-md border"
                        data-testid={`card-symbol-${index}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold" data-testid={`text-symbol-name-${index}`}>{stat.symbol}</span>
                          <Badge
                            variant="secondary"
                            className={isProfitable ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}
                            data-testid={`text-symbol-profit-${index}`}
                          >
                            {isProfitable ? "+" : ""}{formatCurrency(stat.totalProfit)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Trades:</span>
                            <span className="font-mono ml-2" data-testid={`text-symbol-trades-${index}`}>{stat.trades}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Win Rate:</span>
                            <span className="font-mono ml-2" data-testid={`text-symbol-winrate-${index}`}>{winRate.toFixed(0)}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">W/L:</span>
                            <span className="font-mono ml-2" data-testid={`text-symbol-wl-${index}`}>{stat.wins}/{stat.losses}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pips:</span>
                            <span className={`font-mono ml-2 ${stat.totalPips >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid={`text-symbol-pips-${index}`}>
                              {stat.totalPips >= 0 ? "+" : ""}{stat.totalPips.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Correlation Analysis */}
                {(() => {
                  const correlations = getSymbolCorrelations(results.trades);
                  if (correlations.length > 0) {
                    return (
                      <div className="mt-6 pt-4 border-t">
                        <h4 className="text-sm font-medium mb-3">Symbol Correlation</h4>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {correlations.map((corr, idx) => {
                            const absCorr = Math.abs(corr.correlation);
                            const corrColor = 
                              absCorr > 0.7 ? "text-red-600 dark:text-red-400" :
                              absCorr > 0.4 ? "text-yellow-600 dark:text-yellow-400" :
                              "text-green-600 dark:text-green-400";
                            const corrLabel = 
                              absCorr > 0.7 ? "Strong" :
                              absCorr > 0.4 ? "Moderate" :
                              "Weak";
                            return (
                              <div 
                                key={corr.pair} 
                                className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                                data-testid={`correlation-pair-${idx}`}
                              >
                                <span className="text-sm">{corr.pair}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono text-sm ${corrColor}`} data-testid={`correlation-value-${idx}`}>
                                    {corr.correlation >= 0 ? "+" : ""}{corr.correlation.toFixed(2)}
                                  </span>
                                  <Badge variant="secondary" className="text-xs">
                                    {corrLabel}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Correlation measures how symbol profits move together. High correlation (&gt;0.7) suggests similar risk exposure.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      {/* Additional Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Drawdown Chart */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Drawdown Over Time</CardTitle>
            <CardDescription>Running drawdown from peak equity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={(() => {
                    let peak = results.initialBalance;
                    return results.equityCurve.map((point) => {
                      if (point.equity > peak) peak = point.equity;
                      const drawdown = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
                      return {
                        time: new Date(point.time).toLocaleDateString(),
                        drawdown: -drawdown,
                      };
                    });
                  })()}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                    domain={["dataMin", 0]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)}%`, "Drawdown"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    stroke="hsl(0 84% 60%)"
                    fill="hsl(0 84% 60% / 0.2)"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Exit Reason Distribution */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Exit Reason Distribution</CardTitle>
            <CardDescription>How trades were closed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(() => {
                      const counts: Record<string, number> = {};
                      results.trades.forEach((t) => {
                        const reason = t.exitReason.toUpperCase();
                        counts[reason] = (counts[reason] || 0) + 1;
                      });
                      return Object.entries(counts).map(([name, value]) => ({ name, value }));
                    })()}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(() => {
                      const counts: Record<string, number> = {};
                      results.trades.forEach((t) => {
                        const reason = t.exitReason.toUpperCase();
                        counts[reason] = (counts[reason] || 0) + 1;
                      });
                      const colors: Record<string, string> = {
                        SL: "hsl(0 84% 60%)",
                        TP1: "hsl(142 76% 36%)",
                        TP2: "hsl(142 76% 46%)",
                        TP3: "hsl(142 76% 56%)",
                        TP4: "hsl(142 76% 66%)",
                        TRAILING_SL: "hsl(45 93% 47%)",
                        OPEN: "hsl(220 14% 50%)",
                        MANUAL: "hsl(280 65% 60%)",
                      };
                      return Object.keys(counts).map((key, index) => (
                        <Cell key={`cell-${index}`} fill={colors[key] || `hsl(${index * 40} 70% 50%)`} />
                      ));
                    })()}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number) => [value, "Trades"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Returns */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Monthly Returns</CardTitle>
            <CardDescription>Profit/loss aggregated by month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(() => {
                    const monthly: Record<string, number> = {};
                    results.trades.forEach((t) => {
                      const date = new Date(t.exitTime);
                      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                      monthly[key] = (monthly[key] || 0) + t.profit;
                    });
                    return Object.entries(monthly)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([month, profit]) => ({ month, profit }));
                  })()}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Profit/Loss"]}
                  />
                  <Bar dataKey="profit">
                    {(() => {
                      const monthly: Record<string, number> = {};
                      results.trades.forEach((t) => {
                        const date = new Date(t.exitTime);
                        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                        monthly[key] = (monthly[key] || 0) + t.profit;
                      });
                      return Object.entries(monthly)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([, profit], index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={profit >= 0 ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)"}
                          />
                        ));
                    })()}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Trade History</CardTitle>
          <CardDescription>All executed trades during the backtest period</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Symbol</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Direction</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Entry</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Exit</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Pips</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">P/L</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {results.trades.map((trade, i) => {
                  const isWin = trade.profit >= 0;
                  return (
                    <tr
                      key={trade.id}
                      className="border-b last:border-0"
                      data-testid={`row-trade-${i}`}
                    >
                      <td className="px-4 py-3 font-medium">{trade.symbol}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={trade.direction === "buy" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {trade.direction.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">{trade.entryPrice.toFixed(5)}</td>
                      <td className="px-4 py-3 text-right">{trade.exitPrice.toFixed(5)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            trade.exitReason.startsWith("tp")
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                          }`}
                        >
                          {trade.exitReason.toUpperCase()}
                        </Badge>
                      </td>
                      <td
                        className={`px-4 py-3 text-right ${
                          isWin
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {isWin ? "+" : ""}
                        {trade.pips.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 ${
                            isWin
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isWin ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {formatCurrency(Math.abs(trade.profit))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(trade.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
