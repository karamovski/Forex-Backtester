import type {
  TickFormat,
  StrategyConfig,
  RiskConfig,
  ParsedSignal,
  TradeResult,
  BacktestResults,
} from "./schema";

export interface Tick {
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

export function getPipValue(symbol: string): number {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol.includes("JPY")) return 0.01;
  if (upperSymbol.includes("XAU") || upperSymbol.includes("GOLD")) return 0.1;
  return 0.0001;
}

export function calculatePips(entryPrice: number, exitPrice: number, direction: "buy" | "sell", symbol: string): number {
  const pipValue = getPipValue(symbol);
  const priceDiff = direction === "buy" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return priceDiff / pipValue;
}

export function calculateLotSize(
  riskConfig: RiskConfig,
  balance: number,
  stopLossPips: number
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

export function calculateProfit(pips: number, lotSize: number): number {
  return pips * 10 * lotSize;
}

export function parseTimestampSmart(dateStr: string, timeStr: string): Date {
  const dateParts = dateStr.split(/[-./]/);
  const timeParts = timeStr.split(/[:.]/).map(p => parseInt(p) || 0);
  
  let year: number, month: number, day: number;
  const p0 = parseInt(dateParts[0]) || 0;
  const p1 = parseInt(dateParts[1]) || 0;
  const p2 = parseInt(dateParts[2]) || 0;
  
  if (p0 > 31) {
    year = p0 < 100 ? 2000 + p0 : p0;
    month = p1;
    day = p2;
  } else if (p2 > 31 || p2 < 100) {
    year = p2 < 100 ? 2000 + p2 : p2;
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

export function parseSignalTimestamp(timestamp: string): Date {
  const [datePart, timePart] = timestamp.split(/\s+/);
  return parseTimestampSmart(datePart || "", timePart || "00:00:00");
}

export function parseTick(line: string, format: TickFormat): Tick | null {
  const del = format.delimiter === "tab" ? "\t" : format.delimiter === "space" ? /\s+/ : format.delimiter;
  const cols = line.split(del);
  
  const dateStr = (cols[format.dateColumn] || "").trim();
  const timeStr = (cols[format.timeColumn] || "").trim();
  const bidStr = (cols[format.bidColumn] || "").trim();
  const askStr = (cols[format.askColumn] || "").trim();
  
  const bid = parseFloat(bidStr);
  const ask = parseFloat(askStr);
  
  if (isNaN(bid) || isNaN(ask)) return null;
  
  return {
    timestamp: parseTimestampSmart(dateStr, timeStr),
    bid,
    ask,
  };
}

export interface BacktestProgress {
  ticksProcessed: number;
  tradesCompleted: number;
  openTrades: number;
}

export type ProgressCallback = (progress: BacktestProgress) => void;

export async function runBacktestCore(
  tickGenerator: AsyncGenerator<Tick>,
  signals: ParsedSignal[],
  strategy: StrategyConfig,
  riskConfig: RiskConfig,
  onProgress?: ProgressCallback
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
    throw new Error("No signals with timestamps found");
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

  let firstTickTime: Date | null = null;
  let lastTickTime: Date | null = null;

  for await (const tick of tickGenerator) {
    if (!firstTickTime) {
      firstTickTime = tick.timestamp;
    }
    lastTickTime = tick.timestamp;
    tickCount++;

    if (tickCount % progressInterval === 0 && onProgress) {
      onProgress({
        ticksProcessed: tickCount,
        tradesCompleted: trades.length,
        openTrades: openTrades.size,
      });
    }

    while (signalIndex < sortedSignals.length) {
      const signal = sortedSignals[signalIndex];
      const signalTime = parseSignalTimestamp(signal.timestamp!);

      if (tick.timestamp >= signalTime) {
        const entryPrice = signal.direction === "buy" ? tick.ask : tick.bid;
        const slPips = Math.abs(calculatePips(entryPrice, signal.stopLoss, signal.direction, signal.symbol));
        const lotSize = calculateLotSize(riskConfig, balance, slPips);

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
      const price = trade.signal.direction === "buy" ? tick.bid : tick.ask;

      if (trade.signal.direction === "buy") {
        trade.highestPrice = Math.max(trade.highestPrice, price);
        trade.lowestPrice = Math.min(trade.lowestPrice, price);
      } else {
        trade.lowestPrice = Math.min(trade.lowestPrice, price);
        trade.highestPrice = Math.max(trade.highestPrice, price);
      }

      if (strategy.trailingSL && strategy.trailingPips) {
        const pipValue = getPipValue(trade.signal.symbol);
        const trailDistance = strategy.trailingPips * pipValue;

        if (trade.signal.direction === "buy") {
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

      let closeReason: "tp1" | "tp2" | "tp3" | "tp4" | "sl" | "trailing_sl" | "manual" | "open" | null = null;
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
            closeReason = (["tp1", "tp2", "tp3", "tp4"] as const)[tpIndex] || "tp1";
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

        const ddEquity = maxEquity > 0 ? ((maxEquity - equity) / maxEquity) * 100 : 0;
        const ddBalance = maxBalance > 0 ? ((maxBalance - balance) / maxBalance) * 100 : 0;
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
          equity,
        });

        equityCurve.push({ time: tick.timestamp.toISOString(), equity, balance });
        tradesToClose.push(tradeId);
      }
    }

    for (const id of tradesToClose) {
      openTrades.delete(id);
    }
  }

  for (const [, trade] of Array.from(openTrades.entries())) {
    trades.push({
      id: crypto.randomUUID(),
      signalId: trade.signalId,
      symbol: trade.signal.symbol,
      direction: trade.signal.direction,
      entryPrice: trade.entryPrice,
      entryTime: trade.entryTime.toISOString(),
      exitPrice: trade.entryPrice,
      exitTime: new Date().toISOString(),
      exitReason: "open",
      lotSize: trade.remainingLots,
      pips: 0,
      profit: 0,
      balance,
      equity,
    });
  }

  const endTime = new Date();
  const winningTrades = trades.filter(t => t.profit > 0 && t.exitReason !== "open");
  const losingTrades = trades.filter(t => t.profit < 0);
  const closedTrades = trades.filter(t => t.exitReason !== "open");

  const totalPips = trades.reduce((sum, t) => sum + t.pips, 0);
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));

  return {
    id: crypto.randomUUID(),
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    initialBalance: riskConfig.initialBalance,
    finalBalance: balance,
    totalTrades: closedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
    totalPips,
    maxDrawdownEquity,
    maxDrawdownEquityPercent: maxDrawdownEquity,
    maxDrawdownBalance,
    maxDrawdownBalancePercent: maxDrawdownBalance,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
    averageWin: winningTrades.length > 0 ? grossProfit / winningTrades.length : 0,
    averageLoss: losingTrades.length > 0 ? grossLoss / losingTrades.length : 0,
    largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.profit)) : 0,
    largestLoss: losingTrades.length > 0 ? Math.max(...losingTrades.map(t => Math.abs(t.profit))) : 0,
    trades,
    equityCurve,
  };
}
