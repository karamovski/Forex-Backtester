import { Settings2, Target, Shield, TrendingUp, HelpCircle, Layers, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useBacktestStore } from "@/lib/backtest-store";
import { STRATEGY_TEMPLATES, getCategoryColor, type StrategyTemplate } from "@/lib/strategy-templates";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Strategy() {
  const { strategy, setStrategy, setRisk } = useBacktestStore();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleLoadTemplate = (template: StrategyTemplate) => {
    setStrategy(template.strategy);
    if (template.risk) {
      setRisk(template.risk);
    }
    setSelectedTemplate(template.id);
    toast({
      title: "Template Loaded",
      description: `Applied "${template.name}" strategy and risk settings`,
    });
  };

  const handleTPToggle = (tp: number, checked: boolean) => {
    const activeTPs = checked
      ? [...strategy.activeTPs, tp].sort()
      : strategy.activeTPs.filter((t) => t !== tp);
    setStrategy({ activeTPs });
  };

  const slTriggerMode = strategy.moveSLAfterTP
    ? "tp"
    : strategy.moveSLAfterPips
    ? "pips"
    : "none";

  const handleSlTriggerChange = (mode: string) => {
    if (mode === "none") {
      setStrategy({ moveSLToEntry: false, moveSLAfterTP: undefined, moveSLAfterPips: undefined });
    } else if (mode === "tp") {
      setStrategy({ moveSLToEntry: true, moveSLAfterTP: 1, moveSLAfterPips: undefined });
    } else if (mode === "pips") {
      setStrategy({ moveSLToEntry: true, moveSLAfterTP: undefined, moveSLAfterPips: 20 });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Strategy Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your trade management rules and exit strategies
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Strategy Templates</CardTitle>
          </div>
          <CardDescription>
            Quick-load pre-configured strategies with matching risk settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STRATEGY_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className={`relative p-4 rounded-md border cursor-pointer transition-colors hover-elevate ${
                  selectedTemplate === template.id
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
                onClick={() => handleLoadTemplate(template)}
                data-testid={`template-${template.id}`}
              >
                {selectedTemplate === template.id && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm">{template.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {template.description}
                </p>
                <Badge
                  variant="secondary"
                  className={`text-xs capitalize ${getCategoryColor(template.category)}`}
                >
                  {template.category}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Stop Loss Management</CardTitle>
            </div>
            <CardDescription>
              Configure when and how to move your stop loss
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-sm font-medium">Move SL to Entry</Label>
              <RadioGroup
                value={slTriggerMode}
                onValueChange={handleSlTriggerChange}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="none" id="sl-none" data-testid="radio-sl-none" />
                  <Label htmlFor="sl-none" className="font-normal cursor-pointer">
                    Never move SL to entry
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="tp" id="sl-tp" data-testid="radio-sl-tp" />
                  <Label htmlFor="sl-tp" className="font-normal cursor-pointer">
                    After TP level is hit
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="pips" id="sl-pips" data-testid="radio-sl-pips" />
                  <Label htmlFor="sl-pips" className="font-normal cursor-pointer">
                    After X pips in profit
                  </Label>
                </div>
              </RadioGroup>

              {slTriggerMode === "tp" && (
                <div className="pl-6 space-y-2">
                  <Label htmlFor="sl-tp-level">After which TP level?</Label>
                  <Input
                    id="sl-tp-level"
                    type="number"
                    min="1"
                    max="4"
                    value={strategy.moveSLAfterTP || 1}
                    onChange={(e) => setStrategy({ moveSLAfterTP: parseInt(e.target.value) || 1 })}
                    className="w-24"
                    data-testid="input-sl-tp-level"
                  />
                  <p className="text-xs text-muted-foreground">
                    Move SL to entry when TP{strategy.moveSLAfterTP || 1} is reached
                  </p>
                </div>
              )}

              {slTriggerMode === "pips" && (
                <div className="pl-6 space-y-2">
                  <Label htmlFor="sl-pips-value">After how many pips?</Label>
                  <Input
                    id="sl-pips-value"
                    type="number"
                    min="1"
                    value={strategy.moveSLAfterPips || 20}
                    onChange={(e) => setStrategy({ moveSLAfterPips: parseInt(e.target.value) || 20 })}
                    className="w-24"
                    data-testid="input-sl-pips-value"
                  />
                  <p className="text-xs text-muted-foreground">
                    Move SL to entry when {strategy.moveSLAfterPips || 20} pips in profit
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="trailing-sl">Trailing Stop Loss</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        Automatically move SL to lock in profits as price moves in your favor
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  id="trailing-sl"
                  checked={strategy.trailingSL}
                  onCheckedChange={(checked) => setStrategy({ trailingSL: checked })}
                  data-testid="switch-trailing-sl"
                />
              </div>

              {strategy.trailingSL && (
                <div className="space-y-2">
                  <Label htmlFor="trailing-pips">Trailing Distance (pips)</Label>
                  <Input
                    id="trailing-pips"
                    type="number"
                    min="1"
                    value={strategy.trailingPips || 10}
                    onChange={(e) => setStrategy({ trailingPips: parseInt(e.target.value) || 10 })}
                    className="w-24"
                    data-testid="input-trailing-pips"
                  />
                  <p className="text-xs text-muted-foreground">
                    Trail SL {strategy.trailingPips || 10} pips behind the current price
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Take Profit Settings</CardTitle>
            </div>
            <CardDescription>
              Choose which take profit levels to use and how to handle them
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Use Multiple Take Profits</Label>
                <Switch
                  checked={strategy.useMultipleTPs}
                  onCheckedChange={(checked) => setStrategy({ useMultipleTPs: checked })}
                  data-testid="switch-multiple-tps"
                />
              </div>

              {strategy.useMultipleTPs && (
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">Active TP Levels</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((tp) => (
                      <div
                        key={tp}
                        className="flex items-center space-x-2 p-3 rounded-md border bg-muted/30"
                      >
                        <Checkbox
                          id={`tp-${tp}`}
                          checked={strategy.activeTPs.includes(tp)}
                          onCheckedChange={(checked) => handleTPToggle(tp, !!checked)}
                          data-testid={`checkbox-tp-${tp}`}
                        />
                        <Label htmlFor={`tp-${tp}`} className="font-normal cursor-pointer">
                          Take Profit {tp}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="close-partials">Close Partial Positions</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        Close a percentage of the position at each TP level instead of the full position
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  id="close-partials"
                  checked={strategy.closePartials}
                  onCheckedChange={(checked) => setStrategy({ closePartials: checked })}
                  data-testid="switch-close-partials"
                />
              </div>

              {strategy.closePartials && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Close % at each TP</Label>
                    <Badge variant="secondary" className="font-mono">
                      {strategy.partialClosePercent}%
                    </Badge>
                  </div>
                  <Slider
                    value={[strategy.partialClosePercent]}
                    onValueChange={([value]) => setStrategy({ partialClosePercent: value })}
                    min={10}
                    max={50}
                    step={5}
                    className="w-full"
                    data-testid="slider-partial-close"
                  />
                  <p className="text-xs text-muted-foreground">
                    Close {strategy.partialClosePercent}% of position at each take profit level
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="close-all-tp">Close All Remaining at TP</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Close any remaining position when this TP level is reached
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="close-all-tp"
                type="number"
                min="1"
                max="4"
                placeholder="Leave empty to use last active TP"
                value={strategy.closeAllOnTP || ""}
                onChange={(e) =>
                  setStrategy({ closeAllOnTP: e.target.value ? parseInt(e.target.value) : undefined })
                }
                className="w-full"
                data-testid="input-close-all-tp"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Strategy Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                SL Management
              </div>
              <div className="text-sm font-medium">
                {slTriggerMode === "none"
                  ? "Static SL"
                  : slTriggerMode === "tp"
                  ? `Move to BE after TP${strategy.moveSLAfterTP}`
                  : `Move to BE after ${strategy.moveSLAfterPips} pips`}
              </div>
              {strategy.trailingSL && (
                <Badge variant="secondary" className="mt-2 text-xs">
                  Trailing {strategy.trailingPips} pips
                </Badge>
              )}
            </div>

            <div className="p-4 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Active TPs
              </div>
              <div className="flex gap-1 flex-wrap">
                {strategy.activeTPs.map((tp) => (
                  <Badge key={tp} variant="default" className="text-xs">
                    TP{tp}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Partial Close
              </div>
              <div className="text-sm font-medium">
                {strategy.closePartials ? `${strategy.partialClosePercent}% per TP` : "Disabled"}
              </div>
            </div>

            <div className="p-4 rounded-md bg-muted/30 border">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Final Exit
              </div>
              <div className="text-sm font-medium">
                {strategy.closeAllOnTP
                  ? `Close all at TP${strategy.closeAllOnTP}`
                  : `At TP${Math.max(...strategy.activeTPs)}`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
