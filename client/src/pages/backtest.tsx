import { Play, AlertCircle, Check, X, Loader2, Settings, FileText, Target, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useBacktestStore } from "@/lib/backtest-store";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BacktestResults } from "@shared/schema";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  isComplete: boolean;
  icon: React.ComponentType<{ className?: string }>;
  link: string;
}

export default function Backtest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const {
    tickDataId,
    tickDataLoaded,
    tickRowCount,
    tickFormat,
    signalFormat,
    parsedSignals,
    strategy,
    risk,
    gmtOffset,
    isRunning,
    progress,
    progressMessage,
    setIsRunning,
    setProgress,
    setResults,
  } = useBacktestStore();

  const checklist: ChecklistItem[] = [
    {
      id: "data",
      label: "Tick Data Uploaded",
      description: tickDataLoaded ? `${tickRowCount.toLocaleString()} ticks loaded` : "Upload tick data file",
      isComplete: tickDataLoaded && !!tickFormat,
      icon: Settings,
      link: "/",
    },
    {
      id: "signals",
      label: "Signals Parsed",
      description: `${parsedSignals.length} signals ready`,
      isComplete: parsedSignals.length > 0 && !!signalFormat,
      icon: FileText,
      link: "/signals",
    },
    {
      id: "strategy",
      label: "Strategy Configured",
      description: `${strategy.activeTPs.length} TP levels active`,
      isComplete: strategy.activeTPs.length > 0,
      icon: Target,
      link: "/strategy",
    },
    {
      id: "risk",
      label: "Risk Settings",
      description: `$${risk.initialBalance.toLocaleString()} balance`,
      isComplete: risk.initialBalance > 0,
      icon: DollarSign,
      link: "/risk",
    },
  ];

  const allComplete = checklist.every((item) => item.isComplete);

  const backtestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/backtest/run", {
        tickDataId,
        tickFormat,
        strategy,
        risk,
        gmtOffset,
        parsedSignals,
      });
      return response as unknown as BacktestResults;
    },
    onMutate: () => {
      setIsRunning(true);
      setProgress(0);
    },
    onSuccess: (data) => {
      setIsRunning(false);
      setProgress(100);
      setResults(data);
      setLocation("/results");
    },
    onError: (error: Error) => {
      setIsRunning(false);
      setProgress(0);
      toast({
        title: "Backtest Failed",
        description: error.message || "An error occurred during the backtest. Please check your configuration.",
        variant: "destructive",
      });
    },
  });

  const handleRunBacktest = () => {
    if (!allComplete) return;
    backtestMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Run Backtest</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verify your configuration and simulate trades based on your signals and strategy
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Configuration Checklist</CardTitle>
            <CardDescription>
              All items must be complete before running the backtest
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((item) => (
              <button
                key={item.id}
                onClick={() => setLocation(item.link)}
                className={`w-full flex items-center gap-4 p-4 rounded-md border text-left transition-colors hover-elevate active-elevate-2 ${
                  item.isComplete ? "bg-muted/30" : "bg-destructive/5 border-destructive/20"
                }`}
                data-testid={`checklist-${item.id}`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-md ${
                    item.isComplete
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {item.isComplete ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <item.icon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.label}</span>
                    {item.isComplete && (
                      <Badge variant="secondary" className="text-xs">
                        Complete
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Backtest Summary</CardTitle>
            <CardDescription>Overview of your backtest configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-md bg-muted/30 border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Total Signals
                </div>
                <div className="text-xl font-mono font-semibold mt-1">
                  {parsedSignals.length}
                </div>
              </div>
              <div className="p-3 rounded-md bg-muted/30 border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Starting Balance
                </div>
                <div className="text-xl font-mono font-semibold mt-1">
                  ${risk.initialBalance.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-md bg-muted/30 border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Risk Type
                </div>
                <div className="text-sm font-medium mt-1">
                  {risk.riskType === "percentage"
                    ? `${risk.riskPercentage}%`
                    : risk.riskType === "fixed_lot"
                    ? `${risk.fixedLotSize} lots`
                    : "Rule-based"}
                </div>
              </div>
              <div className="p-3 rounded-md bg-muted/30 border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Active TPs
                </div>
                <div className="flex gap-1 mt-1">
                  {strategy.activeTPs.map((tp) => (
                    <Badge key={tp} variant="secondary" className="text-xs">
                      TP{tp}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {!allComplete && (
              <div className="flex items-start gap-3 p-4 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Configuration Incomplete
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please complete all checklist items before running the backtest.
                  </p>
                </div>
              </div>
            )}

            {backtestMutation.isError && (
              <div className="flex items-start gap-3 p-4 rounded-md bg-destructive/10 border border-destructive/20">
                <X className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Backtest Failed</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    An error occurred while running the backtest. Please check your configuration and try again.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isRunning ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Running Backtest...</p>
                    <p className="text-sm text-muted-foreground">
                      {progressMessage || "Processing signals..."}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {progress}%
                </Badge>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Ready to Run</p>
                <p className="text-sm text-muted-foreground">
                  {allComplete
                    ? `Process ${parsedSignals.length} signals against tick data`
                    : "Complete all configuration items first"}
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleRunBacktest}
                disabled={!allComplete || isRunning}
                className="gap-2"
                data-testid="button-run-backtest"
              >
                <Play className="h-5 w-5" />
                Run Backtest
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
