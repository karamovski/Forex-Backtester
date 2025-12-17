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
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBacktestStore } from "@/lib/backtest-store";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
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

export default function Results() {
  const { results, risk } = useBacktestStore();

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

  const chartData = results.equityCurve.map((point) => ({
    ...point,
    time: new Date(point.time).toLocaleDateString(),
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Backtest Results</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulated performance analysis from {results.totalTrades} trades
          </p>
        </div>
        <Badge
          variant={isProfit ? "default" : "destructive"}
          className="text-sm px-3 py-1 gap-1"
        >
          {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {formatPercent(profitLossPercent)}
        </Badge>
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
                <AreaChart data={chartData}>
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
                    formatter={(value: number) => [formatCurrency(value), "Equity"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke={isProfit ? "hsl(142 76% 36%)" : "hsl(0 84% 60%)"}
                    strokeWidth={2}
                    fill="url(#equityGradient)"
                  />
                </AreaChart>
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
