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
  // Tick data setup
  tickDataId: string | null;
  tickDataContent: string | null;
  tickFilePaths: string[];
  tickDataLoaded: boolean;
  tickRowCount: number;
  tickSampleRows: string[];
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
  progressMessage: string;
  
  // Results
  results: BacktestResults | null;
  
  // Actions
  setTickDataId: (id: string | null) => void;
  setTickDataContent: (content: string | null) => void;
  setTickFilePaths: (paths: string[]) => void;
  setTickDataLoaded: (loaded: boolean, rowCount?: number) => void;
  setTickSampleRows: (rows: string[]) => void;
  setTickFormat: (format: TickFormat | null) => void;
  setSignalsContent: (content: string) => void;
  setSignalFormatPattern: (pattern: string) => void;
  setSignalFormat: (format: SignalFormat | null) => void;
  setParsedSignals: (signals: ParsedSignal[]) => void;
  setStrategy: (strategy: Partial<StrategyConfig>) => void;
  setRisk: (risk: Partial<RiskConfig>) => void;
  setGmtOffset: (offset: number) => void;
  setIsRunning: (running: boolean) => void;
  setProgress: (progress: number, message?: string) => void;
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
  tickDataId: null,
  tickDataContent: null,
  tickFilePaths: [],
  tickDataLoaded: false,
  tickRowCount: 0,
  tickSampleRows: [],
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
  progressMessage: "",
  results: null,
  
  // Actions
  setTickDataId: (id) => set({ tickDataId: id }),
  setTickDataContent: (content) => set({ tickDataContent: content }),
  setTickFilePaths: (paths) => set({ tickFilePaths: paths }),
  setTickDataLoaded: (loaded, rowCount) => set({ tickDataLoaded: loaded, tickRowCount: rowCount ?? 0 }),
  setTickSampleRows: (rows) => set({ tickSampleRows: rows }),
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
  setProgress: (progress, message) =>
    set({ progress, progressMessage: message ?? "" }),
  setResults: (results) => set({ results }),
  resetAll: () =>
    set({
      tickDataId: null,
      tickDataContent: null,
      tickFilePaths: [],
      tickDataLoaded: false,
      tickRowCount: 0,
      tickSampleRows: [],
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
      progressMessage: "",
      results: null,
    }),
}));
