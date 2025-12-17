import type {
  TickFormat,
  StrategyConfig,
  RiskConfig,
  ParsedSignal,
  TradeResult,
  BacktestResults,
} from "@shared/schema";
import { createReadStream } from "fs";
import { tickDataStore } from "./storage";

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
  lotSize: number;
  highestPrice: number;
  lowestPrice: number;
  tpHits: number[];
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
  
  // Parse date
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
  
  // Parse time
  const timeParts = timeStr.split(/[:.]/).map(p => parseInt(p) || 0);
  hours = timeParts[0] || 0;
  minutes = timeParts[1] || 0;
  seconds = timeParts[2] || 0;
  
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function parseSignalTimestamp(timestamp: string): Date {
  // Handle formats like "2025-10-27 14:46:30"
  const parts = timestamp.split(/[\s]+/);
  const datePart = parts[0];
  const timePart = parts[1] || "00:00:00";
  
  const dateParts = datePart.split(/[-./]/);
  const timeParts = timePart.split(/[:.]/).map(p => parseInt(p) || 0);
  
  return new Date(
    parseInt(dateParts[0]) || 2024,
    (parseInt(dateParts[1]) || 1) - 1,
    parseInt(dateParts[2]) || 1,
    timeParts[0] || 0,
    timeParts[1] || 0,
    timeParts[2] || 0
  );
}

async function* streamTicks(tickDataId: string, tickFormat: TickFormat): AsyncGenerator<Tick> {
  const dataset = tickDataStore.get(tickDataId);
  if (!dataset) {
    throw new Error("Tick data not found");
  }

  const stream = createReadStream(dataset.filePath, { encoding: "utf-8" });
  let buffer = "";
  let lineNumber = 0;

  for await (const chunk of stream) {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

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

  // Process remaining buffer
  if (buffer.trim()) {
    const cols = buffer.split(tickFormat.delimiter);
    const dateStr = cols[tickFormat.dateColumn]?.trim() || "";
    const timeStr = cols[tickFormat.timeColumn]?.trim() || "";
    const bid = parseFloat(cols[tickFormat.bidColumn]?.trim() || "");
    const ask = parseFloat(cols[tickFormat.askColumn]?.trim() || "");

    if (!isNaN(bid) && !isNaN(ask)) {
      const timestamp = parseTimestamp(dateStr, timeStr, tickFormat.dateFormat, tickFormat.timeFormat);
      yield { timestamp, bid, ask };
    }
  }
}

export async function runBacktest(
  tickDataId: string,
  tickFormat: TickFormat,
  signals: ParsedSignal[],
  strategy: StrategyConfig,
  riskConfig: RiskConfig,
  gmtOffset: number
): Promise<BacktestResults> {
  if (!signals || signals.length === 0) {
    throw new Error("No signals provided for backtesting");
  }

  // Sort signals by timestamp
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

  console.log(`Starting backtest with ${sortedSignals.length} signals`);

  for await (const tick of streamTicks(tickDataId, tickFormat)) {
    tickCount++;

    if (tickCount % progressInterval === 0) {
      console.log(`Processed ${tickCount.toLocaleString()} ticks, ${trades.length} trades completed`);
    }

    // Check if we should open new trades
    while (signalIndex < sortedSignals.length) {
      const signal = sortedSignals[signalIndex];
      const signalTime = parseSignalTimestamp(signal.timestamp!);

      if (tick.timestamp >= signalTime) {
        // Open the trade
        const entryPrice = signal.direction === "buy" ? tick.ask : tick.bid;
        const slPips = Math.abs(calculatePips(entryPrice, signal.stopLoss, signal.direction, signal.symbol));
        const lotSize = calculateLotSize(riskConfig, balance, slPips, signal.symbol);

        openTrades.set(signal.id, {
          signalId: signal.id,
          signal,
          entryPrice,
          entryTime: tick.timestamp,
          currentSL: signal.stopLoss,
          lotSize,
          highestPrice: entryPrice,
          lowestPrice: entryPrice,
          tpHits: [],
        });

        signalIndex++;
      } else {
        break;
      }
    }

    // Check open trades for SL/TP hits
    for (const [tradeId, trade] of Array.from(openTrades.entries())) {
      const { signal, entryPrice, currentSL, lotSize } = trade;
      const exitPrice = signal.direction === "buy" ? tick.bid : tick.ask;
      const currentPrice = signal.direction === "buy" ? tick.bid : tick.ask;

      // Update highest/lowest for trailing SL
      if (signal.direction === "buy") {
        trade.highestPrice = Math.max(trade.highestPrice, tick.bid);
      } else {
        trade.lowestPrice = Math.min(trade.lowestPrice, tick.ask);
      }

      // Check for SL hit
      let slHit = false;
      if (signal.direction === "buy" && tick.bid <= currentSL) {
        slHit = true;
      } else if (signal.direction === "sell" && tick.ask >= currentSL) {
        slHit = true;
      }

      // Check for TP hits
      let tpHit: number | null = null;
      for (let i = 0; i < signal.takeProfits.length; i++) {
        const tpLevel = i + 1;
        if (!strategy.activeTPs.includes(tpLevel)) continue;
        if (trade.tpHits.includes(tpLevel)) continue;

        const tp = signal.takeProfits[i];
        if (signal.direction === "buy" && tick.bid >= tp) {
          tpHit = tpLevel;
          break;
        } else if (signal.direction === "sell" && tick.ask <= tp) {
          tpHit = tpLevel;
          break;
        }
      }

      // Handle trailing SL
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

      // Handle move SL to entry after TP
      if (strategy.moveSLToEntry && strategy.moveSLAfterTP && trade.tpHits.length >= strategy.moveSLAfterTP) {
        if (signal.direction === "buy" && trade.currentSL < entryPrice) {
          trade.currentSL = entryPrice;
        } else if (signal.direction === "sell" && trade.currentSL > entryPrice) {
          trade.currentSL = entryPrice;
        }
      }

      // Process exits
      let exitReason: "tp1" | "tp2" | "tp3" | "tp4" | "sl" | "trailing_sl" | null = null;
      let finalExitPrice = 0;

      if (slHit) {
        exitReason = strategy.trailingSL ? "trailing_sl" : "sl";
        finalExitPrice = currentSL;
      } else if (tpHit) {
        trade.tpHits.push(tpHit);

        if (strategy.closePartials && trade.tpHits.length < strategy.activeTPs.length) {
          // Partial close - don't exit yet
          continue;
        }

        if (strategy.closeAllOnTP && tpHit >= strategy.closeAllOnTP) {
          exitReason = `tp${tpHit}` as "tp1" | "tp2" | "tp3" | "tp4";
          finalExitPrice = signal.takeProfits[tpHit - 1];
        } else if (!strategy.closePartials || trade.tpHits.length === strategy.activeTPs.length) {
          exitReason = `tp${tpHit}` as "tp1" | "tp2" | "tp3" | "tp4";
          finalExitPrice = signal.takeProfits[tpHit - 1];
        }
      }

      if (exitReason) {
        openTrades.delete(tradeId);

        const pips = calculatePips(entryPrice, finalExitPrice, signal.direction, signal.symbol);
        const profit = calculateProfit(pips, lotSize);

        balance += profit;
        equity = balance;

        if (equity > maxEquity) {
          maxEquity = equity;
        } else {
          const drawdown = maxEquity - equity;
          if (drawdown > maxDrawdownEquity) {
            maxDrawdownEquity = drawdown;
          }
        }

        if (balance > maxBalance) {
          maxBalance = balance;
        } else {
          const drawdown = maxBalance - balance;
          if (drawdown > maxDrawdownBalance) {
            maxDrawdownBalance = drawdown;
          }
        }

        trades.push({
          id: crypto.randomUUID(),
          signalId: signal.id,
          symbol: signal.symbol,
          direction: signal.direction,
          entryPrice,
          entryTime: trade.entryTime.toISOString(),
          exitPrice: finalExitPrice,
          exitTime: tick.timestamp.toISOString(),
          exitReason,
          lotSize,
          pips,
          profit,
          balance,
          equity,
        });

        equityCurve.push({
          time: tick.timestamp.toISOString(),
          equity,
          balance,
        });
      }
    }

    // Stop if all signals processed and no open trades
    if (signalIndex >= sortedSignals.length && openTrades.size === 0) {
      break;
    }
  }

  // Close any remaining open trades at last known price
  console.log(`Backtest complete: ${tickCount.toLocaleString()} ticks processed, ${trades.length} trades`);

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
