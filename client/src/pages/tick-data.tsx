import { useState, useRef } from "react";
import { Database, Upload, Check, AlertCircle, Settings2, Wand2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useBacktestStore } from "@/lib/backtest-store";
import { apiRequest } from "@/lib/queryClient";

interface DetectionResult {
  delimiter: string;
  hasHeader: boolean;
  dateColumn: number;
  timeColumn: number;
  bidColumn: number;
  askColumn: number;
  dateFormat: string;
  timeFormat: string;
  confidence: number;
}

function detectTickFormat(sample: string): DetectionResult | null {
  const lines = sample.trim().split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return null;

  const delimiters = ["\t", ";", ",", /\s+/];
  let bestDelimiter: string | RegExp = "\t";
  let maxScore = 0;

  for (const del of delimiters) {
    const colCounts = lines.map(line => 
      typeof del === "string" ? line.split(del).length : line.split(del).length
    );
    const consistent = colCounts.every(c => c === colCounts[0]);
    const colCount = colCounts[0];
    const score = consistent && colCount > 3 ? colCount * 3 : (consistent ? colCount * 2 : colCount);
    if (score > maxScore && colCount > 1) {
      maxScore = score;
      bestDelimiter = del;
    }
  }
  
  let delimiterStr: string;
  if (bestDelimiter instanceof RegExp) {
    delimiterStr = "space";
  } else if (bestDelimiter === "\t") {
    delimiterStr = "tab";
  } else {
    delimiterStr = bestDelimiter;
  }

  const rows = lines.map(line => 
    (bestDelimiter instanceof RegExp ? line.split(bestDelimiter) : line.split(bestDelimiter))
      .map(c => c.trim())
      .filter(c => c.length > 0)
  );
  const firstRow = rows[0];

  const hasHeader = firstRow.some(col => {
    const cleaned = col.replace(/[<>]/g, '').toLowerCase();
    return ['date', 'time', 'bid', 'ask', 'volume', 'last', 'flags'].includes(cleaned);
  });

  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (dataRows.length === 0) return null;
  
  const dataRow = dataRows[0];
  const headerRow = hasHeader ? firstRow.map(c => c.replace(/[<>]/g, '').toLowerCase()) : [];

  let dateCol = 0, timeCol = 1, bidCol = 2, askCol = 3;
  let dateFormat = "YYYY-MM-DD";
  let timeFormat = "HH:mm:ss";

  const datePatterns = [
    { regex: /^\d{4}\.\d{2}\.\d{2}$/, format: "YYYY.MM.DD" },
    { regex: /^\d{4}-\d{2}-\d{2}$/, format: "YYYY-MM-DD" },
    { regex: /^\d{2}\/\d{2}\/\d{4}$/, format: "DD/MM/YYYY" },
    { regex: /^\d{2}-\d{2}-\d{4}$/, format: "DD-MM-YYYY" },
  ];

  const timePatterns = [
    { regex: /^\d{2}:\d{2}:\d{2}\.\d{3}$/, format: "HH:mm:ss.SSS" },
    { regex: /^\d{2}:\d{2}:\d{2}$/, format: "HH:mm:ss" },
    { regex: /^\d{2}:\d{2}$/, format: "HH:mm" },
  ];

  for (let i = 0; i < dataRow.length; i++) {
    const col = dataRow[i];
    const header = headerRow[i] || "";
    
    if (header === "date" || datePatterns.some(p => p.regex.test(col))) {
      dateCol = i;
      const match = datePatterns.find(p => p.regex.test(col));
      if (match) dateFormat = match.format;
    }

    if (header === "time" || timePatterns.some(p => p.regex.test(col))) {
      timeCol = i;
      const match = timePatterns.find(p => p.regex.test(col));
      if (match) timeFormat = match.format;
    }
  }

  if (hasHeader) {
    const bidIdx = headerRow.findIndex(h => h === "bid");
    const askIdx = headerRow.findIndex(h => h === "ask");
    if (bidIdx !== -1) bidCol = bidIdx;
    if (askIdx !== -1) askCol = askIdx;
  } else {
    const numericCols: { col: number; values: number[] }[] = [];
    
    for (let i = 0; i < dataRow.length; i++) {
      if (i === dateCol || i === timeCol) continue;
      
      const values = dataRows.slice(0, 5).map(row => parseFloat(row[i] || ""));
      if (values.every(v => !isNaN(v) && v > 0)) {
        numericCols.push({ col: i, values });
      }
    }

    const pricePairs: { col1: number; col2: number; score: number }[] = [];
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const spreads = numericCols[i].values.map((v, idx) => 
          numericCols[j].values[idx] - v
        );
        
        const allPositive = spreads.every(s => s > 0);
        const allNegative = spreads.every(s => s < 0);
        const consistent = allPositive || allNegative;
        
        if (!consistent) continue;
        
        const avgSpread = spreads.reduce((a, b) => a + Math.abs(b), 0) / spreads.length;
        const avgValue = numericCols[i].values.reduce((a, b) => a + b, 0) / numericCols[i].values.length;
        const spreadRatio = avgSpread / avgValue;
        
        if (spreadRatio > 0.00001 && spreadRatio < 0.005) {
          pricePairs.push({
            col1: numericCols[i].col,
            col2: numericCols[j].col,
            score: spreadRatio,
          });
        }
      }
    }

    if (pricePairs.length > 0) {
      pricePairs.sort((a, b) => a.score - b.score);
      const bestPair = pricePairs[0];
      const val1 = parseFloat(dataRow[bestPair.col1]);
      const val2 = parseFloat(dataRow[bestPair.col2]);
      bidCol = val1 < val2 ? bestPair.col1 : bestPair.col2;
      askCol = val1 < val2 ? bestPair.col2 : bestPair.col1;
    } else if (numericCols.length >= 2) {
      bidCol = numericCols[0].col;
      askCol = numericCols[1].col;
    }
  }

  return {
    delimiter: delimiterStr,
    hasHeader,
    dateColumn: dateCol,
    timeColumn: timeCol,
    bidColumn: bidCol,
    askColumn: askCol,
    dateFormat,
    timeFormat,
    confidence: hasHeader ? 0.95 : 0.75,
  };
}

export default function TickData() {
  const {
    tickDataId,
    tickDataLoaded,
    tickRowCount,
    tickSampleRows,
    tickFormat,
    setTickDataId,
    setTickDataLoaded,
    setTickSampleRows,
    setTickFormat,
  } = useBacktestStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const [sampleText, setSampleText] = useState("");
  const [detectionStatus, setDetectionStatus] = useState<"idle" | "success" | "error">("idle");
  
  const [delimiter, setDelimiter] = useState(tickFormat?.delimiter || ",");
  const [dateCol, setDateCol] = useState(tickFormat?.dateColumn?.toString() || "0");
  const [timeCol, setTimeCol] = useState(tickFormat?.timeColumn?.toString() || "1");
  const [bidCol, setBidCol] = useState(tickFormat?.bidColumn?.toString() || "2");
  const [askCol, setAskCol] = useState(tickFormat?.askColumn?.toString() || "3");
  const [dateFormat, setDateFormat] = useState(tickFormat?.dateFormat || "YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState(tickFormat?.timeFormat || "HH:mm:ss");
  const [hasHeader, setHasHeader] = useState(tickFormat?.hasHeader ?? false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setTickDataId(response.id);
          setTickSampleRows(response.sampleRows);
          setTickDataLoaded(true, response.rowCount);
          setUploadProgress(100);
        } else {
          setUploadError("Upload failed: " + xhr.statusText);
        }
        setUploading(false);
      };

      xhr.onerror = () => {
        setUploadError("Upload failed. Check file size and format.");
        setUploading(false);
      };

      xhr.open("POST", "/api/ticks/upload");
      xhr.send(formData);
    } catch (err) {
      setUploadError("Failed to upload file");
      setUploading(false);
    }
  };

  const handleDetectFormat = () => {
    const result = detectTickFormat(sampleText);
    if (result) {
      setDelimiter(result.delimiter);
      setDateCol(result.dateColumn.toString());
      setTimeCol(result.timeColumn.toString());
      setBidCol(result.bidColumn.toString());
      setAskCol(result.askColumn.toString());
      setDateFormat(result.dateFormat);
      setTimeFormat(result.timeFormat);
      setHasHeader(result.hasHeader);
      setDetectionStatus("success");
      
      const sampleLines = sampleText.trim().split(/\r?\n/).filter(line => line.trim());
      if (sampleLines.length > 0) {
        setTickSampleRows(sampleLines.slice(0, 10));
      }
    } else {
      setDetectionStatus("error");
    }
  };

  const applyFormat = () => {
    setTickFormat({
      dateColumn: parseInt(dateCol),
      timeColumn: parseInt(timeCol),
      bidColumn: parseInt(bidCol),
      askColumn: parseInt(askCol),
      delimiter,
      dateFormat,
      timeFormat,
      hasHeader,
    });
  };

  const getDelimiterRegex = (del: string): string | RegExp => {
    if (del === "tab") return "\t";
    if (del === "space") return /\s+/;
    return del;
  };

  const parseSampleRow = (row: string) => {
    const del = getDelimiterRegex(delimiter);
    const cols = row.split(del).map(c => c.trim()).filter(c => c.length > 0);
    return {
      date: cols[parseInt(dateCol)] || "-",
      time: cols[parseInt(timeCol)] || "-",
      bid: cols[parseInt(bidCol)] || "-",
      ask: cols[parseInt(askCol)] || "-",
    };
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Tick Data Setup
        </h1>
        <p className="text-muted-foreground">
          Upload your historical tick data file for accurate backtesting
        </p>
      </div>

      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Auto-Detect Format
          </CardTitle>
          <CardDescription>
            Paste a few lines from your tick data file and we'll automatically detect the format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste 3-5 lines from your CSV file here...&#10;&#10;Example:&#10;<DATE><TIME><BID><ASK><LAST><VOLUME><FLAGS>&#10;2025.10.14    16:36:17.568    4110.17 4110.256        ..."
            value={sampleText}
            onChange={(e) => {
              setSampleText(e.target.value);
              setDetectionStatus("idle");
            }}
            className="min-h-32 font-mono text-sm"
            data-testid="textarea-sample"
          />
          
          <div className="flex items-center gap-4">
            <Button
              onClick={handleDetectFormat}
              disabled={sampleText.trim().length < 20}
              data-testid="button-detect-format"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Detect Format
            </Button>
            
            {detectionStatus === "success" && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400" data-testid="text-detection-success">
                <Check className="h-4 w-4" />
                <span>Format detected! Check settings below.</span>
              </div>
            )}
            
            {detectionStatus === "error" && (
              <div className="flex items-center gap-2 text-destructive" data-testid="text-detection-error">
                <AlertCircle className="h-4 w-4" />
                <span>Could not detect format. Please configure manually.</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Tick Data
            </CardTitle>
            <CardDescription>
              CSV file with date, time, bid, ask columns. Supports files up to 500MB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-tick-file"
            />
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
              variant="outline"
              data-testid="button-upload-ticks"
            >
              <Database className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Select Tick Data File"}
            </Button>

            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} data-testid="progress-upload" />
                <p className="text-sm text-muted-foreground text-center">
                  {uploadProgress}% uploaded
                </p>
              </div>
            )}

            {uploadError && (
              <div className="flex items-center gap-2 text-destructive text-sm" data-testid="text-upload-error">
                <AlertCircle className="h-4 w-4" />
                {uploadError}
              </div>
            )}

            {tickDataLoaded && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400" data-testid="text-upload-success">
                <Check className="h-4 w-4" />
                <span>{tickRowCount.toLocaleString()} rows loaded</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Column Configuration
            </CardTitle>
            <CardDescription>
              Map columns to date, time, bid, and ask values
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delimiter">Delimiter</Label>
                <Select value={delimiter} onValueChange={setDelimiter}>
                  <SelectTrigger id="delimiter" data-testid="select-delimiter">
                    <SelectValue placeholder="Select delimiter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Comma (,)</SelectItem>
                    <SelectItem value=";">Semicolon (;)</SelectItem>
                    <SelectItem value="tab">Tab</SelectItem>
                    <SelectItem value="space">Space</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hasHeader">Has Header Row</Label>
                <Select value={hasHeader ? "yes" : "no"} onValueChange={(v) => setHasHeader(v === "yes")}>
                  <SelectTrigger id="hasHeader" data-testid="select-has-header">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateCol">Date Col</Label>
                <Input
                  id="dateCol"
                  type="number"
                  min="0"
                  value={dateCol}
                  onChange={(e) => setDateCol(e.target.value)}
                  data-testid="input-date-col"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeCol">Time Col</Label>
                <Input
                  id="timeCol"
                  type="number"
                  min="0"
                  value={timeCol}
                  onChange={(e) => setTimeCol(e.target.value)}
                  data-testid="input-time-col"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bidCol">Bid Col</Label>
                <Input
                  id="bidCol"
                  type="number"
                  min="0"
                  value={bidCol}
                  onChange={(e) => setBidCol(e.target.value)}
                  data-testid="input-bid-col"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="askCol">Ask Col</Label>
                <Input
                  id="askCol"
                  type="number"
                  min="0"
                  value={askCol}
                  onChange={(e) => setAskCol(e.target.value)}
                  data-testid="input-ask-col"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Date Format</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger id="dateFormat" data-testid="select-date-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    <SelectItem value="YYYY.MM.DD">YYYY.MM.DD</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeFormat">Time Format</Label>
                <Select value={timeFormat} onValueChange={setTimeFormat}>
                  <SelectTrigger id="timeFormat" data-testid="select-time-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HH:mm:ss">HH:mm:ss</SelectItem>
                    <SelectItem value="HH:mm:ss.SSS">HH:mm:ss.SSS</SelectItem>
                    <SelectItem value="HH:mm">HH:mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={applyFormat} 
              className="w-full"
              disabled={!tickDataLoaded}
              data-testid="button-apply-format"
            >
              Apply Configuration
            </Button>
          </CardContent>
        </Card>
      </div>

      {tickSampleRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Sample rows from your tick data (first 10 rows)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-2 font-mono text-sm">
                <div className="grid grid-cols-5 gap-2 font-semibold text-muted-foreground border-b pb-2">
                  <span>Row</span>
                  <span>Date</span>
                  <span>Time</span>
                  <span>Bid</span>
                  <span>Ask</span>
                </div>
                {tickSampleRows.map((row, i) => {
                  const parsed = parseSampleRow(row);
                  return (
                    <div key={i} className="grid grid-cols-5 gap-2" data-testid={`row-tick-sample-${i}`}>
                      <span className="text-muted-foreground">{i + 1}</span>
                      <span>{parsed.date}</span>
                      <span>{parsed.time}</span>
                      <span>{parsed.bid}</span>
                      <span>{parsed.ask}</span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {tickFormat && tickDataLoaded && (
        <div className="flex justify-center">
          <Badge variant="secondary" className="text-base px-4 py-2" data-testid="badge-ready">
            <Check className="mr-2 h-4 w-4" />
            Tick data configured - proceed to Signals
          </Badge>
        </div>
      )}
    </div>
  );
}
