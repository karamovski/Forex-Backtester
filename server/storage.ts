import { type User, type InsertUser, type TickData, type InsertTickData, users, tickData } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getTickData(id: string): Promise<TickData | undefined>;
  getAllTickData(): Promise<TickData[]>;
  createTickData(data: InsertTickData): Promise<TickData>;
  deleteTickData(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getTickData(id: string): Promise<TickData | undefined> {
    const [data] = await db.select().from(tickData).where(eq(tickData.id, id));
    return data || undefined;
  }

  async getAllTickData(): Promise<TickData[]> {
    return await db.select().from(tickData);
  }

  async createTickData(data: InsertTickData): Promise<TickData> {
    const [created] = await db.insert(tickData).values(data).returning();
    return created;
  }

  async deleteTickData(id: string): Promise<boolean> {
    const result = await db.delete(tickData).where(eq(tickData.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
