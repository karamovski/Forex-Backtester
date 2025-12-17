import { create } from "zustand";
import type {
  TickFormat,
  SignalFormat,
  StrategyConfig,
  RiskConfig,
  BacktestResults,
  ParsedSignal,
} from "@shared/schema";

interface BacktestState {
  // Data setup
  ticksFolder: string;
  tickSampleLines: string[];
  tickFormat: TickFormat | null;
  
  // Signal configuration
  signalsContent: string;
  signalFormatPattern: string;
  signalFormat: SignalFormat | null;
  parsedSignals: ParsedSignal[];
  
  // Strategy configuration
  strategy: StrategyConfig;
  
  // Risk configuration
  risk: RiskConfig;
  
  // Timezone
  gmtOffset: number;
  
  // Backtest state
  isRunning: boolean;
  progress: number;
  currentFile: string;
  
  // Results
  results: BacktestResults | null;
  
  // Actions
  setTicksFolder: (folder: string) => void;
  setTickSampleLines: (lines: string[]) => void;
  setTickFormat: (format: TickFormat | null) => void;
  setSignalsContent: (content: string) => void;
  setSignalFormatPattern: (pattern: string) => void;
  setSignalFormat: (format: SignalFormat | null) => void;
  setParsedSignals: (signals: ParsedSignal[]) => void;
  setStrategy: (strategy: Partial<StrategyConfig>) => void;
  setRisk: (risk: Partial<RiskConfig>) => void;
  setGmtOffset: (offset: number) => void;
  setIsRunning: (running: boolean) => void;
  setProgress: (progress: number, currentFile?: string) => void;
  setResults: (results: BacktestResults | null) => void;
  resetAll: () => void;
}

const defaultStrategy: StrategyConfig = {
  moveSLToEntry: false,
  moveSLAfterTP: undefined,
  moveSLAfterPips: undefined,
  trailingSL: false,
  trailingPips: undefined,
  useMultipleTPs: true,
  activeTPs: [1],
  closePartials: false,
  partialClosePercent: 25,
  closeAllOnTP: undefined,
};

const defaultRisk: RiskConfig = {
  initialBalance: 10000,
  riskType: "percentage",
  riskPercentage: 1,
  fixedLotSize: 0.01,
  ruleBasedAmount: 100,
  ruleBasedLot: 0.01,
};

export const useBacktestStore = create<BacktestState>((set) => ({
  // Initial state
  ticksFolder: "",
  tickSampleLines: [],
  tickFormat: null,
  signalsContent: "",
  signalFormatPattern: "",
  signalFormat: null,
  parsedSignals: [],
  strategy: defaultStrategy,
  risk: defaultRisk,
  gmtOffset: 0,
  isRunning: false,
  progress: 0,
  currentFile: "",
  results: null,
  
  // Actions
  setTicksFolder: (folder) => set({ ticksFolder: folder }),
  setTickSampleLines: (lines) => set({ tickSampleLines: lines }),
  setTickFormat: (format) => set({ tickFormat: format }),
  setSignalsContent: (content) => set({ signalsContent: content }),
  setSignalFormatPattern: (pattern) => set({ signalFormatPattern: pattern }),
  setSignalFormat: (format) => set({ signalFormat: format }),
  setParsedSignals: (signals) => set({ parsedSignals: signals }),
  setStrategy: (strategy) =>
    set((state) => ({ strategy: { ...state.strategy, ...strategy } })),
  setRisk: (risk) =>
    set((state) => ({ risk: { ...state.risk, ...risk } })),
  setGmtOffset: (offset) => set({ gmtOffset: offset }),
  setIsRunning: (running) => set({ isRunning: running }),
  setProgress: (progress, currentFile) =>
    set({ progress, currentFile: currentFile ?? "" }),
  setResults: (results) => set({ results }),
  resetAll: () =>
    set({
      ticksFolder: "",
      tickSampleLines: [],
      tickFormat: null,
      signalsContent: "",
      signalFormatPattern: "",
      signalFormat: null,
      parsedSignals: [],
      strategy: defaultStrategy,
      risk: defaultRisk,
      gmtOffset: 0,
      isRunning: false,
      progress: 0,
      currentFile: "",
      results: null,
    }),
}));
