import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  parseObjectPath(path: string): { bucketName: string; objectName: string } {
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }
    const pathParts = path.split("/");
    if (pathParts.length < 3) {
      throw new Error("Invalid path: must contain at least a bucket name");
    }
    return {
      bucketName: pathParts[1],
      objectName: pathParts.slice(2).join("/"),
    };
  }

  async saveTickData(id: string, content: string, metadata: { rowCount: number; sampleRows: string[] }): Promise<void> {
    const privateDir = this.getPrivateObjectDir();
    const fullPath = `${privateDir}/tick-data/${id}.csv`;
    const { bucketName, objectName } = this.parseObjectPath(fullPath);
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    await file.save(content, {
      contentType: "text/csv",
      metadata: {
        metadata: {
          rowCount: String(metadata.rowCount),
          sampleRows: JSON.stringify(metadata.sampleRows),
        },
      },
    });
  }

  async getTickData(id: string): Promise<{ content: string; rowCount: number; sampleRows: string[] } | null> {
    const privateDir = this.getPrivateObjectDir();
    const fullPath = `${privateDir}/tick-data/${id}.csv`;
    const { bucketName, objectName } = this.parseObjectPath(fullPath);
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }
    
    const [content] = await file.download();
    const [metadata] = await file.getMetadata();
    
    return {
      content: content.toString("utf-8"),
      rowCount: parseInt(metadata.metadata?.rowCount as string || "0", 10),
      sampleRows: JSON.parse(metadata.metadata?.sampleRows as string || "[]"),
    };
  }

  async deleteTickData(id: string): Promise<boolean> {
    const privateDir = this.getPrivateObjectDir();
    const fullPath = `${privateDir}/tick-data/${id}.csv`;
    const { bucketName, objectName } = this.parseObjectPath(fullPath);
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    const [exists] = await file.exists();
    if (!exists) {
      return false;
    }
    
    await file.delete();
    return true;
  }
}

export const objectStorageService = new ObjectStorageService();
