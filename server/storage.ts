import { 
  users, 
  mcrFiles, 
  processingQueue,
  images, 
  type User, 
  type InsertUser, 
  type McrFile, 
  type InsertMcrFile,
  type ProcessingQueue,
  type Image, 
  type InsertImage 
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // MCR File operations
  createMcrFile(file: InsertMcrFile & { userId?: string }): Promise<McrFile>;
  getMcrFile(id: string): Promise<McrFile | undefined>;
  getMcrFiles(userId?: string): Promise<McrFile[]>;
  updateMcrFile(id: string, updates: Partial<McrFile>): Promise<McrFile | undefined>;
  deleteMcrFile(id: string): Promise<boolean>;
  deleteFromProcessingQueue(fileId: string): Promise<boolean>;
  
  // Processing queue operations
  addToProcessingQueue(fileId: string): Promise<ProcessingQueue>;
  getProcessingQueue(): Promise<ProcessingQueue[]>;
  updateProcessingStatus(id: string, updates: Partial<ProcessingQueue>): Promise<ProcessingQueue | undefined>;
  getQueueItemByFileId(fileId: string): Promise<ProcessingQueue | undefined>;

  // Image operations
  createImage(image: InsertImage & { userId?: string }): Promise<Image>;
  getImage(id: string): Promise<Image | undefined>;
  getImages(userId?: string): Promise<Image[]>;
  updateImage(id: string, updates: Partial<Image>): Promise<Image | undefined>;
  deleteImage(id: string): Promise<boolean>;
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
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createMcrFile(file: InsertMcrFile & { userId?: string }): Promise<McrFile> {
    const [mcrFile] = await db
      .insert(mcrFiles)
      .values(file)
      .returning();
    return mcrFile;
  }

  async getMcrFile(id: string): Promise<McrFile | undefined> {
    const [file] = await db.select().from(mcrFiles).where(eq(mcrFiles.id, id));
    return file || undefined;
  }

  async getMcrFiles(userId?: string): Promise<McrFile[]> {
    if (userId) {
      return await db.select().from(mcrFiles)
        .where(eq(mcrFiles.userId, userId))
        .orderBy(desc(mcrFiles.uploadedAt));
    }
    return await db.select().from(mcrFiles).orderBy(desc(mcrFiles.uploadedAt));
  }

  async updateMcrFile(id: string, updates: Partial<McrFile>): Promise<McrFile | undefined> {
    const [updated] = await db
      .update(mcrFiles)
      .set(updates)
      .where(eq(mcrFiles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteMcrFile(id: string): Promise<boolean> {
    const result = await db.delete(mcrFiles).where(eq(mcrFiles.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteFromProcessingQueue(fileId: string): Promise<boolean> {
    const result = await db.delete(processingQueue).where(eq(processingQueue.fileId, fileId));
    return (result.rowCount ?? 0) > 0;
  }

  async addToProcessingQueue(fileId: string): Promise<ProcessingQueue> {
    const [queueItem] = await db
      .insert(processingQueue)
      .values({ fileId })
      .returning();
    return queueItem;
  }

  async getProcessingQueue(): Promise<ProcessingQueue[]> {
    return await db.select().from(processingQueue).orderBy(desc(processingQueue.startedAt));
  }

  async updateProcessingStatus(id: string, updates: Partial<ProcessingQueue>): Promise<ProcessingQueue | undefined> {
    const [updated] = await db
      .update(processingQueue)
      .set(updates)
      .where(eq(processingQueue.id, id))
      .returning();
    return updated || undefined;
  }

  async getQueueItemByFileId(fileId: string): Promise<ProcessingQueue | undefined> {
    const [item] = await db.select().from(processingQueue).where(eq(processingQueue.fileId, fileId));
    return item || undefined;
  }

  async createImage(image: InsertImage & { userId?: string }): Promise<Image> {
    const [newImage] = await db
      .insert(images)
      .values(image)
      .returning();
    return newImage;
  }

  async getImage(id: string): Promise<Image | undefined> {
    const [image] = await db.select().from(images).where(eq(images.id, id));
    return image || undefined;
  }

  async getImages(userId?: string): Promise<Image[]> {
    if (userId) {
      return await db.select().from(images)
        .where(eq(images.userId, userId))
        .orderBy(desc(images.uploadedAt));
    }
    return await db.select().from(images).orderBy(desc(images.uploadedAt));
  }

  async updateImage(id: string, updates: Partial<Image>): Promise<Image | undefined> {
    const [updated] = await db
      .update(images)
      .set(updates)
      .where(eq(images.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteImage(id: string): Promise<boolean> {
    const result = await db.delete(images).where(eq(images.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();
