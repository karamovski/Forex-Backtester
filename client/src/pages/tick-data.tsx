import { useState, useRef } from "react";
import { Database, Upload, Check, AlertCircle, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBacktestStore } from "@/lib/backtest-store";
import { apiRequest } from "@/lib/queryClient";

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

  const parseSampleRow = (row: string) => {
    const cols = row.split(delimiter);
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Comma (,)</SelectItem>
                    <SelectItem value=";">Semicolon (;)</SelectItem>
                    <SelectItem value="\t">Tab</SelectItem>
                    <SelectItem value=" ">Space</SelectItem>
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
