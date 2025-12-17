import { useState } from "react";
import { FolderOpen, FileSpreadsheet, HelpCircle, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useBacktestStore } from "@/lib/backtest-store";
import type { TickFormat } from "@shared/schema";

const TIMEZONE_OPTIONS = [
  { value: "-12", label: "GMT-12:00" },
  { value: "-11", label: "GMT-11:00" },
  { value: "-10", label: "GMT-10:00" },
  { value: "-9", label: "GMT-09:00" },
  { value: "-8", label: "GMT-08:00 (PST)" },
  { value: "-7", label: "GMT-07:00 (MST)" },
  { value: "-6", label: "GMT-06:00 (CST)" },
  { value: "-5", label: "GMT-05:00 (EST)" },
  { value: "-4", label: "GMT-04:00" },
  { value: "-3", label: "GMT-03:00" },
  { value: "-2", label: "GMT-02:00" },
  { value: "-1", label: "GMT-01:00" },
  { value: "0", label: "GMT+00:00 (UTC)" },
  { value: "1", label: "GMT+01:00 (CET)" },
  { value: "2", label: "GMT+02:00 (EET)" },
  { value: "3", label: "GMT+03:00 (MSK)" },
  { value: "4", label: "GMT+04:00" },
  { value: "5", label: "GMT+05:00" },
  { value: "6", label: "GMT+06:00" },
  { value: "7", label: "GMT+07:00" },
  { value: "8", label: "GMT+08:00" },
  { value: "9", label: "GMT+09:00 (JST)" },
  { value: "10", label: "GMT+10:00" },
  { value: "11", label: "GMT+11:00" },
  { value: "12", label: "GMT+12:00" },
  { value: "13", label: "GMT+13:00" },
  { value: "14", label: "GMT+14:00" },
];

const DELIMITER_OPTIONS = [
  { value: ",", label: "Comma (,)" },
  { value: ";", label: "Semicolon (;)" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe (|)" },
  { value: " ", label: "Space" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2024-01-15)" },
  { value: "YYYY.MM.DD", label: "YYYY.MM.DD (2024.01.15)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (15/01/2024)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (01/15/2024)" },
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY (15.01.2024)" },
  { value: "YYYYMMDD", label: "YYYYMMDD (20240115)" },
];

const TIME_FORMAT_OPTIONS = [
  { value: "HH:mm:ss", label: "HH:mm:ss (14:30:45)" },
  { value: "HH:mm:ss.SSS", label: "HH:mm:ss.SSS (14:30:45.123)" },
  { value: "HH:mm", label: "HH:mm (14:30)" },
  { value: "HHmmss", label: "HHmmss (143045)" },
];

export default function DataSetup() {
  const {
    ticksFolder,
    setTicksFolder,
    tickSampleLines,
    setTickSampleLines,
    tickFormat,
    setTickFormat,
    gmtOffset,
    setGmtOffset,
  } = useBacktestStore();

  const [sampleInput, setSampleInput] = useState(tickSampleLines.join("\n"));
  const [localFormat, setLocalFormat] = useState<Partial<TickFormat>>({
    dateColumn: tickFormat?.dateColumn ?? 0,
    timeColumn: tickFormat?.timeColumn ?? 1,
    bidColumn: tickFormat?.bidColumn ?? 2,
    askColumn: tickFormat?.askColumn ?? 3,
    delimiter: tickFormat?.delimiter ?? ",",
    dateFormat: tickFormat?.dateFormat ?? "YYYY-MM-DD",
    timeFormat: tickFormat?.timeFormat ?? "HH:mm:ss",
    hasHeader: tickFormat?.hasHeader ?? true,
  });

  const handleSampleChange = (value: string) => {
    setSampleInput(value);
    const lines = value.split("\n").filter((l) => l.trim());
    setTickSampleLines(lines);
  };

  const handleFormatChange = (key: keyof TickFormat, value: string | number | boolean) => {
    setLocalFormat((prev) => ({ ...prev, [key]: value }));
  };

  const applyFormat = () => {
    if (
      localFormat.delimiter &&
      localFormat.dateFormat &&
      localFormat.timeFormat &&
      localFormat.dateColumn !== undefined &&
      localFormat.timeColumn !== undefined &&
      localFormat.bidColumn !== undefined &&
      localFormat.askColumn !== undefined &&
      localFormat.hasHeader !== undefined
    ) {
      setTickFormat(localFormat as TickFormat);
    }
  };

  const isFormatValid = tickFormat !== null;

  const previewData = () => {
    if (!sampleInput || !localFormat.delimiter) return [];
    const lines = sampleInput.split("\n").filter((l) => l.trim());
    const startIndex = localFormat.hasHeader ? 1 : 0;
    return lines.slice(startIndex, startIndex + 3).map((line) => {
      const cols = line.split(localFormat.delimiter!);
      return {
        date: cols[localFormat.dateColumn ?? 0] || "-",
        time: cols[localFormat.timeColumn ?? 1] || "-",
        bid: cols[localFormat.bidColumn ?? 2] || "-",
        ask: cols[localFormat.askColumn ?? 3] || "-",
      };
    });
  };

  const preview = previewData();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your data format settings for the backtest simulation
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Tick Data Folder</CardTitle>
            </div>
            <CardDescription>
              Specify the folder containing your tick data CSV files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-path">Folder Path</Label>
              <div className="flex gap-2">
                <Input
                  id="folder-path"
                  placeholder="/path/to/ticks/folder"
                  value={ticksFolder}
                  onChange={(e) => setTicksFolder(e.target.value)}
                  className="font-mono text-sm"
                  data-testid="input-folder-path"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the full path to the folder containing your CSV tick data files
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="gmt-offset">Tick Data Timezone</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Select the timezone of your tick data timestamps. This is used to correctly align signals with price data.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={gmtOffset.toString()}
                onValueChange={(v) => setGmtOffset(parseInt(v))}
              >
                <SelectTrigger data-testid="select-timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {ticksFolder && (
              <div className="flex items-center gap-2 pt-2">
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />
                  Folder configured
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Sample Data</CardTitle>
            </div>
            <CardDescription>
              Paste the first 2-3 lines of your tick data file to configure parsing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sample-lines">Sample Lines</Label>
              <Textarea
                id="sample-lines"
                placeholder="2024-01-15,10:30:00,1.08765,1.08770&#10;2024-01-15,10:30:01,1.08768,1.08773"
                value={sampleInput}
                onChange={(e) => handleSampleChange(e.target.value)}
                className="font-mono text-xs min-h-[100px] resize-none"
                data-testid="textarea-sample-lines"
              />
              <p className="text-xs text-muted-foreground">
                Include the header row if your files have one
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Format Configuration</CardTitle>
              <CardDescription>
                Define how to parse your tick data columns
              </CardDescription>
            </div>
            {isFormatValid && (
              <Badge className="gap-1">
                <Check className="h-3 w-3" />
                Format Applied
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="delimiter">Delimiter</Label>
              <Select
                value={localFormat.delimiter}
                onValueChange={(v) => handleFormatChange("delimiter", v)}
              >
                <SelectTrigger id="delimiter" data-testid="select-delimiter">
                  <SelectValue placeholder="Select delimiter" />
                </SelectTrigger>
                <SelectContent>
                  {DELIMITER_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-format">Date Format</Label>
              <Select
                value={localFormat.dateFormat}
                onValueChange={(v) => handleFormatChange("dateFormat", v)}
              >
                <SelectTrigger id="date-format" data-testid="select-date-format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMAT_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-format">Time Format</Label>
              <Select
                value={localFormat.timeFormat}
                onValueChange={(v) => handleFormatChange("timeFormat", v)}
              >
                <SelectTrigger id="time-format" data-testid="select-time-format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_FORMAT_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="has-header"
                checked={localFormat.hasHeader}
                onCheckedChange={(v) => handleFormatChange("hasHeader", v)}
                data-testid="switch-has-header"
              />
              <Label htmlFor="has-header">Has Header Row</Label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="date-col">Date Column (0-indexed)</Label>
              <Input
                id="date-col"
                type="number"
                min="0"
                value={localFormat.dateColumn ?? 0}
                onChange={(e) => handleFormatChange("dateColumn", parseInt(e.target.value) || 0)}
                data-testid="input-date-column"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-col">Time Column (0-indexed)</Label>
              <Input
                id="time-col"
                type="number"
                min="0"
                value={localFormat.timeColumn ?? 1}
                onChange={(e) => handleFormatChange("timeColumn", parseInt(e.target.value) || 0)}
                data-testid="input-time-column"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bid-col">Bid Column (0-indexed)</Label>
              <Input
                id="bid-col"
                type="number"
                min="0"
                value={localFormat.bidColumn ?? 2}
                onChange={(e) => handleFormatChange("bidColumn", parseInt(e.target.value) || 0)}
                data-testid="input-bid-column"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ask-col">Ask Column (0-indexed)</Label>
              <Input
                id="ask-col"
                type="number"
                min="0"
                value={localFormat.askColumn ?? 3}
                onChange={(e) => handleFormatChange("askColumn", parseInt(e.target.value) || 0)}
                data-testid="input-ask-column"
              />
            </div>
          </div>

          {preview.length > 0 && (
            <div className="space-y-3">
              <Label>Preview (parsed data)</Label>
              <div className="rounded-md border bg-muted/30 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Time</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Bid</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Ask</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-2">{row.date}</td>
                        <td className="px-4 py-2">{row.time}</td>
                        <td className="px-4 py-2 text-right">{row.bid}</td>
                        <td className="px-4 py-2 text-right">{row.ask}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={applyFormat} data-testid="button-apply-format">
              Apply Format
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
