"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var path = __toESM(require("path"), 1);
var fs = __toESM(require("fs"), 1);
var mainWindow = null;
var isDev = process.env.NODE_ENV === "development";
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1e3,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: "Forex Signal Backtester",
    show: false
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
import_electron.app.whenReady().then(() => {
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});
import_electron.ipcMain.handle("dialog:openTickFiles", async () => {
  const result = await import_electron.dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "CSV Files", extensions: ["csv", "txt"] },
      { name: "All Files", extensions: ["*"] }
    ],
    title: "Select Tick Data Files"
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, filePaths: [] };
  }
  return { canceled: false, filePaths: result.filePaths };
});
import_electron.ipcMain.handle("file:readTickData", async (_event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    const fileSizeBytes = stat.size;
    const fileHandle = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = fs.readSync(fileHandle, buffer, 0, buffer.length, 0);
    fs.closeSync(fileHandle);
    const preview = buffer.slice(0, bytesRead).toString("utf-8");
    const previewLines = preview.split("\n").filter((l) => l.trim());
    const sampleRows = previewLines.slice(0, 10);
    const avgLineLen = preview.length / Math.max(previewLines.length, 1);
    const estimatedRowCount = Math.ceil(fileSizeBytes / Math.max(avgLineLen, 50));
    return {
      success: true,
      filePath,
      fileName: path.basename(filePath),
      fileSizeBytes,
      estimatedRowCount,
      sampleRows
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read file"
    };
  }
});
import_electron.ipcMain.handle("file:streamTickContent", async (_event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read file"
    };
  }
});
function getPipValue(symbol) {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol.includes("JPY")) return 0.01;
  if (upperSymbol.includes("XAU") || upperSymbol.includes("GOLD")) return 0.1;
  return 1e-4;
}
function calculatePips(entryPrice, exitPrice, direction, symbol) {
  const pipValue = getPipValue(symbol);
  const priceDiff = direction === "buy" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return priceDiff / pipValue;
}
function calculateLotSize(riskConfig, balance, stopLossPips) {
  switch (riskConfig.riskType) {
    case "percentage": {
      const riskAmount = balance * ((riskConfig.riskPercentage || 1) / 100);
      const pipValuePerLot = 10;
      const lots = riskAmount / (Math.abs(stopLossPips) * pipValuePerLot);
      return Math.max(0.01, Math.round(lots * 100) / 100);
    }
    case "fixed_lot":
      return riskConfig.fixedLotSize || 0.01;
    case "rule_based": {
      const ruleAmount = riskConfig.ruleBasedAmount || 100;
      const ruleLot = riskConfig.ruleBasedLot || 0.01;
      const multiplier = Math.floor(balance / ruleAmount);
      return Math.max(0.01, multiplier * ruleLot);
    }
    default:
      return 0.01;
  }
}
function calculateProfit(pips, lotSize) {
  return pips * 10 * lotSize;
}
function parseTimestamp(dateStr, timeStr) {
  const dateParts = dateStr.split(/[-./]/);
  const timeParts = timeStr.split(/[:.]/).map((p) => parseInt(p) || 0);
  let year, month, day;
  const p0 = parseInt(dateParts[0]) || 0;
  const p1 = parseInt(dateParts[1]) || 0;
  const p2 = parseInt(dateParts[2]) || 0;
  if (p0 > 31) {
    year = p0 < 100 ? 2e3 + p0 : p0;
    month = p1;
    day = p2;
  } else if (p2 > 31 || p2 < 100) {
    year = p2 < 100 ? 2e3 + p2 : p2;
    if (p0 > 12) {
      day = p0;
      month = p1;
    } else if (p1 > 12) {
      month = p0;
      day = p1;
    } else {
      day = p0;
      month = p1;
    }
  } else {
    year = p0 < 100 ? 2e3 + p0 : p0;
    month = p1;
    day = p2;
  }
  return new Date(
    year || 2024,
    (month || 1) - 1,
    day || 1,
    timeParts[0] || 0,
    timeParts[1] || 0,
    timeParts[2] || 0
  );
}
function parseSignalTimestamp(timestamp) {
  const [datePart, timePart] = timestamp.split(/\s+/);
  return parseTimestamp(datePart || "", timePart || "00:00:00");
}
import_electron.ipcMain.handle("backtest:run", async (event, request) => {
  try {
    const { tickFilePaths, tickFormat, parsedSignals, strategy, risk, gmtOffset } = request;
    if (!parsedSignals || parsedSignals.length === 0) {
      return { success: false, error: "No signals provided" };
    }
    const sortedSignals = [...parsedSignals].filter((s) => s.timestamp).sort((a, b) => {
      const ta = parseSignalTimestamp(a.timestamp);
      const tb = parseSignalTimestamp(b.timestamp);
      return ta.getTime() - tb.getTime();
    });
    if (sortedSignals.length === 0) {
      return { success: false, error: "No signals with timestamps found" };
    }
    const startTime = /* @__PURE__ */ new Date();
    const trades = [];
    const equityCurve = [];
    let balance = risk.initialBalance;
    let equity = balance;
    let maxEquity = equity;
    let maxBalance = balance;
    let maxDrawdownEquity = 0;
    let maxDrawdownBalance = 0;
    const openTrades = /* @__PURE__ */ new Map();
    let signalIndex = 0;
    let tickCount = 0;
    equityCurve.push({ time: startTime.toISOString(), equity: balance, balance });
    for (const filePath of tickFilePaths) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      let lineNumber = 0;
      for (const line of lines) {
        lineNumber++;
        if (lineNumber === 1 && tickFormat.hasHeader) continue;
        if (!line.trim()) continue;
        const cols = line.split(tickFormat.delimiter);
        const dateStr = cols[tickFormat.dateColumn]?.trim() || "";
        const timeStr = cols[tickFormat.timeColumn]?.trim() || "";
        const bidStr = cols[tickFormat.bidColumn]?.trim() || "";
        const askStr = cols[tickFormat.askColumn]?.trim() || "";
        const bid = parseFloat(bidStr);
        const ask = parseFloat(askStr);
        if (isNaN(bid) || isNaN(ask)) continue;
        const tick = { timestamp: parseTimestamp(dateStr, timeStr), bid, ask };
        tickCount++;
        while (signalIndex < sortedSignals.length) {
          const signal = sortedSignals[signalIndex];
          const signalTime = parseSignalTimestamp(signal.timestamp);
          if (tick.timestamp >= signalTime) {
            const entryPrice = signal.direction === "buy" ? tick.ask : tick.bid;
            const slPips = Math.abs(calculatePips(entryPrice, signal.stopLoss, signal.direction, signal.symbol));
            const lotSize = calculateLotSize(risk, balance, slPips);
            openTrades.set(signal.id, {
              signalId: signal.id,
              signal,
              entryPrice,
              entryTime: tick.timestamp,
              currentSL: signal.stopLoss,
              initialLotSize: lotSize,
              remainingLots: lotSize,
              highestPrice: entryPrice,
              lowestPrice: entryPrice,
              tpHits: [],
              realizedProfit: 0,
              weightedPips: 0
            });
            signalIndex++;
          } else {
            break;
          }
        }
        const tradesToClose = [];
        for (const [tradeId, trade] of openTrades) {
          const price = trade.signal.direction === "buy" ? tick.bid : tick.ask;
          if (trade.signal.direction === "buy") {
            trade.highestPrice = Math.max(trade.highestPrice, price);
            trade.lowestPrice = Math.min(trade.lowestPrice, price);
          } else {
            trade.lowestPrice = Math.min(trade.lowestPrice, price);
            trade.highestPrice = Math.max(trade.highestPrice, price);
          }
          let closeReason = null;
          let exitPrice = price;
          if (trade.signal.direction === "buy" && price <= trade.currentSL) {
            closeReason = "sl";
            exitPrice = trade.currentSL;
          } else if (trade.signal.direction === "sell" && price >= trade.currentSL) {
            closeReason = "sl";
            exitPrice = trade.currentSL;
          }
          if (!closeReason && strategy.useMultipleTPs) {
            for (let tpIndex = 0; tpIndex < trade.signal.takeProfits.length; tpIndex++) {
              if (trade.tpHits.includes(tpIndex)) continue;
              if (!strategy.activeTPs.includes(tpIndex + 1)) continue;
              const tp = trade.signal.takeProfits[tpIndex];
              const tpHit = trade.signal.direction === "buy" ? price >= tp : price <= tp;
              if (tpHit) {
                trade.tpHits.push(tpIndex);
                closeReason = `tp${tpIndex + 1}`;
                exitPrice = tp;
                if (strategy.moveSLToEntry && strategy.moveSLAfterTP === tpIndex + 1) {
                  trade.currentSL = trade.entryPrice;
                }
                break;
              }
            }
          }
          if (closeReason) {
            const pips = calculatePips(trade.entryPrice, exitPrice, trade.signal.direction, trade.signal.symbol);
            const profit = calculateProfit(pips, trade.remainingLots);
            balance += profit;
            equity = balance;
            if (equity > maxEquity) maxEquity = equity;
            if (balance > maxBalance) maxBalance = balance;
            const ddEquity = (maxEquity - equity) / maxEquity * 100;
            const ddBalance = (maxBalance - balance) / maxBalance * 100;
            if (ddEquity > maxDrawdownEquity) maxDrawdownEquity = ddEquity;
            if (ddBalance > maxDrawdownBalance) maxDrawdownBalance = ddBalance;
            trades.push({
              id: crypto.randomUUID(),
              signalId: trade.signalId,
              symbol: trade.signal.symbol,
              direction: trade.signal.direction,
              entryPrice: trade.entryPrice,
              entryTime: trade.entryTime.toISOString(),
              exitPrice,
              exitTime: tick.timestamp.toISOString(),
              exitReason: closeReason,
              lotSize: trade.remainingLots,
              pips,
              profit,
              balance,
              equity
            });
            equityCurve.push({ time: tick.timestamp.toISOString(), equity, balance });
            tradesToClose.push(tradeId);
          }
        }
        for (const id of tradesToClose) {
          openTrades.delete(id);
        }
        if (tickCount % 1e5 === 0) {
          event.sender.send("backtest:progress", {
            ticksProcessed: tickCount,
            tradesCompleted: trades.length,
            openTrades: openTrades.size
          });
        }
      }
    }
    for (const [, trade] of openTrades) {
      const exitPrice = trade.entryPrice;
      const pips = 0;
      const profit = 0;
      trades.push({
        id: crypto.randomUUID(),
        signalId: trade.signalId,
        symbol: trade.signal.symbol,
        direction: trade.signal.direction,
        entryPrice: trade.entryPrice,
        entryTime: trade.entryTime.toISOString(),
        exitPrice,
        exitTime: (/* @__PURE__ */ new Date()).toISOString(),
        exitReason: "open",
        lotSize: trade.remainingLots,
        pips,
        profit,
        balance,
        equity
      });
    }
    const endTime = /* @__PURE__ */ new Date();
    const winningTrades = trades.filter((t) => t.profit > 0 && t.exitReason !== "open");
    const losingTrades = trades.filter((t) => t.profit < 0);
    const closedTrades = trades.filter((t) => t.exitReason !== "open");
    const totalPips = trades.reduce((sum, t) => sum + t.pips, 0);
    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    return {
      success: true,
      results: {
        id: crypto.randomUUID(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        initialBalance: risk.initialBalance,
        finalBalance: balance,
        totalTrades: closedTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: closedTrades.length > 0 ? winningTrades.length / closedTrades.length * 100 : 0,
        totalPips,
        maxDrawdownEquity,
        maxDrawdownEquityPercent: maxDrawdownEquity,
        maxDrawdownBalance,
        maxDrawdownBalancePercent: maxDrawdownBalance,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
        averageWin: winningTrades.length > 0 ? grossProfit / winningTrades.length : 0,
        averageLoss: losingTrades.length > 0 ? grossLoss / losingTrades.length : 0,
        largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.profit)) : 0,
        largestLoss: losingTrades.length > 0 ? Math.max(...losingTrades.map((t) => Math.abs(t.profit))) : 0,
        trades,
        equityCurve
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Backtest failed"
    };
  }
});
