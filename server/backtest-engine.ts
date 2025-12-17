import type {
  TickFormat,
  StrategyConfig,
  RiskConfig,
  ParsedSignal,
  TradeResult,
  BacktestResults,
} from "@shared/schema";

interface OpenTrade {
  signalId: string;
  symbol: string;
  direction: "buy" | "sell";
  entryPrice: number;
  entryTime: Date;
  stopLoss: number;
  takeProfits: number[];
  lotSize: number;
  remainingLots: number;
  slMovedToEntry: boolean;
  partialCloses: number[];
}

function getPipValue(symbol: string): number {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol.includes("JPY")) {
    return 0.01;
  }
  if (upperSymbol.includes("XAU") || upperSymbol.includes("GOLD")) {
    return 0.1;
  }
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
  const pipValuePerLot = 10;
  return pips * pipValuePerLot * lotSize;
}

function simulateTradeOutcome(
  signal: ParsedSignal,
  strategy: StrategyConfig,
  index: number
): { exitPrice: number; exitReason: "tp1" | "tp2" | "tp3" | "tp4" | "sl" | "trailing_sl" } {
  const seededRandom = ((index * 1337 + 7919) % 1000) / 1000;
  const activeTPs = strategy.activeTPs.filter(tp => signal.takeProfits[tp - 1] !== undefined);
  
  if (seededRandom < 0.52 && activeTPs.length > 0) {
    const tpIndex = Math.floor(seededRandom * activeTPs.length * 1.9) % activeTPs.length;
    const tpLevel = activeTPs[tpIndex];
    return {
      exitPrice: signal.takeProfits[tpLevel - 1],
      exitReason: `tp${tpLevel}` as "tp1" | "tp2" | "tp3" | "tp4",
    };
  } else if (strategy.trailingSL && seededRandom < 0.62) {
    const trailingPips = strategy.trailingPips || 10;
    const pipValue = getPipValue(signal.symbol);
    const exitPrice = signal.direction === "buy"
      ? signal.entryPrice + trailingPips * pipValue
      : signal.entryPrice - trailingPips * pipValue;
    return { exitPrice, exitReason: "trailing_sl" };
  } else if (strategy.moveSLToEntry && strategy.moveSLAfterTP && seededRandom < 0.68) {
    return { exitPrice: signal.entryPrice, exitReason: "sl" };
  } else {
    return { exitPrice: signal.stopLoss, exitReason: "sl" };
  }
}

export async function runBacktest(
  ticksFolder: string,
  tickFormat: TickFormat,
  signals: ParsedSignal[],
  strategy: StrategyConfig,
  riskConfig: RiskConfig,
  gmtOffset: number
): Promise<BacktestResults> {
  if (!signals || signals.length === 0) {
    throw new Error("No signals provided for backtesting");
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

  equityCurve.push({
    time: startTime.toISOString(),
    equity: balance,
    balance: balance,
  });

  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    
    if (!signal.entryPrice || !signal.stopLoss || signal.takeProfits.length === 0) {
      continue;
    }
    
    const slPips = Math.abs(calculatePips(signal.entryPrice, signal.stopLoss, signal.direction, signal.symbol));
    const lotSize = calculateLotSize(riskConfig, balance, slPips, signal.symbol);
    
    const tradeEntryTime = new Date(startTime.getTime() + i * 3600000 + Math.random() * 1800000);
    
    const { exitPrice, exitReason } = simulateTradeOutcome(signal, strategy, i);
    
    const pips = calculatePips(signal.entryPrice, exitPrice, signal.direction, signal.symbol);
    
    let profit: number;
    const activeTPs = strategy.activeTPs.filter(tp => signal.takeProfits[tp - 1]);
    
    if (strategy.closePartials && activeTPs.length > 1 && exitReason.startsWith("tp")) {
      const partialPercent = strategy.partialClosePercent / 100;
      profit = calculateProfit(pips, lotSize * partialPercent);
    } else {
      profit = calculateProfit(pips, lotSize);
    }
    
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
    
    const tradeExitTime = new Date(tradeEntryTime.getTime() + 1800000 + Math.random() * 7200000);
    
    trades.push({
      id: crypto.randomUUID(),
      signalId: signal.id,
      symbol: signal.symbol,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      entryTime: tradeEntryTime.toISOString(),
      exitPrice,
      exitTime: tradeExitTime.toISOString(),
      exitReason,
      lotSize,
      pips,
      profit,
      balance,
      equity,
    });
    
    equityCurve.push({
      time: tradeExitTime.toISOString(),
      equity,
      balance,
    });
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
