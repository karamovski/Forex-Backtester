import { useState } from "react";
import { FileText, Upload, Wand2, Check, AlertCircle, HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBacktestStore } from "@/lib/backtest-store";
import type { ParsedSignal, SignalFormat } from "@shared/schema";

const EXAMPLE_FORMATS = [
  {
    name: "Market Entry (Date/Time/Direction/SL/TP)",
    pattern: "{date} {time} {direction} {sl} {tp1}",
    example: "2025-09-18 14:48:18 BUY 3658 3670",
  },
  {
    name: "Standard Format",
    pattern: "{direction} {symbol} at {entry} sl at {sl} tp at {tp1}",
    example: "buy gold at 1234.50 sl at 1230.00 tp at 1240.00",
  },
  {
    name: "Multi-TP Format",
    pattern: "{symbol} {direction} now sl at {sl} tp1 at {tp1} tp2 at {tp2} tp3 at {tp3}",
    example: "EURUSD buy now sl at 1.0850 tp1 at 1.0900 tp2 at 1.0950 tp3 at 1.1000",
  },
  {
    name: "Simple Format",
    pattern: "{direction} {symbol} {entry} SL:{sl} TP:{tp1}",
    example: "BUY XAUUSD 1950.00 SL:1945.00 TP:1960.00",
  },
  {
    name: "Compact Format",
    pattern: "{symbol}|{direction}|{entry}|{sl}|{tp1}|{tp2}|{tp3}|{tp4}",
    example: "GBPUSD|sell|1.2650|1.2700|1.2600|1.2550|1.2500|1.2450",
  },
];

function parseSignalFromPattern(text: string, format: SignalFormat): ParsedSignal | null {
  try {
    let pattern = format.pattern;
    
    const allPlaceholders = [
      { key: "symbol", ph: format.symbolPlaceholder },
      { key: "direction", ph: format.directionPlaceholder },
      { key: "entry", ph: format.entryPlaceholder },
      { key: "sl", ph: format.slPlaceholder },
      { key: "tp1", ph: format.tp1Placeholder },
      { key: "tp2", ph: format.tp2Placeholder },
      { key: "tp3", ph: format.tp3Placeholder },
      { key: "tp4", ph: format.tp4Placeholder },
    ].filter((p) => p.ph);

    // Date/time placeholders - captured for timestamp
    const timePlaceholders = [
      { key: "date", ph: "{date}" },
      { key: "time", ph: "{time}" },
      { key: "timestamp", ph: "{timestamp}" },
    ];

    // First replace spaces with a temporary marker before escaping
    let regexPattern = pattern.replace(/ /g, "<<SPACE>>");
    
    // Escape special regex chars
    regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    // Replace time placeholders with capturing groups (allow slashes, dashes, dots, colons, spaces)
    for (const { key, ph } of timePlaceholders) {
      const escapedPh = ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (pattern.includes(ph)) {
        regexPattern = regexPattern.replace(escapedPh, `(?<${key}>[\\w.:/\\-]+)`);
      }
    }
    
    // Replace captured placeholders with named groups
    for (const { key, ph } of allPlaceholders) {
      if (ph) {
        const escapedPh = ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        regexPattern = regexPattern.replace(escapedPh, `(?<${key}>[\\w.:-]+)`);
      }
    }
    
    // Replace space markers with flexible whitespace matching
    regexPattern = regexPattern.replace(/<<SPACE>>/g, "\\s+");
    
    const regex = new RegExp(regexPattern, "i");
    const match = text.match(regex);
    
    if (!match || !match.groups) return null;
    
    const groups = match.groups;
    const direction = groups.direction?.toLowerCase();
    
    if (direction !== "buy" && direction !== "sell") return null;
    
    const takeProfits: number[] = [];
    if (groups.tp1) takeProfits.push(parseFloat(groups.tp1));
    if (groups.tp2) takeProfits.push(parseFloat(groups.tp2));
    if (groups.tp3) takeProfits.push(parseFloat(groups.tp3));
    if (groups.tp4) takeProfits.push(parseFloat(groups.tp4));
    
    // Build timestamp from date and time if available
    let timestamp: string | undefined;
    if (groups.timestamp) {
      timestamp = groups.timestamp;
    } else if (groups.date && groups.time) {
      timestamp = `${groups.date} ${groups.time}`;
    } else if (groups.date) {
      timestamp = groups.date;
    }
    
    // Entry price is optional - if not provided, backtest engine uses market price at signal time
    // IMPORTANT: Only use entry if it was explicitly captured, otherwise default to 0 (market entry)
    const hasEntryInPattern = format.entryPlaceholder && format.entryPlaceholder.length > 0;
    const entryPrice = hasEntryInPattern && groups.entry ? parseFloat(groups.entry) : 0;
    
    return {
      id: crypto.randomUUID(),
      rawText: text,
      symbol: groups.symbol?.toUpperCase() || "SIGNAL",
      direction: direction as "buy" | "sell",
      entryPrice,
      stopLoss: parseFloat(groups.sl) || 0,
      takeProfits: takeProfits.filter((tp) => !isNaN(tp)),
      timestamp,
    };
  } catch {
    return null;
  }
}

export default function Signals() {
  const {
    signalsContent,
    setSignalsContent,
    signalFormatPattern,
    setSignalFormatPattern,
    signalFormat,
    setSignalFormat,
    parsedSignals,
    setParsedSignals,
  } = useBacktestStore();

  const [localPattern, setLocalPattern] = useState(signalFormatPattern || EXAMPLE_FORMATS[0].pattern);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setSignalsContent(content);
    };
    reader.readAsText(file);
  };

  const applyFormat = () => {
    // Support {tp} as alias for {tp1}
    const hasTp = localPattern.includes("{tp}") && !localPattern.includes("{tp1}");
    const hasSymbol = localPattern.includes("{symbol}");
    const hasEntry = localPattern.includes("{entry}");
    const format: SignalFormat = {
      pattern: localPattern,
      symbolPlaceholder: hasSymbol ? "{symbol}" : "",
      directionPlaceholder: "{direction}",
      entryPlaceholder: hasEntry ? "{entry}" : "",
      slPlaceholder: "{sl}",
      tp1Placeholder: hasTp ? "{tp}" : "{tp1}",
      tp2Placeholder: localPattern.includes("{tp2}") ? "{tp2}" : undefined,
      tp3Placeholder: localPattern.includes("{tp3}") ? "{tp3}" : undefined,
      tp4Placeholder: localPattern.includes("{tp4}") ? "{tp4}" : undefined,
    };
    setSignalFormat(format);
    setSignalFormatPattern(localPattern);
  };

  const parseSignals = () => {
    if (!localPattern || !signalsContent) {
      setParseError("Please set a format pattern and provide signals content");
      return;
    }

    // Build the format fresh from the current pattern (don't rely on stale store state)
    const hasTp = localPattern.includes("{tp}") && !localPattern.includes("{tp1}");
    const hasSymbol = localPattern.includes("{symbol}");
    const hasEntry = localPattern.includes("{entry}");
    const currentFormat: SignalFormat = {
      pattern: localPattern,
      symbolPlaceholder: hasSymbol ? "{symbol}" : "",
      directionPlaceholder: "{direction}",
      entryPlaceholder: hasEntry ? "{entry}" : "",
      slPlaceholder: "{sl}",
      tp1Placeholder: hasTp ? "{tp}" : "{tp1}",
      tp2Placeholder: localPattern.includes("{tp2}") ? "{tp2}" : undefined,
      tp3Placeholder: localPattern.includes("{tp3}") ? "{tp3}" : undefined,
      tp4Placeholder: localPattern.includes("{tp4}") ? "{tp4}" : undefined,
    };

    // Update the store
    setSignalFormat(currentFormat);
    setSignalFormatPattern(localPattern);

    // Debug: Log the format being used
    console.log("Parsing with format:", JSON.stringify(currentFormat, null, 2));
    console.log("Entry placeholder is:", currentFormat.entryPlaceholder ? `"${currentFormat.entryPlaceholder}"` : "empty (market entry)");

    setParseError(null);
    const lines = signalsContent.split("\n").filter((l) => l.trim());
    const parsed: ParsedSignal[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      const signal = parseSignalFromPattern(line.trim(), currentFormat);
      if (signal) {
        // Debug: Log first parsed signal
        if (parsed.length === 0) {
          console.log("First parsed signal:", JSON.stringify(signal, null, 2));
        }
        parsed.push(signal);
      } else {
        errors.push(line.substring(0, 50) + (line.length > 50 ? "..." : ""));
      }
    }

    setParsedSignals(parsed);
    
    if (errors.length > 0 && parsed.length === 0) {
      setParseError(`Could not parse any signals. Check your format pattern.`);
    } else if (errors.length > 0) {
      setParseError(`Parsed ${parsed.length} signals. ${errors.length} lines could not be parsed.`);
    }
  };

  const useExampleFormat = (format: typeof EXAMPLE_FORMATS[0]) => {
    setLocalPattern(format.pattern);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Signal Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import your trading signals and configure the parsing format
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Import Signals</CardTitle>
            </div>
            <CardDescription>
              Upload a text file or paste your trading signals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signal-file">Upload File</Label>
              <Input
                id="signal-file"
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="cursor-pointer"
                data-testid="input-signal-file"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or paste directly</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signals-content">Signals Content</Label>
              <Textarea
                id="signals-content"
                placeholder="buy gold at 1950.00 sl at 1945.00 tp at 1960.00&#10;sell eurusd at 1.0900 sl at 1.0950 tp at 1.0850"
                value={signalsContent}
                onChange={(e) => setSignalsContent(e.target.value)}
                className="font-mono text-xs min-h-[200px] resize-none"
                data-testid="textarea-signals-content"
              />
              <p className="text-xs text-muted-foreground">
                One signal per line
              </p>
            </div>

            {signalsContent && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {signalsContent.split("\n").filter((l) => l.trim()).length} lines loaded
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Format Pattern</CardTitle>
            </div>
            <CardDescription>
              Define how to parse your signal format using placeholders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="format-pattern">Pattern</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs">
                      Use placeholders: {"{symbol}"}, {"{direction}"}, {"{entry}"}, {"{sl}"}, {"{tp1}"}, {"{tp2}"}, {"{tp3}"}, {"{tp4}"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="format-pattern"
                placeholder="{direction} {symbol} at {entry} sl at {sl} tp at {tp1}"
                value={localPattern}
                onChange={(e) => setLocalPattern(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-format-pattern"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Example Formats</Label>
              <div className="grid gap-2">
                {EXAMPLE_FORMATS.map((format, i) => (
                  <button
                    key={i}
                    onClick={() => useExampleFormat(format)}
                    className="text-left p-3 rounded-md border bg-muted/30 hover-elevate active-elevate-2 transition-colors"
                    data-testid={`button-example-format-${i}`}
                  >
                    <div className="text-xs font-medium">{format.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-1 truncate">
                      {format.pattern}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={applyFormat} variant="secondary" data-testid="button-apply-format">
                Apply Format
              </Button>
              {signalFormat && (
                <Badge className="gap-1">
                  <Check className="h-3 w-3" />
                  Format Set
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Parse & Preview Signals</CardTitle>
              <CardDescription>
                Test your format pattern and preview parsed signals
              </CardDescription>
            </div>
            <Button onClick={parseSignals} disabled={!signalFormat || !signalsContent} data-testid="button-parse-signals">
              <FileText className="h-4 w-4 mr-2" />
              Parse Signals
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {parseError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive mb-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm">{parseError}</p>
            </div>
          )}

          {parsedSignals.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  {parsedSignals.length} signals parsed
                </Badge>
              </div>
              <ScrollArea className="h-[300px] rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Symbol</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Direction</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Entry</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">SL</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">TP1</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">TP2</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">TP3</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {parsedSignals.map((signal, i) => (
                      <tr key={signal.id} className="border-b last:border-0" data-testid={`row-signal-${i}`}>
                        <td className="px-4 py-2 font-medium">{signal.symbol}</td>
                        <td className="px-4 py-2">
                          <Badge
                            variant={signal.direction === "buy" ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {signal.direction.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {signal.entryPrice === 0 ? (
                            <span className="text-muted-foreground italic">Market</span>
                          ) : (
                            signal.entryPrice.toFixed(5)
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">{signal.stopLoss.toFixed(5)}</td>
                        <td className="px-4 py-2 text-right">{signal.takeProfits[0]?.toFixed(5) || "-"}</td>
                        <td className="px-4 py-2 text-right">{signal.takeProfits[1]?.toFixed(5) || "-"}</td>
                        <td className="px-4 py-2 text-right">{signal.takeProfits[2]?.toFixed(5) || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">
                No signals parsed yet. Import signals and click "Parse Signals" to preview.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
