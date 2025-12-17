import { z } from "zod";

// Tick data format configuration
export const tickFormatSchema = z.object({
  dateColumn: z.number().min(0),
  timeColumn: z.number().min(0),
  bidColumn: z.number().min(0),
  askColumn: z.number().min(0),
  delimiter: z.string().min(1),
  dateFormat: z.string().min(1),
  timeFormat: z.string().min(1),
  hasHeader: z.boolean(),
});

export type TickFormat = z.infer<typeof tickFormatSchema>;

// Signal format configuration
export const signalFormatSchema = z.object({
  pattern: z.string().min(1),
  symbolPlaceholder: z.string().default("{symbol}"),
  directionPlaceholder: z.string().default("{direction}"),
  entryPlaceholder: z.string().default("{entry}"),
  slPlaceholder: z.string().default("{sl}"),
  tp1Placeholder: z.string().default("{tp1}"),
  tp2Placeholder: z.string().optional(),
  tp3Placeholder: z.string().optional(),
  tp4Placeholder: z.string().optional(),
});

export type SignalFormat = z.infer<typeof signalFormatSchema>;

// Parsed signal
export const parsedSignalSchema = z.object({
  id: z.string(),
  rawText: z.string(),
  symbol: z.string(),
  direction: z.enum(["buy", "sell"]),
  entryPrice: z.number(),
  stopLoss: z.number(),
  takeProfits: z.array(z.number()),
  timestamp: z.string().optional(),
});

export type ParsedSignal = z.infer<typeof parsedSignalSchema>;

// Strategy configuration
export const strategyConfigSchema = z.object({
  // SL Management
  moveSLToEntry: z.boolean().default(false),
  moveSLAfterTP: z.number().optional(), // After which TP level (1, 2, 3...)
  moveSLAfterPips: z.number().optional(), // After X pips in profit
  trailingSL: z.boolean().default(false),
  trailingPips: z.number().optional(),
  
  // TP Management
  useMultipleTPs: z.boolean().default(true),
  activeTPs: z.array(z.number()).default([1]), // Which TPs to use (1, 2, 3, 4)
  closePartials: z.boolean().default(false),
  partialClosePercent: z.number().min(1).max(100).default(25), // % to close at each TP
  
  // Exit rules
  closeAllOnTP: z.number().optional(), // Close all remaining at TP X
});

export type StrategyConfig = z.infer<typeof strategyConfigSchema>;

// Risk management configuration
export const riskConfigSchema = z.object({
  initialBalance: z.number().min(1),
  riskType: z.enum(["percentage", "fixed_lot", "rule_based"]),
  riskPercentage: z.number().min(0.01).max(100).optional(),
  fixedLotSize: z.number().min(0.01).optional(),
  ruleBasedAmount: z.number().min(1).optional(), // Per X dollars
  ruleBasedLot: z.number().min(0.01).optional(), // Use Y lots
});

export type RiskConfig = z.infer<typeof riskConfigSchema>;

// Backtest configuration
export const backtestConfigSchema = z.object({
  ticksFolder: z.string().min(1),
  signalsFile: z.string().min(1),
  tickFormat: tickFormatSchema,
  signalFormat: signalFormatSchema,
  strategy: strategyConfigSchema,
  risk: riskConfigSchema,
  gmtOffset: z.number().min(-12).max(14),
});

export type BacktestConfig = z.infer<typeof backtestConfigSchema>;

// Trade result
export const tradeResultSchema = z.object({
  id: z.string(),
  signalId: z.string(),
  symbol: z.string(),
  direction: z.enum(["buy", "sell"]),
  entryPrice: z.number(),
  entryTime: z.string(),
  exitPrice: z.number(),
  exitTime: z.string(),
  exitReason: z.enum(["tp1", "tp2", "tp3", "tp4", "sl", "trailing_sl", "manual"]),
  lotSize: z.number(),
  pips: z.number(),
  profit: z.number(),
  balance: z.number(),
  equity: z.number(),
});

export type TradeResult = z.infer<typeof tradeResultSchema>;

// Backtest results
export const backtestResultsSchema = z.object({
  id: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  initialBalance: z.number(),
  finalBalance: z.number(),
  totalTrades: z.number(),
  winningTrades: z.number(),
  losingTrades: z.number(),
  winRate: z.number(),
  totalPips: z.number(),
  maxDrawdownEquity: z.number(),
  maxDrawdownEquityPercent: z.number(),
  maxDrawdownBalance: z.number(),
  maxDrawdownBalancePercent: z.number(),
  profitFactor: z.number(),
  averageWin: z.number(),
  averageLoss: z.number(),
  largestWin: z.number(),
  largestLoss: z.number(),
  trades: z.array(tradeResultSchema),
  equityCurve: z.array(z.object({
    time: z.string(),
    equity: z.number(),
    balance: z.number(),
  })),
});

export type BacktestResults = z.infer<typeof backtestResultsSchema>;

// API request/response types
export const parseTickFormatRequestSchema = z.object({
  sampleLines: z.array(z.string()).min(1).max(5),
});

export type ParseTickFormatRequest = z.infer<typeof parseTickFormatRequestSchema>;

export const parseSignalsRequestSchema = z.object({
  content: z.string(),
  format: signalFormatSchema,
});

export type ParseSignalsRequest = z.infer<typeof parseSignalsRequestSchema>;

export const runBacktestRequestSchema = backtestConfigSchema;

export type RunBacktestRequest = z.infer<typeof runBacktestRequestSchema>;

// Database tables
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Tick data storage - stores uploaded tick files persistently
export const tickData = pgTable("tick_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  rowCount: integer("row_count").notNull(),
  sampleRows: text("sample_rows").array().notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const insertTickDataSchema = createInsertSchema(tickData).omit({
  id: true,
  uploadedAt: true,
});

export type InsertTickData = z.infer<typeof insertTickDataSchema>;
export type TickData = typeof tickData.$inferSelect;
