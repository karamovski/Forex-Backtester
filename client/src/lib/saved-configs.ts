import type {
  TickFormat,
  SignalFormat,
  StrategyConfig,
  RiskConfig,
} from "@shared/schema";

export interface SavedConfig {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  tickFormat: TickFormat | null;
  signalFormat: SignalFormat | null;
  signalFormatPattern: string;
  strategy: StrategyConfig;
  risk: RiskConfig;
  gmtOffset: number;
}

const STORAGE_KEY = "forex-backtest-configs";

export function getSavedConfigs(): SavedConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveConfig(config: Omit<SavedConfig, "id" | "createdAt">): SavedConfig {
  const configs = getSavedConfigs();
  const newConfig: SavedConfig = {
    ...config,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  configs.push(newConfig);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  return newConfig;
}

export function updateConfig(id: string, updates: Partial<Omit<SavedConfig, "id" | "createdAt">>): SavedConfig | null {
  const configs = getSavedConfigs();
  const index = configs.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  configs[index] = { ...configs[index], ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  return configs[index];
}

export function deleteConfig(id: string): boolean {
  const configs = getSavedConfigs();
  const filtered = configs.filter(c => c.id !== id);
  if (filtered.length === configs.length) return false;
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

export function getConfigById(id: string): SavedConfig | null {
  const configs = getSavedConfigs();
  return configs.find(c => c.id === id) || null;
}
