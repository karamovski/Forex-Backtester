import { DollarSign, Percent, Hash, Calculator, HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useBacktestStore } from "@/lib/backtest-store";

export default function RiskManagement() {
  const { risk, setRisk } = useBacktestStore();

  const calculateExampleLot = () => {
    const balance = risk.initialBalance;
    switch (risk.riskType) {
      case "percentage":
        return `${((balance * (risk.riskPercentage || 1)) / 100 / 1000).toFixed(2)} lots (approx)`;
      case "fixed_lot":
        return `${risk.fixedLotSize?.toFixed(2)} lots`;
      case "rule_based":
        const multiplier = Math.floor(balance / (risk.ruleBasedAmount || 100));
        return `${(multiplier * (risk.ruleBasedLot || 0.01)).toFixed(2)} lots`;
      default:
        return "-";
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Risk Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your account balance and position sizing rules
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Account Settings</CardTitle>
            </div>
            <CardDescription>
              Set your starting balance for the backtest
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="initial-balance">Initial Balance (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="initial-balance"
                  type="number"
                  min="1"
                  value={risk.initialBalance}
                  onChange={(e) => setRisk({ initialBalance: parseFloat(e.target.value) || 10000 })}
                  className="pl-9 font-mono text-lg"
                  data-testid="input-initial-balance"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The starting account balance for the backtest simulation
              </p>
            </div>

            <div className="p-4 rounded-md bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Position Size Preview</span>
              </div>
              <div className="text-2xl font-mono font-semibold text-primary">
                {calculateExampleLot()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Based on current settings and ${risk.initialBalance.toLocaleString()} balance
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Position Sizing Method</CardTitle>
            </div>
            <CardDescription>
              Choose how to calculate your lot size for each trade
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              value={risk.riskType}
              onValueChange={(value) => setRisk({ riskType: value as typeof risk.riskType })}
              className="space-y-4"
            >
              <div
                className={`p-4 rounded-md border transition-colors ${
                  risk.riskType === "percentage" ? "border-primary bg-primary/5" : "bg-muted/30"
                }`}
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="percentage" id="risk-percentage" className="mt-1" data-testid="radio-risk-percentage" />
                  <div className="flex-1">
                    <Label htmlFor="risk-percentage" className="font-medium cursor-pointer">
                      Risk Percentage
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Risk a fixed percentage of your account on each trade
                    </p>
                    {risk.riskType === "percentage" && (
                      <div className="mt-3 flex items-center gap-2">
                        <Input
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.1"
                          value={risk.riskPercentage || 1}
                          onChange={(e) => setRisk({ riskPercentage: parseFloat(e.target.value) || 1 })}
                          className="w-24 font-mono"
                          data-testid="input-risk-percentage"
                        />
                        <span className="text-sm text-muted-foreground">% per trade</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-md border transition-colors ${
                  risk.riskType === "fixed_lot" ? "border-primary bg-primary/5" : "bg-muted/30"
                }`}
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="fixed_lot" id="risk-fixed" className="mt-1" data-testid="radio-risk-fixed" />
                  <div className="flex-1">
                    <Label htmlFor="risk-fixed" className="font-medium cursor-pointer">
                      Fixed Lot Size
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use the same lot size for every trade regardless of account size
                    </p>
                    {risk.riskType === "fixed_lot" && (
                      <div className="mt-3 flex items-center gap-2">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={risk.fixedLotSize || 0.01}
                          onChange={(e) => setRisk({ fixedLotSize: parseFloat(e.target.value) || 0.01 })}
                          className="w-24 font-mono"
                          data-testid="input-fixed-lot"
                        />
                        <span className="text-sm text-muted-foreground">lots</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-md border transition-colors ${
                  risk.riskType === "rule_based" ? "border-primary bg-primary/5" : "bg-muted/30"
                }`}
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="rule_based" id="risk-rule" className="mt-1" data-testid="radio-risk-rule" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="risk-rule" className="font-medium cursor-pointer">
                        Rule-Based Sizing
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">
                            Scale lot size based on account balance. For example: 0.01 lots per $100 in the account.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Scale position size based on your account balance
                    </p>
                    {risk.riskType === "rule_based" && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-muted-foreground">For every</span>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              type="number"
                              min="1"
                              value={risk.ruleBasedAmount || 100}
                              onChange={(e) =>
                                setRisk({ ruleBasedAmount: parseFloat(e.target.value) || 100 })
                              }
                              className="w-24 pl-7 font-mono"
                              data-testid="input-rule-amount"
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">use</span>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={risk.ruleBasedLot || 0.01}
                            onChange={(e) =>
                              setRisk({ ruleBasedLot: parseFloat(e.target.value) || 0.01 })
                            }
                            className="w-20 font-mono"
                            data-testid="input-rule-lot"
                          />
                          <span className="text-sm text-muted-foreground">lots</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Risk Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Starting Balance
              </div>
              <div className="text-xl font-mono font-semibold">
                ${risk.initialBalance.toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Sizing Method
              </div>
              <div className="text-sm font-medium">
                {risk.riskType === "percentage"
                  ? "Risk Percentage"
                  : risk.riskType === "fixed_lot"
                  ? "Fixed Lot"
                  : "Rule-Based"}
              </div>
            </div>

            <div className="p-4 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Position Size
              </div>
              <div className="text-sm font-mono font-medium">{calculateExampleLot()}</div>
            </div>

            <div className="p-4 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Max Risk Per Trade
              </div>
              <div className="text-sm font-mono font-medium">
                {risk.riskType === "percentage"
                  ? `${risk.riskPercentage}% ($${((risk.initialBalance * (risk.riskPercentage || 1)) / 100).toFixed(2)})`
                  : "Variable"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
