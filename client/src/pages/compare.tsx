import { useState } from "react";
import {
  BarChart3,
  Trash2,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Edit2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getBacktestHistory,
  deleteFromHistory,
  clearHistory,
  renameHistoryItem,
  type BacktestHistoryItem,
} from "@/lib/backtest-history";
import { useToast } from "@/hooks/use-toast";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

interface ComparisonMetric {
  label: string;
  getValue: (item: BacktestHistoryItem) => string | number;
  format?: (value: number) => string;
  higherIsBetter?: boolean;
}

const metrics: ComparisonMetric[] = [
  { label: "Final Balance", getValue: (i) => i.results.finalBalance, format: formatCurrency, higherIsBetter: true },
  { label: "Return %", getValue: (i) => ((i.results.finalBalance - i.results.initialBalance) / i.results.initialBalance) * 100, format: (v) => formatPercent(v), higherIsBetter: true },
  { label: "Win Rate", getValue: (i) => i.results.winRate, format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
  { label: "Profit Factor", getValue: (i) => i.results.profitFactor, format: (v) => v.toFixed(2), higherIsBetter: true },
  { label: "Total Trades", getValue: (i) => i.results.totalTrades },
  { label: "Winning Trades", getValue: (i) => i.results.winningTrades, higherIsBetter: true },
  { label: "Losing Trades", getValue: (i) => i.results.losingTrades, higherIsBetter: false },
  { label: "Total Pips", getValue: (i) => i.results.totalPips, format: (v) => v.toFixed(1), higherIsBetter: true },
  { label: "Max DD (Equity)", getValue: (i) => i.results.maxDrawdownEquityPercent, format: (v) => `-${v.toFixed(2)}%`, higherIsBetter: false },
  { label: "Avg Win", getValue: (i) => i.results.averageWin, format: formatCurrency, higherIsBetter: true },
  { label: "Avg Loss", getValue: (i) => i.results.averageLoss, format: formatCurrency, higherIsBetter: false },
  { label: "Largest Win", getValue: (i) => i.results.largestWin, format: formatCurrency, higherIsBetter: true },
  { label: "Largest Loss", getValue: (i) => i.results.largestLoss, format: formatCurrency, higherIsBetter: false },
];

export default function Compare() {
  const { toast } = useToast();
  const [history, setHistory] = useState<BacktestHistoryItem[]>(getBacktestHistory());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const refreshHistory = () => {
    setHistory(getBacktestHistory());
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = (id: string) => {
    deleteFromHistory(id);
    selectedIds.delete(id);
    setSelectedIds(new Set(selectedIds));
    refreshHistory();
    toast({ title: "Deleted", description: "Backtest removed from history" });
  };

  const handleClearAll = () => {
    clearHistory();
    setSelectedIds(new Set());
    refreshHistory();
    toast({ title: "Cleared", description: "All backtest history cleared" });
  };

  const startEditing = (item: BacktestHistoryItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      renameHistoryItem(editingId, editName.trim());
      refreshHistory();
    }
    setEditingId(null);
    setEditName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const selectedItems = history.filter((h) => selectedIds.has(h.id));

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <BarChart3 className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold text-center">No Backtest History</h2>
        <p className="text-sm text-muted-foreground text-center mt-2 max-w-md">
          Run some backtests to see your history here. You can compare different strategies side-by-side.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Compare Backtests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select backtests to compare their performance side-by-side
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{history.length} saved</Badge>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1" data-testid="button-clear-history">
                <Trash2 className="h-4 w-4" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all saved backtest results. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll}>Clear All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Backtest History</CardTitle>
            <CardDescription>
              Select 2 or more to compare ({selectedIds.size} selected)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 p-4 pt-0">
                {history.map((item) => {
                  const profitLoss = item.results.finalBalance - item.results.initialBalance;
                  const isProfit = profitLoss >= 0;
                  const isSelected = selectedIds.has(item.id);
                  const isEditing = editingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/5 border-primary/30" : "hover-elevate"
                      }`}
                      onClick={() => !isEditing && toggleSelect(item.id)}
                      data-testid={`history-item-${item.id}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`checkbox-${item.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{item.name}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                onClick={(e) => { e.stopPropagation(); startEditing(item); }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{new Date(item.runAt).toLocaleDateString()}</span>
                              <span className={isProfit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                {formatPercent((profitLoss / item.results.initialBalance) * 100)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          {isProfit ? (
                            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            data-testid={`delete-${item.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Comparison</CardTitle>
            <CardDescription>
              {selectedItems.length < 2
                ? "Select at least 2 backtests to compare"
                : `Comparing ${selectedItems.length} backtests`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedItems.length < 2 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Select 2 or more backtests from the list</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground sticky left-0 bg-card">
                          Metric
                        </th>
                        {selectedItems.map((item) => (
                          <th key={item.id} className="text-right py-2 px-3 font-medium min-w-[120px]">
                            <div className="truncate max-w-[120px]">{item.name}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((metric) => {
                        const values = selectedItems.map((item) => {
                          const raw = metric.getValue(item);
                          return typeof raw === "number" ? raw : parseFloat(String(raw)) || 0;
                        });
                        const best = metric.higherIsBetter !== undefined
                          ? metric.higherIsBetter
                            ? Math.max(...values)
                            : Math.min(...values)
                          : null;

                        return (
                          <tr key={metric.label} className="border-b last:border-0">
                            <td className="py-2 px-2 text-muted-foreground sticky left-0 bg-card">
                              {metric.label}
                            </td>
                            {selectedItems.map((item, idx) => {
                              const raw = metric.getValue(item);
                              const value = typeof raw === "number" ? raw : parseFloat(String(raw)) || 0;
                              const isBest = best !== null && value === best && values.filter(v => v === best).length === 1;
                              const display = metric.format ? metric.format(value) : String(raw);

                              return (
                                <td
                                  key={item.id}
                                  className={`text-right py-2 px-3 font-mono ${
                                    isBest ? "text-primary font-semibold" : ""
                                  }`}
                                >
                                  {display}
                                  {isBest && <span className="ml-1 text-xs">★</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
