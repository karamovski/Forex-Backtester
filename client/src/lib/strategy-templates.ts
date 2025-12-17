import type { StrategyConfig, RiskConfig } from "@shared/schema";

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: "scalping" | "swing" | "conservative" | "aggressive";
  strategy: StrategyConfig;
  risk: Partial<RiskConfig>;
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "conservative-scalping",
    name: "Conservative Scalping",
    description: "Low risk scalping with single TP and breakeven protection",
    category: "conservative",
    strategy: {
      moveSLToEntry: true,
      moveSLAfterTP: 1,
      moveSLAfterPips: undefined,
      trailingSL: false,
      trailingPips: undefined,
      useMultipleTPs: false,
      activeTPs: [1],
      closePartials: false,
      partialClosePercent: 25,
      closeAllOnTP: 1,
    },
    risk: {
      riskType: "percentage",
      riskPercentage: 0.5,
    },
  },
  {
    id: "multi-tp-swing",
    name: "Multi-TP Swing Trading",
    description: "Multiple take profits with partial closes for swing trades",
    category: "swing",
    strategy: {
      moveSLToEntry: true,
      moveSLAfterTP: 1,
      moveSLAfterPips: undefined,
      trailingSL: false,
      trailingPips: undefined,
      useMultipleTPs: true,
      activeTPs: [1, 2, 3],
      closePartials: true,
      partialClosePercent: 33,
      closeAllOnTP: 3,
    },
    risk: {
      riskType: "percentage",
      riskPercentage: 1,
    },
  },
  {
    id: "trailing-momentum",
    name: "Trailing Momentum",
    description: "Let winners run with trailing stop loss",
    category: "aggressive",
    strategy: {
      moveSLToEntry: true,
      moveSLAfterTP: undefined,
      moveSLAfterPips: 20,
      trailingSL: true,
      trailingPips: 15,
      useMultipleTPs: true,
      activeTPs: [1, 2],
      closePartials: true,
      partialClosePercent: 50,
      closeAllOnTP: undefined,
    },
    risk: {
      riskType: "percentage",
      riskPercentage: 2,
    },
  },
  {
    id: "fixed-lot-conservative",
    name: "Fixed Lot Conservative",
    description: "Consistent lot sizing with single take profit",
    category: "conservative",
    strategy: {
      moveSLToEntry: false,
      moveSLAfterTP: undefined,
      moveSLAfterPips: undefined,
      trailingSL: false,
      trailingPips: undefined,
      useMultipleTPs: false,
      activeTPs: [1],
      closePartials: false,
      partialClosePercent: 25,
      closeAllOnTP: 1,
    },
    risk: {
      riskType: "fixed_lot",
      fixedLotSize: 0.01,
    },
  },
  {
    id: "rule-based-scaling",
    name: "Rule-Based Scaling",
    description: "Scale position size with account growth",
    category: "swing",
    strategy: {
      moveSLToEntry: true,
      moveSLAfterTP: 1,
      moveSLAfterPips: undefined,
      trailingSL: false,
      trailingPips: undefined,
      useMultipleTPs: true,
      activeTPs: [1, 2],
      closePartials: true,
      partialClosePercent: 50,
      closeAllOnTP: 2,
    },
    risk: {
      riskType: "rule_based",
      ruleBasedAmount: 500,
      ruleBasedLot: 0.01,
    },
  },
  {
    id: "aggressive-multi-tp",
    name: "Aggressive Multi-TP",
    description: "High risk with all 4 take profit levels",
    category: "aggressive",
    strategy: {
      moveSLToEntry: true,
      moveSLAfterTP: 2,
      moveSLAfterPips: undefined,
      trailingSL: true,
      trailingPips: 25,
      useMultipleTPs: true,
      activeTPs: [1, 2, 3, 4],
      closePartials: true,
      partialClosePercent: 25,
      closeAllOnTP: 4,
    },
    risk: {
      riskType: "percentage",
      riskPercentage: 3,
    },
  },
];

export function getCategoryColor(category: StrategyTemplate["category"]): string {
  switch (category) {
    case "conservative":
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    case "swing":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "aggressive":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "scalping":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}
