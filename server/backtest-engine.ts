import type {
  TickFormat,
  StrategyConfig,
  RiskConfig,
  ParsedSignal,
  TradeResult,
  BacktestResults,
} from "@shared/schema";
import { tickDataStore } from "./storage";
import { objectStorageService } from "./objectStorage";
import fs from "fs";

interface Tick {
  timestamp: Date;
  bid: number;
  ask: number;
}

interface OpenTrade {
  signalId: string;
  signal: ParsedSignal;
  entryPrice: number;
  entryTime: Date;
  currentSL: number;
  initialLotSize: number;
  remainingLots: number;
  highestPrice: number;
  lowestPrice: number;
  tpHits: number[];
  realizedProfit: number;
  weightedPips: number;
}

function getPipValue(symbol: string): number {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol.includes("JPY")) return 0.01;
  if (upperSymbol.includes("XAU") || upperSymbol.includes("GOLD")) return 0.1;
  return 0.0001;
}

function calculatePips(entryPrice: number, exitPrice: number, direction: "buy" | "sell", symbol: string): number {
  const pipValue = getPipValue(symbol);
  const priceDiff = direction === "buy" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return priceDiff / pipValue;
}

function calculateLotSize(
  riskConfig: RiskConfig,
  balance: number,
  stopLossPips: number,
  symbol: string
): number {
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

function calculateProfit(pips: number, lotSize: number): number {
  return pips * 10 * lotSize;
}

function parseTimestamp(dateStr: string, timeStr: string, dateFormat: string, timeFormat: string): Date {
  let year = 2024, month = 1, day = 1;
  let hours = 0, minutes = 0, seconds = 0;
  
  if (dateFormat === "YYYY-MM-DD" || dateFormat === "YYYY.MM.DD") {
    const parts = dateStr.split(/[-./]/);
    year = parseInt(parts[0]) || 2024;
    month = parseInt(parts[1]) || 1;
    day = parseInt(parts[2]) || 1;
  } else if (dateFormat === "DD/MM/YYYY") {
    const parts = dateStr.split(/[/.-]/);
    day = parseInt(parts[0]) || 1;
    month = parseInt(parts[1]) || 1;
    year = parseInt(parts[2]) || 2024;
  } else if (dateFormat === "MM/DD/YYYY") {
    const parts = dateStr.split(/[/.-]/);
    month = parseInt(parts[0]) || 1;
    day = parseInt(parts[1]) || 1;
    year = parseInt(parts[2]) || 2024;
  }
  
  const timeParts = timeStr.split(/[:.]/).map(p => parseInt(p) || 0);
  hours = timeParts[0] || 0;
  minutes = timeParts[1] || 0;
  seconds = timeParts[2] || 0;
  
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function parseSignalTimestamp(timestamp: string): Date {
  const parts = timestamp.split(/[\s]+/);
  const datePart = parts[0];
  const timePart = parts[1] || "00:00:00";
  
  const dateParts = datePart.split(/[-./]/);
  const timeParts = timePart.split(/[:.]/).map(p => parseInt(p) || 0);
  
  let year: number, month: number, day: number;
  
  // Smart format detection based on values
  const p0 = parseInt(dateParts[0]) || 0;
  const p1 = parseInt(dateParts[1]) || 0;
  const p2 = parseInt(dateParts[2]) || 0;
  
  if (p0 > 31) {
    // First part is year (YYYY-MM-DD or YYYY.MM.DD)
    year = p0;
    month = p1;
    day = p2;
  } else if (p2 > 31) {
    // Last part is year - need to determine if DD/MM or MM/DD
    year = p2;
    if (p0 > 12) {
      // First is day (DD/MM/YYYY)
      day = p0;
      month = p1;
    } else if (p1 > 12) {
      // Second is day (MM/DD/YYYY)
      month = p0;
      day = p1;
    } else {
      // Ambiguous - assume DD/MM/YYYY (more common in forex)
      day = p0;
      month = p1;
    }
  } else {
    // Default: assume YYYY-MM-DD
    year = p0 < 100 ? 2000 + p0 : p0;
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

async function* streamTicks(tickDataId: string, tickFormat: TickFormat, tickDataContent?: string): AsyncGenerator<Tick> {
  let content: string | null = null;

  // Priority 1: Use content passed directly from client (for small files)
  if (tickDataContent && tickDataContent.length > 0) {
    console.log(`Using tick data content sent directly from client`);
    content = tickDataContent;
  }
  
  // Priority 2: Try in-memory store (content)
  if (!content) {
    const dataset = tickDataStore.get(tickDataId);
    if (dataset?.content) {
      console.log(`Using tick data from in-memory store`);
      content = dataset.content;
    }
  }
  
  // Priority 3: Try reading from disk (file path stored in memory)
  if (!content) {
    const filePath = tickDataStore.getFilePath(tickDataId);
    if (filePath && fs.existsSync(filePath)) {
      console.log(`Reading tick data from disk: ${filePath}`);
      content = fs.readFileSync(filePath, "utf-8");
    }
  }
  
  // Priority 4: Try object storage
  if (!content) {
    console.log(`Tick data ${tickDataId} not in memory or disk, checking object storage...`);
    try {
      const storedData = await objectStorageService.getTickData(tickDataId);
      if (storedData) {
        console.log(`Found tick data in object storage: ${storedData.rowCount} rows`);
        content = storedData.content;
        // Cache in memory for faster subsequent access
        tickDataStore.add({
          id: tickDataId,
          content: storedData.content,
          rowCount: storedData.rowCount,
          sampleRows: storedData.sampleRows,
          uploadedAt: new Date(),
        });
      } else {
        console.log(`Tick data ${tickDataId} not found in object storage`);
      }
    } catch (err) {
      console.error("Object storage lookup failed:", err);
    }
  }
  
  if (!content) {
    throw new Error("Tick data not found. Please upload your tick data file on the Tick Data page.");
  }

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

    const timestamp = parseTimestamp(dateStr, timeStr, tickFormat.dateFormat, tickFormat.timeFormat);

    yield { timestamp, bid, ask };
  }
}

export async function runBacktest(
  tickDataId: string,
  tickFormat: TickFormat,
  signals: ParsedSignal[],
  strategy: StrategyConfig,
  riskConfig: RiskConfig,
  gmtOffset: number,
  tickDataContent?: string
): Promise<BacktestResults> {
  if (!signals || signals.length === 0) {
    throw new Error("No signals provided for backtesting");
  }

  const sortedSignals = [...signals]
    .filter(s => s.timestamp)
    .sort((a, b) => {
      const ta = parseSignalTimestamp(a.timestamp!);
      const tb = parseSignalTimestamp(b.timestamp!);
      return ta.getTime() - tb.getTime();
    });

  if (sortedSignals.length === 0) {
    throw new Error("No signals with timestamps found. Make sure your signal format includes {date} and {time} placeholders.");
  }

  const startTime = new Date();
  const trades: TradeResult[] = [];
  const equityCurve: { time: string; equity: number; balance: number }[] = [];

  let balance = riskConfig.initialBalance;
  let equity = balance;
  let maxEquity = equity;
  let maxBalance = balance;
  let maxDrawdownEquity = 0;
  let maxDrawdownBalance = 0;

  const openTrades: Map<string, OpenTrade> = new Map();
  let signalIndex = 0;
  let tickCount = 0;
  const progressInterval = 100000;

  equityCurve.push({
    time: startTime.toISOString(),
    equity: balance,
    balance: balance,
  });

  // Log signal time range for debugging
  const firstSignalTime = parseSignalTimestamp(sortedSignals[0].timestamp!);
  const lastSignalTime = parseSignalTimestamp(sortedSignals[sortedSignals.length - 1].timestamp!);
  console.log(`Starting backtest with ${sortedSignals.length} signals`);
  console.log(`Signal time range: ${firstSignalTime.toISOString()} to ${lastSignalTime.toISOString()}`);

  let firstTickTime: Date | null = null;
  let lastTickTime: Date | null = null;

  for await (const tick of streamTicks(tickDataId, tickFormat, tickDataContent)) {
    if (!firstTickTime) {
      firstTickTime = tick.timestamp;
      console.log(`First tick: ${firstTickTime.toISOString()}, bid: ${tick.bid}, ask: ${tick.ask}`);
    }
    lastTickTime = tick.timestamp;
    tickCount++;

    if (tickCount % progressInterval === 0) {
      console.log(`Processed ${tickCount.toLocaleString()} ticks, ${trades.length} trades completed`);
    }

    while (signalIndex < sortedSignals.length) {
      const signal = sortedSignals[signalIndex];
      const signalTime = parseSignalTimestamp(signal.timestamp!);

      if (tick.timestamp >= signalTime) {
        const entryPrice = signal.direction === "buy" ? tick.ask : tick.bid;
        const slPips = Math.abs(calculatePips(entryPrice, signal.stopLoss, signal.direction, signal.symbol));
        const lotSize = calculateLotSize(riskConfig, balance, slPips, signal.symbol);

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
          weightedPips: 0,
        });

        signalIndex++;
      } else {
        break;
      }
    }

    const tradesToClose: string[] = [];

    for (const [tradeId, trade] of Array.from(openTrades.entries())) {
      const { signal, entryPrice } = trade;
      const currentBid = tick.bid;
      const currentAsk = tick.ask;

      if (signal.direction === "buy") {
        trade.highestPrice = Math.max(trade.highestPrice, currentBid);
      } else {
        trade.lowestPrice = Math.min(trade.lowestPrice, currentAsk);
      }

      if (strategy.trailingSL && strategy.trailingPips) {
        const pipValue = getPipValue(signal.symbol);
        const trailDistance = strategy.trailingPips * pipValue;

        if (signal.direction === "buy") {
          const newSL = trade.highestPrice - trailDistance;
          if (newSL > trade.currentSL) {
            trade.currentSL = newSL;
          }
        } else {
          const newSL = trade.lowestPrice + trailDistance;
          if (newSL < trade.currentSL) {
            trade.currentSL = newSL;
          }
        }
      }

      if (strategy.moveSLToEntry && strategy.moveSLAfterTP && trade.tpHits.length >= strategy.moveSLAfterTP) {
        if (signal.direction === "buy" && trade.currentSL < entryPrice) {
          trade.currentSL = entryPrice;
        } else if (signal.direction === "sell" && trade.currentSL > entryPrice) {
          trade.currentSL = entryPrice;
        }
      }

      let slHit = false;
      let slExitPrice = 0;
      if (signal.direction === "buy" && currentBid <= trade.currentSL) {
        slHit = true;
        slExitPrice = currentBid;
      } else if (signal.direction === "sell" && currentAsk >= trade.currentSL) {
        slHit = true;
        slExitPrice = currentAsk;
      }

      if (slHit) {
        const pips = calculatePips(entryPrice, slExitPrice, signal.direction, signal.symbol);
        const exitProfit = calculateProfit(pips, trade.remainingLots);
        const totalProfit = exitProfit + trade.realizedProfit;
        const remainingWeight = trade.remainingLots / trade.initialLotSize;
        const totalWeightedPips = trade.weightedPips + (pips * remainingWeight);

        balance += exitProfit;
        equity = balance;

        if (equity > maxEquity) maxEquity = equity;
        else if (maxEquity - equity > maxDrawdownEquity) maxDrawdownEquity = maxEquity - equity;

        if (balance > maxBalance) maxBalance = balance;
        else if (maxBalance - balance > maxDrawdownBalance) maxDrawdownBalance = maxBalance - balance;

        trades.push({
          id: crypto.randomUUID(),
          signalId: signal.id,
          symbol: signal.symbol,
          direction: signal.direction,
          entryPrice,
          entryTime: trade.entryTime.toISOString(),
          exitPrice: slExitPrice,
          exitTime: tick.timestamp.toISOString(),
          exitReason: strategy.trailingSL ? "trailing_sl" : "sl",
          lotSize: trade.initialLotSize,
          pips: totalWeightedPips,
          profit: totalProfit,
          balance,
          equity,
        });

        equityCurve.push({
          time: tick.timestamp.toISOString(),
          equity,
          balance,
        });

        tradesToClose.push(tradeId);
        continue;
      }

      for (let i = 0; i < signal.takeProfits.length; i++) {
        const tpLevel = i + 1;
        if (!strategy.activeTPs.includes(tpLevel)) continue;
        if (trade.tpHits.includes(tpLevel)) continue;

        const tp = signal.takeProfits[i];
        let tpHit = false;
        let tpExitPrice = 0;

        if (signal.direction === "buy" && currentBid >= tp) {
          tpHit = true;
          tpExitPrice = currentBid;
        } else if (signal.direction === "sell" && currentAsk <= tp) {
          tpHit = true;
          tpExitPrice = currentAsk;
        }

        if (tpHit) {
          trade.tpHits.push(tpLevel);

          const activeTpCount = strategy.activeTPs.length;
          const remainingTps = activeTpCount - trade.tpHits.length;

          const shouldCloseAll = strategy.closeAllOnTP && tpLevel >= strategy.closeAllOnTP;
          const isFinalTp = remainingTps === 0;

          if (shouldCloseAll || isFinalTp) {
            const pips = calculatePips(entryPrice, tpExitPrice, signal.direction, signal.symbol);
            const exitProfit = calculateProfit(pips, trade.remainingLots);
            const totalProfit = exitProfit + trade.realizedProfit;
            const remainingWeight = trade.remainingLots / trade.initialLotSize;
            const totalWeightedPips = trade.weightedPips + (pips * remainingWeight);

            balance += exitProfit;
            equity = balance;

            if (equity > maxEquity) maxEquity = equity;
            else if (maxEquity - equity > maxDrawdownEquity) maxDrawdownEquity = maxEquity - equity;

            if (balance > maxBalance) maxBalance = balance;
            else if (maxBalance - balance > maxDrawdownBalance) maxDrawdownBalance = maxBalance - balance;

            trades.push({
              id: crypto.randomUUID(),
              signalId: signal.id,
              symbol: signal.symbol,
              direction: signal.direction,
              entryPrice,
              entryTime: trade.entryTime.toISOString(),
              exitPrice: tpExitPrice,
              exitTime: tick.timestamp.toISOString(),
              exitReason: `tp${tpLevel}` as "tp1" | "tp2" | "tp3" | "tp4",
              lotSize: trade.initialLotSize,
              pips: totalWeightedPips,
              profit: totalProfit,
              balance,
              equity,
            });

            equityCurve.push({
              time: tick.timestamp.toISOString(),
              equity,
              balance,
            });

            tradesToClose.push(tradeId);
          } else if (strategy.closePartials && remainingTps > 0) {
            const partialPercent = (strategy.partialClosePercent || 50) / 100;
            const closeLots = trade.remainingLots * partialPercent;
            trade.remainingLots -= closeLots;

            const pips = calculatePips(entryPrice, tpExitPrice, signal.direction, signal.symbol);
            const partialProfit = calculateProfit(pips, closeLots);
            const partialWeight = closeLots / trade.initialLotSize;
            
            trade.realizedProfit += partialProfit;
            trade.weightedPips += pips * partialWeight;
            
            balance += partialProfit;
            equity = balance;

            if (equity > maxEquity) maxEquity = equity;
            else if (maxEquity - equity > maxDrawdownEquity) maxDrawdownEquity = maxEquity - equity;

            if (balance > maxBalance) maxBalance = balance;
            else if (maxBalance - balance > maxDrawdownBalance) maxDrawdownBalance = maxBalance - balance;
          }

          break;
        }
      }
    }

    for (const id of tradesToClose) {
      openTrades.delete(id);
    }

    if (signalIndex >= sortedSignals.length && openTrades.size === 0) {
      break;
    }
  }

  console.log(`Backtest complete: ${tickCount.toLocaleString()} ticks processed, ${trades.length} trades`);
  if (lastTickTime) {
    console.log(`Tick data range: ${firstTickTime?.toISOString()} to ${lastTickTime.toISOString()}`);
  }
  console.log(`Signals matched: ${signalIndex} of ${sortedSignals.length}, open trades at end: ${openTrades.size}`);
  
  // Debug: if no trades executed, explain why and throw error with details
  let debugInfo = "";
  if (trades.length === 0 && sortedSignals.length > 0) {
    if (tickCount === 0) {
      throw new Error(`No tick data was processed. Make sure your tick data file is loaded and the format is correct.`);
    }
    
    if (firstTickTime && lastTickTime) {
      const tickStart = firstTickTime.getTime();
      const tickEnd = lastTickTime.getTime();
      const sigStart = firstSignalTime.getTime();
      const sigEnd = lastSignalTime.getTime();
      
      debugInfo = `\n\nTick data range: ${firstTickTime.toISOString().substring(0, 19)} to ${lastTickTime.toISOString().substring(0, 19)}` +
                  `\nSignal range: ${firstSignalTime.toISOString().substring(0, 19)} to ${lastSignalTime.toISOString().substring(0, 19)}`;
      
      if (sigStart > tickEnd) {
        throw new Error(`Signal timestamps are AFTER your tick data ends. Your signals start at ${firstSignalTime.toISOString().substring(0, 19)} but tick data ends at ${lastTickTime.toISOString().substring(0, 19)}. Make sure your signal dates match your tick data date range.`);
      } else if (sigEnd < tickStart) {
        throw new Error(`Signal timestamps are BEFORE your tick data starts. Your signals end at ${lastSignalTime.toISOString().substring(0, 19)} but tick data starts at ${firstTickTime.toISOString().substring(0, 19)}. Make sure your signal dates match your tick data date range.`);
      } else if (openTrades.size > 0) {
        console.log(`WARNING: ${openTrades.size} trades were opened but never closed (SL/TP not hit within tick data)`);
      } else {
        console.log(`WARNING: Signals and tick data overlap but no trades opened. Check timestamp parsing.` + debugInfo);
      }
    }
  }

  const endTime = new Date();
  const winningTrades = trades.filter(t => t.profit > 0);
  const losingTrades = trades.filter(t => t.profit < 0);

  const totalWinAmount = winningTrades.reduce((sum, t) => sum + t.profit, 0);
  const totalLossAmount = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));

  return {
    id: crypto.randomUUID(),
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    initialBalance: riskConfig.initialBalance,
    finalBalance: balance,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    totalPips: trades.reduce((sum, t) => sum + t.pips, 0),
    maxDrawdownEquity,
    maxDrawdownEquityPercent: riskConfig.initialBalance > 0 ? (maxDrawdownEquity / riskConfig.initialBalance) * 100 : 0,
    maxDrawdownBalance,
    maxDrawdownBalancePercent: riskConfig.initialBalance > 0 ? (maxDrawdownBalance / riskConfig.initialBalance) * 100 : 0,
    profitFactor: totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0,
    averageWin: winningTrades.length > 0 ? totalWinAmount / winningTrades.length : 0,
    averageLoss: losingTrades.length > 0 ? totalLossAmount / losingTrades.length : 0,
    largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.profit)) : 0,
    largestLoss: losingTrades.length > 0 ? Math.max(...losingTrades.map(t => Math.abs(t.profit))) : 0,
    trades,
    equityCurve,
  };
}
