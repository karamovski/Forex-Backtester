import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openTickFiles: () => ipcRenderer.invoke("dialog:openTickFiles"),
  
  readTickData: (filePath: string) => ipcRenderer.invoke("file:readTickData", filePath),
  
  streamTickContent: (filePath: string) => ipcRenderer.invoke("file:streamTickContent", filePath),
  
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
  }) => ipcRenderer.invoke("backtest:run", request),
  
  onBacktestProgress: (callback: (progress: {
    ticksProcessed: number;
    tradesCompleted: number;
    openTrades: number;
  }) => void) => {
    ipcRenderer.on("backtest:progress", (_event, progress) => callback(progress));
  },
  
  isElectron: true,
});
