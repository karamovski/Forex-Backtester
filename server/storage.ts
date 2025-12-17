import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();

// Tick data store - tracks uploaded tick files in memory
interface TickDataset {
  id: string;
  content: string;
  rowCount: number;
  sampleRows: string[];
  uploadedAt: Date;
}

class TickDataStorage {
  private datasets: Map<string, TickDataset> = new Map();

  add(dataset: TickDataset): void {
    this.datasets.set(dataset.id, dataset);
  }

  get(id: string): TickDataset | undefined {
    return this.datasets.get(id);
  }

  delete(id: string): boolean {
    return this.datasets.delete(id);
  }
}

export const tickDataStore = new TickDataStorage();
