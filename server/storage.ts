import { 
  users, 
  mcrFiles, 
  processingQueue,
  images,
  patterns,
  humanizationProfiles,
  imageAnalysis,
  patternUsage,
  type User, 
  type InsertUser, 
  type McrFile, 
  type InsertMcrFile,
  type ProcessingQueue,
  type Image, 
  type InsertImage,
  type Pattern,
  type InsertPattern,
  type HumanizationProfile,
  type InsertHumanizationProfile,
  type ImageAnalysis,
  type InsertImageAnalysis,
  type PatternUsage
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

  // Pattern operations
  createPattern(pattern: InsertPattern): Promise<Pattern>;
  getPattern(id: string): Promise<Pattern | undefined>;
  getPatterns(): Promise<Pattern[]>;
  updatePattern(id: string, updates: Partial<Pattern>): Promise<Pattern | undefined>;
  deletePattern(id: string): Promise<boolean>;

  // Profile operations
  createProfile(profile: InsertHumanizationProfile): Promise<HumanizationProfile>;
  getProfile(id: string): Promise<HumanizationProfile | undefined>;
  getProfiles(): Promise<HumanizationProfile[]>;
  updateProfile(id: string, updates: Partial<HumanizationProfile>): Promise<HumanizationProfile | undefined>;
  deleteProfile(id: string): Promise<boolean>;

  // Image Analysis operations
  createImageAnalysis(analysis: InsertImageAnalysis): Promise<ImageAnalysis>;
  getImageAnalysis(id: string): Promise<ImageAnalysis | undefined>;
  getImageAnalysisByImageId(imageId: string): Promise<ImageAnalysis | undefined>;
  updateImageAnalysis(id: string, updates: Partial<ImageAnalysis>): Promise<ImageAnalysis | undefined>;
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

  async createPattern(pattern: InsertPattern): Promise<Pattern> {
    const [created] = await db.insert(patterns).values(pattern).returning();
    return created;
  }

  async getPattern(id: string): Promise<Pattern | undefined> {
    const [pattern] = await db.select().from(patterns).where(eq(patterns.id, id));
    return pattern || undefined;
  }

  async getPatterns(): Promise<Pattern[]> {
    return await db.select().from(patterns).orderBy(desc(patterns.createdAt));
  }

  async updatePattern(id: string, updates: Partial<Pattern>): Promise<Pattern | undefined> {
    const [updated] = await db
      .update(patterns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(patterns.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePattern(id: string): Promise<boolean> {
    const result = await db.delete(patterns).where(eq(patterns.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createProfile(profile: InsertHumanizationProfile): Promise<HumanizationProfile> {
    const [created] = await db.insert(humanizationProfiles).values(profile).returning();
    return created;
  }

  async getProfile(id: string): Promise<HumanizationProfile | undefined> {
    const [profile] = await db.select().from(humanizationProfiles).where(eq(humanizationProfiles.id, id));
    return profile || undefined;
  }

  async getProfiles(): Promise<HumanizationProfile[]> {
    return await db.select().from(humanizationProfiles).orderBy(desc(humanizationProfiles.createdAt));
  }

  async updateProfile(id: string, updates: Partial<HumanizationProfile>): Promise<HumanizationProfile | undefined> {
    const [updated] = await db
      .update(humanizationProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(humanizationProfiles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProfile(id: string): Promise<boolean> {
    const result = await db.delete(humanizationProfiles).where(eq(humanizationProfiles.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createImageAnalysis(analysis: InsertImageAnalysis): Promise<ImageAnalysis> {
    const [created] = await db.insert(imageAnalysis).values(analysis).returning();
    return created;
  }

  async getImageAnalysis(id: string): Promise<ImageAnalysis | undefined> {
    const [analysis] = await db.select().from(imageAnalysis).where(eq(imageAnalysis.id, id));
    return analysis || undefined;
  }

  async getImageAnalysisByImageId(imageId: string): Promise<ImageAnalysis | undefined> {
    const [analysis] = await db.select().from(imageAnalysis).where(eq(imageAnalysis.imageId, imageId));
    return analysis || undefined;
  }

  async updateImageAnalysis(id: string, updates: Partial<ImageAnalysis>): Promise<ImageAnalysis | undefined> {
    const [updated] = await db
      .update(imageAnalysis)
      .set(updates)
      .where(eq(imageAnalysis.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
