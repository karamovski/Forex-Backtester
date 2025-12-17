import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as readline from "readline";
import {
  Tick,
  runBacktestCore,
  parseTick,
  ProgressCallback,
} from "../shared/backtest-core";
import type {
  TickFormat,
  StrategyConfig,
  RiskConfig,
  ParsedSignal,
} from "../shared/schema";

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === "development";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Forex Signal Backtester",
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("dialog:openTickFiles", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "CSV Files", extensions: ["csv", "txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
    title: "Select Tick Data Files",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, filePaths: [] };
  }

  return { canceled: false, filePaths: result.filePaths };
});

ipcMain.handle("file:readTickData", async (_event, filePath: string) => {
  try {
    const stat = fs.statSync(filePath);
    const fileSizeBytes = stat.size;
    
    const fileHandle = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = fs.readSync(fileHandle, buffer, 0, buffer.length, 0);
    fs.closeSync(fileHandle);
    
    const preview = buffer.slice(0, bytesRead).toString("utf-8");
    const previewLines = preview.split("\n").filter(l => l.trim());
    const sampleRows = previewLines.slice(0, 10);
    
    const avgLineLen = preview.length / Math.max(previewLines.length, 1);
    const estimatedRowCount = Math.ceil(fileSizeBytes / Math.max(avgLineLen, 50));
    
    return {
      success: true,
      filePath,
      fileName: path.basename(filePath),
      fileSizeBytes,
      estimatedRowCount,
      sampleRows,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read file",
    };
  }
});

ipcMain.handle("file:streamTickContent", async (_event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read file",
    };
  }
});

interface BacktestRequest {
  tickFilePaths: string[];
  tickFormat: TickFormat;
  parsedSignals: ParsedSignal[];
  strategy: StrategyConfig;
  risk: RiskConfig;
  gmtOffset: number;
}

async function* createTickGenerator(
  filePaths: string[],
  tickFormat: TickFormat
): AsyncGenerator<Tick> {
  for (const filePath of filePaths) {
    const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lineNumber = 0;
    for await (const line of rl) {
      lineNumber++;
      if (lineNumber === 1 && tickFormat.hasHeader) continue;
      if (!line.trim()) continue;

      const tick = parseTick(line, tickFormat);
      if (tick) {
        yield tick;
      }
    }
  }
}

ipcMain.handle("backtest:run", async (event, request: BacktestRequest) => {
  try {
    const { tickFilePaths, tickFormat, parsedSignals, strategy, risk } = request;
    
    if (!tickFilePaths || tickFilePaths.length === 0) {
      return { success: false, error: "No tick data files provided" };
    }

    if (!parsedSignals || parsedSignals.length === 0) {
      return { success: false, error: "No signals provided" };
    }

    const tickGenerator = createTickGenerator(tickFilePaths, tickFormat);

    const onProgress: ProgressCallback = (progress) => {
      event.sender.send("backtest:progress", progress);
    };

    const results = await runBacktestCore(
      tickGenerator,
      parsedSignals,
      strategy,
      risk,
      onProgress
    );

    return { success: true, results };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Backtest failed",
    };
  }
});
