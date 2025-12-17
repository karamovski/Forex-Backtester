import type { BacktestResults, StrategyConfig, RiskConfig } from "@shared/schema";

export interface BacktestHistoryItem {
  id: string;
  name: string;
  runAt: string;
  results: BacktestResults;
  strategy: StrategyConfig;
  risk: RiskConfig;
}

const HISTORY_KEY = "forex-backtest-history";
const MAX_HISTORY = 20;

export function getBacktestHistory(): BacktestHistoryItem[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addToHistory(
  results: BacktestResults,
  strategy: StrategyConfig,
  risk: RiskConfig,
  name?: string
): BacktestHistoryItem {
  const history = getBacktestHistory();
  
  const newItem: BacktestHistoryItem = {
    id: crypto.randomUUID(),
    name: name || `Backtest ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    runAt: new Date().toISOString(),
    results,
    strategy,
    risk,
  };
  
  history.unshift(newItem);
  
  if (history.length > MAX_HISTORY) {
    history.pop();
  }
  
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return newItem;
}

export function deleteFromHistory(id: string): boolean {
  const history = getBacktestHistory();
  const filtered = history.filter(h => h.id !== id);
  if (filtered.length === history.length) return false;
  
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  return true;
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

export function getHistoryById(id: string): BacktestHistoryItem | null {
  const history = getBacktestHistory();
  return history.find(h => h.id === id) || null;
}

export function renameHistoryItem(id: string, newName: string): boolean {
  const history = getBacktestHistory();
  const index = history.findIndex(h => h.id === id);
  if (index === -1) return false;
  
  history[index].name = newName;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return true;
}
