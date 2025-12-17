export interface ElectronAPI {
  openTickFiles: () => Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;
  
  readTickData: (filePath: string) => Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    fileSizeBytes?: number;
    estimatedRowCount?: number;
    sampleRows?: string[];
    error?: string;
  }>;
  
  streamTickContent: (filePath: string) => Promise<{
    success: boolean;
    content?: string;
    error?: string;
  }>;
  
  runBacktest: (request: {
    tickFilePaths: string[];
    tickFormat: {
      dateColumn: number;
      timeColumn: number;
      bidColumn: number;
      askColumn: number;
      delimiter: string;
      dateFormat: string;
      timeFormat: string;
      hasHeader: boolean;
    };
    parsedSignals: Array<{
      id: string;
      rawText: string;
      symbol: string;
      direction: "buy" | "sell";
      entryPrice: number;
      stopLoss: number;
      takeProfits: number[];
      timestamp?: string;
    }>;
    strategy: {
      moveSLToEntry: boolean;
      moveSLAfterTP?: number;
      moveSLAfterPips?: number;
      trailingSL: boolean;
      trailingPips?: number;
      useMultipleTPs: boolean;
      activeTPs: number[];
      closePartials: boolean;
      partialClosePercent: number;
      closeAllOnTP?: number;
    };
    risk: {
      initialBalance: number;
      riskType: "percentage" | "fixed_lot" | "rule_based";
      riskPercentage?: number;
      fixedLotSize?: number;
      ruleBasedAmount?: number;
      ruleBasedLot?: number;
    };
    gmtOffset: number;
  }) => Promise<{
    success: boolean;
    results?: import("@shared/schema").BacktestResults;
    error?: string;
  }>;
  
  onBacktestProgress: (callback: (progress: {
    ticksProcessed: number;
    tradesCompleted: number;
    openTrades: number;
  }) => void) => void;
  
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
