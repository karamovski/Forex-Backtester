import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, tickDataStore } from "./storage";
import { runBacktest } from "./backtest-engine";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import { createReadStream } from "fs";
import { parse } from "csv-parse";
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
      let rowCount = 0;
      const sampleRows: string[] = [];

      // Count rows and collect samples
      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(filePath, { encoding: "utf-8" });
        let buffer = "";
        
        stream.on("data", (chunk: string) => {
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.trim()) {
              rowCount++;
              if (sampleRows.length < 10) {
                sampleRows.push(line.trim());
              }
            }
          }
        });
        
        stream.on("end", () => {
          if (buffer.trim()) {
            rowCount++;
            if (sampleRows.length < 10) {
              sampleRows.push(buffer.trim());
            }
          }
          resolve();
        });
        
        stream.on("error", reject);
      });

      const id = crypto.randomUUID();
      tickDataStore.add({
        id,
        filePath,
        rowCount,
        sampleRows,
        uploadedAt: new Date(),
      });

      return res.json({ id, rowCount, sampleRows });
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
      
      // Process the combined file (count rows, get samples)
      let rowCount = 0;
      const sampleRows: string[] = [];
      
      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(finalPath, { encoding: "utf-8" });
        let buffer = "";
        
        stream.on("data", (chunk: string) => {
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.trim()) {
              rowCount++;
              if (sampleRows.length < 10) {
                sampleRows.push(line.trim());
              }
            }
          }
        });
        
        stream.on("end", () => {
          if (buffer.trim()) {
            rowCount++;
            if (sampleRows.length < 10) {
              sampleRows.push(buffer.trim());
            }
          }
          resolve();
        });
        
        stream.on("error", reject);
      });
      
      const id = crypto.randomUUID();
      tickDataStore.add({
        id,
        filePath: finalPath,
        rowCount,
        sampleRows,
        uploadedAt: new Date(),
      });
      
      // Clean up upload session
      chunkUploadStore.delete(uploadId);
      
      return res.json({ id, rowCount, sampleRows });
    } catch (error) {
      console.error("Finalize upload error:", error);
      return res.status(500).json({ 
        error: "Failed to finalize upload",
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
