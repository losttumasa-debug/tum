import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";


export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const mcrFiles = pgTable("mcr_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  originalName: text("original_name").notNull(),
  filename: text("filename").notNull(),
  size: integer("size").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  processedAt: timestamp("processed_at"),
  originalCommands: integer("original_commands"),
  processedCommands: integer("processed_commands"),
  processingProgress: real("processing_progress").default(0),
  humanizationSettings: jsonb("humanization_settings"),
  errorMessage: text("error_message"),
  processedFilePath: text("processed_file_path"),
  sourceFileIds: varchar("source_file_ids").array(),
});

export const images = pgTable("images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  originalName: text("original_name").notNull(),
  filename: text("filename").notNull(),
  size: integer("size").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  associatedMcrFileId: varchar("associated_mcr_file_id").references(() => mcrFiles.id),
});

export const processingQueue = pgTable("processing_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id").notNull().references(() => mcrFiles.id),
  status: text("status").notNull().default("queued"), // queued, processing, completed, failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  progress: integer("progress").default(0),
  currentStep: text("current_step"),
});

export const patterns = pgTable("patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  commandSequence: jsonb("command_sequence").notNull(), // Array of McrCommand
  frequency: integer("frequency").default(1), // How many times this pattern appears
  confidence: real("confidence").default(0.5), // Confidence score 0-1
  sourceFileIds: varchar("source_file_ids").array(), // Files where this pattern was found
  metadata: jsonb("metadata"), // Additional info like average timing, variations
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  version: integer("version").default(1),
});

export const humanizationProfiles = pgTable("humanization_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  settings: jsonb("settings").notNull(), // HumanizationSettings
  typingSpeed: text("typing_speed").notNull().default("medium"), // slow, medium, fast
  mouseAccuracy: real("mouse_accuracy").default(0.8), // 0-1
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const imageAnalysis = pgTable("image_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageId: varchar("image_id").notNull().references(() => images.id),
  ocrText: text("ocr_text"), // Extracted text from OCR
  detectedElements: jsonb("detected_elements"), // Array of UI elements {type, bounds, text, confidence}
  generatedMcrId: varchar("generated_mcr_id").references(() => mcrFiles.id), // MCR generated from this image
  processingStatus: text("processing_status").default("pending"), // pending, processing, completed, failed
  errorMessage: text("error_message"),
  analyzedAt: timestamp("analyzed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const patternUsage = pgTable("pattern_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patternId: varchar("pattern_id").notNull().references(() => patterns.id),
  fileId: varchar("file_id").notNull().references(() => mcrFiles.id),
  usageCount: integer("usage_count").default(1),
  successRate: real("success_rate"), // Quality metric after usage
  usedAt: timestamp("used_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMcrFileSchema = createInsertSchema(mcrFiles).pick({
  originalName: true,
  filename: true,
  size: true,
  humanizationSettings: true,
  sourceFileIds: true,
});

export const insertImageSchema = createInsertSchema(images).pick({
  originalName: true,
  filename: true,
  size: true,
  associatedMcrFileId: true,
});

export const humanizationSettingsSchema = z.object({
  delayVariation: z.number().min(1).max(100).default(10), // Reducido a mínimo
  typingErrors: z.number().min(0).max(10).default(1), // Reducido
  hesitationPauses: z.number().min(0).max(50).default(5), // Reducido
  preserveStructure: z.boolean().default(true),
  excludedKeys: z.array(z.string()).optional(),
  removeMouseOnUpload: z.boolean().default(true), // Ahora por defecto TRUE
  timeExtensionFactor: z.number().min(1).max(5).default(1), // 1.0 = normal, 2.0 = doble
  minDelay: z.number().min(0).max(100).default(10), // Delay mínimo en ms
  maxDelay: z.number().min(10).max(1000).default(100), // Delay máximo en ms
  requiredImageId: z.string().optional(), // ID de imagen obligatoria
});

export const insertPatternSchema = createInsertSchema(patterns).pick({
  name: true,
  commandSequence: true,
  frequency: true,
  confidence: true,
  sourceFileIds: true,
  metadata: true,
});

export const insertHumanizationProfileSchema = createInsertSchema(humanizationProfiles).pick({
  name: true,
  description: true,
  settings: true,
  typingSpeed: true,
  mouseAccuracy: true,
  isDefault: true,
});

export const insertImageAnalysisSchema = createInsertSchema(imageAnalysis).pick({
  imageId: true,
  ocrText: true,
  detectedElements: true,
  generatedMcrId: true,
  processingStatus: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type McrFile = typeof mcrFiles.$inferSelect;
export type InsertMcrFile = z.infer<typeof insertMcrFileSchema>;
export type Image = typeof images.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;
export type ProcessingQueue = typeof processingQueue.$inferSelect;
export type HumanizationSettings = z.infer<typeof humanizationSettingsSchema>;
export type Pattern = typeof patterns.$inferSelect;
export type InsertPattern = z.infer<typeof insertPatternSchema>;
export type HumanizationProfile = typeof humanizationProfiles.$inferSelect;
export type InsertHumanizationProfile = z.infer<typeof insertHumanizationProfileSchema>;
export type ImageAnalysis = typeof imageAnalysis.$inferSelect;
export type InsertImageAnalysis = z.infer<typeof insertImageAnalysisSchema>;
export type PatternUsage = typeof patternUsage.$inferSelect;

// MCR Command interface for shared use between frontend and backend
export interface McrCommand {
  type: 'keyboard' | 'mouse' | 'delay' | 'text';
  action: string;
  key?: string;
  delay?: number;
  x?: number;
  y?: number;
  text?: string;
}

export const isCommandEqual = (cmd1: McrCommand, cmd2: McrCommand) =>
  cmd1.key === cmd2.key && cmd1.action === cmd2.action;

// UI Element interface for image analysis
export interface UIElement {
  type: 'button' | 'textfield' | 'menu' | 'icon' | 'checkbox' | 'label' | 'unknown';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  text?: string;
  confidence: number;
  id?: string;
  className?: string;
}

// Pattern metadata interface
export interface PatternMetadata {
  averageDuration?: number;
  variationStdDev?: number;
  contextBefore?: string[]; // Keys that typically appear before this pattern
  contextAfter?: string[]; // Keys that typically appear after this pattern
  timesUsed?: number;
  successRate?: number;
}

