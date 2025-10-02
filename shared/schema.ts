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
  delayVariation: z.number().min(1).max(100).default(25),
  typingErrors: z.number().min(0).max(10).default(2),
  hesitationPauses: z.number().min(0).max(50).default(15),
  preserveStructure: z.boolean().default(true),
  excludedKeys: z.array(z.string()).optional(),
  removeMouseOnUpload: z.boolean().default(false),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type McrFile = typeof mcrFiles.$inferSelect;
export type InsertMcrFile = z.infer<typeof insertMcrFileSchema>;
export type Image = typeof images.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;
export type ProcessingQueue = typeof processingQueue.$inferSelect;
export type HumanizationSettings = z.infer<typeof humanizationSettingsSchema>;

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

