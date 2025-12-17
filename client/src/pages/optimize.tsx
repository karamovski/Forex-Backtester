import { useState } from "react";
import { Play, Settings, TrendingUp, Loader2, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useBacktestStore } from "@/lib/backtest-store";
import { useToast } from "@/hooks/use-toast";
import type { StrategyConfig, RiskConfig, BacktestResults } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface OptimizationResult {
  id: string;
  riskPercentage: number;
  moveSLAfterTP: number | undefined;
  trailingSL: boolean;
  useMultipleTPs: boolean;
  partialClosePercent: number;
  finalBalance: number;
  profitPercent: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;
  totalTrades: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function Optimize() {
  const { signals, risk, strategy, setResults, setRisk, setStrategy } = useBacktestStore();
  const { toast } = useToast();
  
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setOptResults] = useState<OptimizationResult[]>([]);
  const [sortBy, setSortBy] = useState<keyof OptimizationResult>("profitPercent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  const [riskRange, setRiskRange] = useState({ min: 0.5, max: 3, step: 0.5 });
  const [testBreakeven, setTestBreakeven] = useState(true);
  const [testTrailing, setTestTrailing] = useState(true);
  const [testMultiTP, setTestMultiTP] = useState(true);
  const [testPartialClose, setTestPartialClose] = useState(true);

  const generateCombinations = () => {
    const combinations: Array<{
      riskPercentage: number;
      moveSLAfterTP: number | undefined;
      trailingSL: boolean;
      useMultipleTPs: boolean;
      partialClosePercent: number;
    }> = [];

    const riskLevels: number[] = [];
    for (let r = riskRange.min; r <= riskRange.max; r += riskRange.step) {
      riskLevels.push(Math.round(r * 100) / 100);
    }

    const breakevenOptions = testBreakeven ? [undefined, 1, 2] : [strategy.moveSLAfterTP];
    const trailingOptions = testTrailing ? [false, true] : [strategy.trailingSL];
    const multiTPOptions = testMultiTP ? [false, true] : [strategy.useMultipleTPs];
    const partialOptions = testPartialClose ? [25, 33, 50] : [strategy.partialClosePercent];

    for (const riskPct of riskLevels) {
      for (const beTP of breakevenOptions) {
        for (const trailing of trailingOptions) {
          for (const multiTP of multiTPOptions) {
            for (const partial of partialOptions) {
              combinations.push({
                riskPercentage: riskPct,
                moveSLAfterTP: beTP,
                trailingSL: trailing,
                useMultipleTPs: multiTP,
                partialClosePercent: partial,
              });
            }
          }
        }
      }
    }

    return combinations;
  };

  const runOptimization = async () => {
    if (!signals.parsedSignals || signals.parsedSignals.length === 0) {
      toast({
        title: "No Signals",
        description: "Please parse signals before running optimization",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setOptResults([]);

    const combinations = generateCombinations();
    const totalCombinations = combinations.length;

    toast({
      title: "Optimization Started",
      description: `Testing ${totalCombinations} parameter combinations...`,
    });

    const allResults: OptimizationResult[] = [];

    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];

      const testStrategy: StrategyConfig = {
        ...strategy,
        moveSLToEntry: combo.moveSLAfterTP !== undefined,
        moveSLAfterTP: combo.moveSLAfterTP,
        trailingSL: combo.trailingSL,
        trailingPips: combo.trailingSL ? 15 : undefined,
        useMultipleTPs: combo.useMultipleTPs,
        activeTPs: combo.useMultipleTPs ? [1, 2, 3] : [1],
        closePartials: combo.useMultipleTPs,
        partialClosePercent: combo.partialClosePercent,
      };

      const testRisk: RiskConfig = {
        ...risk,
        riskType: "percentage",
        riskPercentage: combo.riskPercentage,
      };

      try {
        const response = await apiRequest("POST", "/api/backtest", {
          signals: signals.parsedSignals,
          strategy: testStrategy,
          risk: testRisk,
        });
        const backtestResult: BacktestResults = await response.json();

        const profitPercent =
          ((backtestResult.finalBalance - backtestResult.initialBalance) /
            backtestResult.initialBalance) *
          100;

        allResults.push({
          id: `opt-${i}`,
          riskPercentage: combo.riskPercentage,
          moveSLAfterTP: combo.moveSLAfterTP,
          trailingSL: combo.trailingSL,
          useMultipleTPs: combo.useMultipleTPs,
          partialClosePercent: combo.partialClosePercent,
          finalBalance: backtestResult.finalBalance,
          profitPercent,
          winRate: backtestResult.winRate,
          maxDrawdown: backtestResult.maxDrawdownEquityPercent,
          profitFactor: backtestResult.profitFactor,
          totalTrades: backtestResult.totalTrades,
        });
      } catch (error) {
        console.error("Optimization iteration failed:", error);
      }

      setProgress(((i + 1) / totalCombinations) * 100);
    }

    setOptResults(allResults);
    setIsRunning(false);

    toast({
      title: "Optimization Complete",
      description: `Tested ${totalCombinations} combinations. Best result: ${formatCurrency(
        allResults.sort((a, b) => b.profitPercent - a.profitPercent)[0]?.finalBalance || 0
      )}`,
    });
  };

  const applySettings = (result: OptimizationResult) => {
    setRisk({
      riskType: "percentage",
      riskPercentage: result.riskPercentage,
    });
    setStrategy({
      moveSLToEntry: result.moveSLAfterTP !== undefined,
      moveSLAfterTP: result.moveSLAfterTP,
      trailingSL: result.trailingSL,
      trailingPips: result.trailingSL ? 15 : undefined,
      useMultipleTPs: result.useMultipleTPs,
      activeTPs: result.useMultipleTPs ? [1, 2, 3] : [1],
      closePartials: result.useMultipleTPs,
      partialClosePercent: result.partialClosePercent,
    });

    toast({
      title: "Settings Applied",
      description: "The optimized parameters have been applied to your strategy.",
    });
  };

  const sortedResults = [...results].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    }
    return 0;
  });

  const handleSort = (key: keyof OptimizationResult) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
  };

  const combinationCount = generateCombinations().length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Optimization Mode</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Test multiple parameter combinations to find optimal settings
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Optimization Parameters</CardTitle>
            </div>
            <CardDescription>Configure which parameters to test</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-sm font-medium">Risk Percentage Range</Label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="risk-min" className="text-xs text-muted-foreground">
                    Min %
                  </Label>
                  <Input
                    id="risk-min"
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="10"
                    value={riskRange.min}
                    onChange={(e) =>
                      setRiskRange({ ...riskRange, min: parseFloat(e.target.value) || 0.5 })
                    }
                    className="font-mono"
                    data-testid="input-risk-min"
                  />
                </div>
                <div>
                  <Label htmlFor="risk-max" className="text-xs text-muted-foreground">
                    Max %
                  </Label>
                  <Input
                    id="risk-max"
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="10"
                    value={riskRange.max}
                    onChange={(e) =>
                      setRiskRange({ ...riskRange, max: parseFloat(e.target.value) || 3 })
                    }
                    className="font-mono"
                    data-testid="input-risk-max"
                  />
                </div>
                <div>
                  <Label htmlFor="risk-step" className="text-xs text-muted-foreground">
                    Step
                  </Label>
                  <Input
                    id="risk-step"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5"
                    value={riskRange.step}
                    onChange={(e) =>
                      setRiskRange({ ...riskRange, step: parseFloat(e.target.value) || 0.5 })
                    }
                    className="font-mono"
                    data-testid="input-risk-step"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-medium">Parameters to Test</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="test-breakeven" className="font-normal cursor-pointer">
                    Breakeven settings (none, TP1, TP2)
                  </Label>
                  <Switch
                    id="test-breakeven"
                    checked={testBreakeven}
                    onCheckedChange={setTestBreakeven}
                    data-testid="switch-test-breakeven"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="test-trailing" className="font-normal cursor-pointer">
                    Trailing stop loss (on/off)
                  </Label>
                  <Switch
                    id="test-trailing"
                    checked={testTrailing}
                    onCheckedChange={setTestTrailing}
                    data-testid="switch-test-trailing"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="test-multi-tp" className="font-normal cursor-pointer">
                    Multiple take profits (on/off)
                  </Label>
                  <Switch
                    id="test-multi-tp"
                    checked={testMultiTP}
                    onCheckedChange={setTestMultiTP}
                    data-testid="switch-test-multi-tp"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="test-partial" className="font-normal cursor-pointer">
                    Partial close percentages (25%, 33%, 50%)
                  </Label>
                  <Switch
                    id="test-partial"
                    checked={testPartialClose}
                    onCheckedChange={setTestPartialClose}
                    data-testid="switch-test-partial"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Total combinations:</span>
                <Badge variant="secondary" className="font-mono">
                  {combinationCount}
                </Badge>
              </div>
              <Button
                className="w-full gap-2"
                onClick={runOptimization}
                disabled={isRunning || !signals.parsedSignals?.length}
                data-testid="button-run-optimization"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running Optimization...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Optimization
                  </>
                )}
              </Button>
              {isRunning && (
                <div className="mt-4 space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    {Math.round(progress)}% complete
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Optimization Results</CardTitle>
            </div>
            <CardDescription>
              {results.length > 0
                ? `${results.length} combinations tested. Click a row to apply settings.`
                : "Results will appear here after optimization"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <Settings className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No optimization results yet</p>
                <p className="text-xs mt-1">Configure parameters and run optimization</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b">
                      <th
                        className="px-2 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort("riskPercentage")}
                      >
                        <div className="flex items-center gap-1">
                          Risk%
                          {sortBy === "riskPercentage" && <ArrowUpDown className="h-3 w-3" />}
                        </div>
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-muted-foreground">Config</th>
                      <th
                        className="px-2 py-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort("profitPercent")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Profit%
                          {sortBy === "profitPercent" && <ArrowUpDown className="h-3 w-3" />}
                        </div>
                      </th>
                      <th
                        className="px-2 py-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort("winRate")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Win%
                          {sortBy === "winRate" && <ArrowUpDown className="h-3 w-3" />}
                        </div>
                      </th>
                      <th
                        className="px-2 py-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort("maxDrawdown")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          DD%
                          {sortBy === "maxDrawdown" && <ArrowUpDown className="h-3 w-3" />}
                        </div>
                      </th>
                      <th
                        className="px-2 py-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort("profitFactor")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          PF
                          {sortBy === "profitFactor" && <ArrowUpDown className="h-3 w-3" />}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {sortedResults.map((result, i) => {
                      const isProfit = result.profitPercent >= 0;
                      return (
                        <tr
                          key={result.id}
                          className="border-b last:border-0 cursor-pointer hover-elevate"
                          onClick={() => applySettings(result)}
                          data-testid={`row-optimization-${i}`}
                        >
                          <td className="px-2 py-2">{result.riskPercentage.toFixed(1)}%</td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              {result.moveSLAfterTP !== undefined && (
                                <Badge variant="secondary" className="text-xs px-1">
                                  BE@TP{result.moveSLAfterTP}
                                </Badge>
                              )}
                              {result.trailingSL && (
                                <Badge variant="secondary" className="text-xs px-1">
                                  Trail
                                </Badge>
                              )}
                              {result.useMultipleTPs && (
                                <Badge variant="secondary" className="text-xs px-1">
                                  Multi
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td
                            className={`px-2 py-2 text-right ${
                              isProfit
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {isProfit ? "+" : ""}
                            {result.profitPercent.toFixed(1)}%
                          </td>
                          <td className="px-2 py-2 text-right">{result.winRate.toFixed(0)}%</td>
                          <td className="px-2 py-2 text-right text-red-600 dark:text-red-400">
                            -{result.maxDrawdown.toFixed(1)}%
                          </td>
                          <td className="px-2 py-2 text-right">{result.profitFactor.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
