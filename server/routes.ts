import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { runBacktest } from "./backtest-engine";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  tickFormatSchema,
  signalFormatSchema,
  strategyConfigSchema,
  riskConfigSchema,
  parsedSignalSchema,
} from "@shared/schema";

const upload = multer({
  dest: "/tmp/tick-uploads/",
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

// Chunked upload storage - stores chunks until finalized
const chunkUploadStore = new Map<string, { 
  chunks: Map<number, string>;
  totalChunks: number;
  fileName: string;
  startedAt: Date;
}>();

// Cleanup old incomplete uploads after 30 minutes
setInterval(() => {
  const now = Date.now();
  Array.from(chunkUploadStore.entries()).forEach(([id, uploadData]) => {
    if (now - uploadData.startedAt.getTime() > 30 * 60 * 1000) {
      // Clean up chunk files
      Array.from(uploadData.chunks.values()).forEach(chunkPath => {
        fs.unlink(chunkPath, () => {});
      });
      chunkUploadStore.delete(id);
    }
  });
}, 5 * 60 * 1000); // Check every 5 minutes

const runBacktestRequestSchema = z.object({
  tickDataId: z.string(),
  tickFormat: tickFormatSchema,
  strategy: strategyConfigSchema,
  risk: riskConfigSchema,
  gmtOffset: z.number(),
  parsedSignals: z.array(parsedSignalSchema),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Run backtest endpoint
  app.post("/api/backtest/run", async (req, res) => {
    try {
      const validation = runBacktestRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: validation.error.errors,
        });
      }
      
      const { tickDataId, tickFormat, parsedSignals, strategy, risk, gmtOffset } = validation.data;
      
      if (parsedSignals.length === 0) {
        return res.status(400).json({
          error: "No signals provided",
          message: "Please parse signals before running the backtest",
        });
      }
      
      const results = await runBacktest(
        tickDataId,
        tickFormat,
        parsedSignals,
        strategy,
        risk,
        gmtOffset
      );
      
      return res.json(results);
    } catch (error) {
      console.error("Backtest error:", error);
      return res.status(500).json({
        error: "Backtest failed",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  });
  
  // Parse tick format endpoint (auto-detect from sample)
  app.post("/api/ticks/parse-format", async (req, res) => {
    try {
      const { sampleLines } = req.body as { sampleLines: string[] };
      
      if (!sampleLines || sampleLines.length === 0) {
        return res.status(400).json({
          error: "No sample lines provided",
        });
      }
      
      // Simple auto-detection logic
      const firstDataLine = sampleLines[0];
      let delimiter = ",";
      
      if (firstDataLine.includes("\t")) {
        delimiter = "\t";
      } else if (firstDataLine.includes(";")) {
        delimiter = ";";
      } else if (firstDataLine.includes("|")) {
        delimiter = "|";
      }
      
      const columns = firstDataLine.split(delimiter);
      
      // Try to detect date/time/price columns
      const format = {
        delimiter,
        dateColumn: 0,
        timeColumn: 1,
        bidColumn: 2,
        askColumn: 3,
        dateFormat: "YYYY-MM-DD",
        timeFormat: "HH:mm:ss",
        hasHeader: isNaN(parseFloat(columns[columns.length - 1])),
      };
      
      return res.json(format);
    } catch (error) {
      console.error("Parse format error:", error);
      return res.status(500).json({
        error: "Failed to parse format",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  });
  
  // Upload tick data file
  app.post("/api/ticks/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = req.file.path;
      const fileName = req.file.originalname || "uploaded.csv";
      
      // Read entire file content for database storage
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter(l => l.trim());
      const rowCount = lines.length;
      const sampleRows = lines.slice(0, 10);

      // Store in database
      const tickDataRecord = await storage.createTickData({
        filename: fileName,
        content,
        rowCount,
        sampleRows,
      });

      // Clean up temp file
      fs.unlinkSync(filePath);

      return res.json({ id: tickDataRecord.id, rowCount, sampleRows });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({
        error: "Upload failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Chunked upload - initialize
  app.post("/api/ticks/upload/init", (req, res) => {
    try {
      const { fileName, totalChunks } = req.body;
      
      if (!fileName || !totalChunks || totalChunks < 1) {
        return res.status(400).json({ error: "Invalid upload parameters" });
      }
      
      const uploadId = crypto.randomUUID();
      chunkUploadStore.set(uploadId, {
        chunks: new Map(),
        totalChunks,
        fileName,
        startedAt: new Date(),
      });
      
      return res.json({ uploadId });
    } catch (error) {
      console.error("Init upload error:", error);
      return res.status(500).json({ error: "Failed to initialize upload" });
    }
  });

  // Chunked upload - receive chunk
  app.post("/api/ticks/upload/chunk", upload.single("chunk"), async (req, res) => {
    try {
      const uploadId = req.body.uploadId;
      const chunkIndex = parseInt(req.body.chunkIndex, 10);
      
      if (!uploadId || isNaN(chunkIndex) || !req.file) {
        return res.status(400).json({ error: "Invalid chunk data" });
      }
      
      const uploadData = chunkUploadStore.get(uploadId);
      if (!uploadData) {
        return res.status(404).json({ error: "Upload session not found" });
      }
      
      uploadData.chunks.set(chunkIndex, req.file.path);
      
      return res.json({ 
        received: chunkIndex, 
        total: uploadData.totalChunks,
        complete: uploadData.chunks.size === uploadData.totalChunks
      });
    } catch (error) {
      console.error("Chunk upload error:", error);
      return res.status(500).json({ error: "Failed to receive chunk" });
    }
  });

  // Chunked upload - finalize and combine
  app.post("/api/ticks/upload/finalize", async (req, res) => {
    try {
      const { uploadId } = req.body;
      
      const uploadData = chunkUploadStore.get(uploadId);
      if (!uploadData) {
        return res.status(404).json({ error: "Upload session not found" });
      }
      
      if (uploadData.chunks.size !== uploadData.totalChunks) {
        return res.status(400).json({ 
          error: "Upload incomplete",
          received: uploadData.chunks.size,
          expected: uploadData.totalChunks
        });
      }
      
      // Combine chunks into final file
      const finalPath = `/tmp/tick-uploads/${uploadId}-combined`;
      const writeStream = fs.createWriteStream(finalPath);
      
      for (let i = 0; i < uploadData.totalChunks; i++) {
        const chunkPath = uploadData.chunks.get(i);
        if (!chunkPath) {
          writeStream.close();
          return res.status(400).json({ error: `Missing chunk ${i}` });
        }
        
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
        
        // Clean up chunk file
        fs.unlinkSync(chunkPath);
      }
      
      writeStream.end();
      
      // Wait for write to complete
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
      
      // Read file content for database storage
      const content = fs.readFileSync(finalPath, "utf-8");
      const lines = content.split("\n").filter(l => l.trim());
      const rowCount = lines.length;
      const sampleRows = lines.slice(0, 10);
      
      // Check if we got HTML instead of CSV (common with Google Drive)
      if (sampleRows.length > 0) {
        const firstRow = sampleRows[0].toLowerCase();
        if (firstRow.includes("<!doctype") || firstRow.includes("<html") || firstRow.includes("<script")) {
          fs.unlinkSync(finalPath);
          chunkUploadStore.delete(uploadId);
          return res.status(400).json({
            error: "Received HTML instead of CSV data. The file host may require authentication or confirmation.",
          });
        }
      }
      
      // Store in database
      const tickDataRecord = await storage.createTickData({
        filename: uploadData.fileName,
        content,
        rowCount,
        sampleRows,
      });
      
      // Clean up temp file and upload session
      fs.unlinkSync(finalPath);
      chunkUploadStore.delete(uploadId);
      
      return res.json({ id: tickDataRecord.id, rowCount, sampleRows });
    } catch (error) {
      console.error("Finalize upload error:", error);
      return res.status(500).json({ 
        error: "Failed to finalize upload",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // URL-based upload - server fetches file from provided URL
  app.post("/api/ticks/upload/url", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }
      
      // Validate URL format and security
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "https:") {
          throw new Error("Only HTTPS URLs are allowed");
        }
        
        // Block internal/private hostnames (SSRF protection)
        const hostname = parsedUrl.hostname.toLowerCase();
        const blockedPatterns = [
          /^localhost$/i,
          /^127\./,
          /^10\./,
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
          /^192\.168\./,
          /^169\.254\./,
          /^0\./,
          /\.local$/i,
          /\.internal$/i,
          /^metadata\./i,
          /^169\.254\.169\.254$/,
        ];
        
        if (blockedPatterns.some(pattern => pattern.test(hostname))) {
          throw new Error("Internal/private URLs are not allowed");
        }
      } catch (e) {
        return res.status(400).json({ 
          error: e instanceof Error ? e.message : "Invalid URL format" 
        });
      }
      
      // Fetch the file from the URL
      const response = await fetch(url, {
        headers: {
          "User-Agent": "ForexBacktester/1.0",
        },
        redirect: "follow",
      });
      
      if (!response.ok) {
        return res.status(400).json({ 
          error: `Failed to fetch file: ${response.status} ${response.statusText}` 
        });
      }
      
      const contentLength = response.headers.get("content-length");
      const MAX_SIZE = 500 * 1024 * 1024; // 500MB limit
      
      // Check file size if available
      if (contentLength && parseInt(contentLength) > MAX_SIZE) {
        return res.status(400).json({ error: "File too large (max 500MB)" });
      }
      
      // Save to temp file with streaming size limit
      const filePath = `/tmp/tick-uploads/${crypto.randomUUID()}.csv`;
      const fileStream = fs.createWriteStream(filePath);
      
      // Stream the response body to file with size enforcement
      const reader = response.body?.getReader();
      if (!reader) {
        return res.status(500).json({ error: "Failed to read response" });
      }
      
      let totalBytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          totalBytes += value.length;
          if (totalBytes > MAX_SIZE) {
            reader.cancel();
            fileStream.close();
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: "File too large (max 500MB)" });
          }
          
          fileStream.write(Buffer.from(value));
        }
      } catch (streamError) {
        fileStream.close();
        try { fs.unlinkSync(filePath); } catch {}
        throw streamError;
      }
      
      fileStream.end();
      
      // Wait for file write to complete
      await new Promise<void>((resolve, reject) => {
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
      });
      
      // Read file content for database storage
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter(l => l.trim());
      const rowCount = lines.length;
      const sampleRows = lines.slice(0, 10);
      
      // Check if we got HTML instead of CSV (common with Google Drive)
      if (sampleRows.length > 0) {
        const firstRow = sampleRows[0].toLowerCase();
        if (firstRow.includes("<!doctype") || firstRow.includes("<html") || firstRow.includes("<script") || firstRow.includes("_drive_")) {
          fs.unlinkSync(filePath);
          return res.status(400).json({
            error: "Received HTML page instead of CSV. Google Drive blocks large file downloads. Use the 'Upload File' tab instead.",
          });
        }
      }
      
      // Extract filename from URL
      const urlFileName = url.split("/").pop()?.split("?")[0] || "url-download.csv";
      
      // Store in database
      const tickDataRecord = await storage.createTickData({
        filename: urlFileName,
        content,
        rowCount,
        sampleRows,
      });
      
      // Clean up temp file
      fs.unlinkSync(filePath);
      
      return res.json({ id: tickDataRecord.id, rowCount, sampleRows });
    } catch (error) {
      console.error("URL upload error:", error);
      return res.status(500).json({ 
        error: "Failed to fetch file from URL",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}
