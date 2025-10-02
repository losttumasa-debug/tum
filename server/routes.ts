import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { storage } from "./storage";
import { insertMcrFileSchema, humanizationSettingsSchema } from "@shared/schema";
import { processMcrFile, parseMcrContent, calculateMcrDuration, lengthenMcr, generateMcrContent, removeMouseCommands, removeZeroDelays, findCommonSequences, mergeAndOptimizeMcrFiles } from "./services/mcrProcessor";
import { registerAdvancedRoutes } from "./routes-advanced";
import { queueService } from "./services/queueService";

const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.mcr') {
      cb(null, true);
    } else {
      cb(new Error('Only .mcr files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const clients = new Set<WebSocket>();
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    
    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  function broadcastUpdate(data: any) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Connect queue service to WebSocket broadcast
  queueService.setBroadcastCallback(broadcastUpdate);

  // Get all MCR files
  app.get("/api/files", async (req, res) => {
    try {
      const files = await storage.getMcrFiles();
      const filesWithSourceNames = await Promise.all(files.map(async (file) => {
        if (file.sourceFileIds && file.sourceFileIds.length > 0) {
          const sourceFiles = await Promise.all(file.sourceFileIds.map(id => storage.getMcrFile(id)));
          const sourceFileNames = sourceFiles.filter(Boolean).map(f => f!.originalName);
          return { ...file, sourceFileNames };
        }
        return file;
      }));
      res.json(filesWithSourceNames);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  // Get processing queue
  app.get("/api/queue", async (req, res) => {
    try {
      const queue = await storage.getProcessingQueue();
      res.json(queue);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch processing queue" });
    }
  });

  // Upload MCR file
  app.post("/api/files/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // OBLIGATORIO: requiredImageId debe estar presente
      const requiredImageId = req.body.requiredImageId;
      if (!requiredImageId) {
        if (req.file) {
          await fs.unlink(req.file.path).catch(() => {});
        }
        return res.status(400).json({ 
          message: "Image is required. Please upload an image and draw a path first." 
        });
      }

      // Verificar que la imagen existe y tiene una ruta dibujada
      const image = await storage.getImage(requiredImageId);
      if (!image) {
        if (req.file) {
          await fs.unlink(req.file.path).catch(() => {});
        }
        return res.status(400).json({ 
          message: "Associated image not found. Please upload an image first." 
        });
      }

      // Verificar que la imagen tiene una ruta dibujada
      if (!image.drawnPath) {
        if (req.file) {
          await fs.unlink(req.file.path).catch(() => {});
        }
        return res.status(400).json({ 
          message: "Please draw a path on the image before uploading MCR file." 
        });
      }

      const humanizationSettings = req.body.humanizationSettings 
        ? JSON.parse(req.body.humanizationSettings)
        : {};

      const validatedSettings = humanizationSettingsSchema.parse(humanizationSettings);

      // ALWAYS remove mouse commands from uploaded MCR
      if (req.file) {
        const filePath = req.file.path;
        const content = await fs.readFile(filePath, 'utf-8');
        let commands = parseMcrContent(content);
        commands = removeMouseCommands(commands);
        console.log(`Filtered out ${parseMcrContent(content).length - commands.length} mouse commands`);
        const newContent = generateMcrContent(commands);
        await fs.writeFile(filePath, newContent);
      }

      const fileData = {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        humanizationSettings: validatedSettings,
        requiredImageId: requiredImageId,
      };

      const validatedData = insertMcrFileSchema.parse(fileData);
      const mcrFile = await storage.createMcrFile(validatedData);

      // Add to processing queue
      await storage.addToProcessingQueue(mcrFile.id);

      broadcastUpdate({
        type: 'fileUploaded',
        file: mcrFile
      });

      res.json(mcrFile);
    } catch (error) {
      if (req.file) {
        // Clean up uploaded file if processing failed
        await fs.unlink(req.file.path).catch(() => {});
      }
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Upload failed" 
      });
    }
  });

  // Process MCR file
  app.post("/api/files/:id/process", async (req, res) => {
    try {
      const file = await storage.getMcrFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      if (file.status === 'processing') {
        return res.status(400).json({ message: "File is already being processed" });
      }

      // Update status to processing
      await storage.updateMcrFile(file.id, { 
        status: 'processing',
        processingProgress: 0 
      });

      broadcastUpdate({
        type: 'processingStarted',
        fileId: file.id
      });

      // Start processing in background
      setTimeout(() => {
        processMcrFile(file, storage, broadcastUpdate).catch(async (error) => {
          await storage.updateMcrFile(file.id, { 
            status: 'failed',
            errorMessage: error.message 
          });
          broadcastUpdate({
            type: 'processingFailed',
            fileId: file.id,
            error: error.message
          });
        });
      }, 1000); // Add a 1-second delay

      res.json({ message: "Processing started" });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Processing failed" 
      });
    }
  });

  // Download processed file
  app.get("/api/files/:id/download", async (req, res) => {
    try {
      const file = await storage.getMcrFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      if (file.status !== 'completed' || !file.processedFilePath) {
        return res.status(400).json({ message: "File is not ready for download" });
      }

      const filePath = path.join(process.cwd(), file.processedFilePath);
      const fileName = `humanized_${file.originalName}`;

      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      
      const fileStream = await fs.readFile(filePath);
      res.send(fileStream);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Download failed" 
      });
    }
  });

  // Get parsed MCR commands for keyboard editor
  app.get("/api/files/:id/parsed-content", async (req, res) => {
    try {
      const file = await storage.getMcrFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const commands = parseMcrContent(content);
      
      res.json(commands);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to parse file content" 
      });
    }
  });

  // Get processed file content
  app.get("/api/files/:id/content", async (req, res) => {
    try {
      const file = await storage.getMcrFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      if (file.status !== 'completed' || !file.processedFilePath) {
        return res.status(400).json({ message: "File is not ready for viewing" });
      }

      const filePath = path.join(process.cwd(), file.processedFilePath);
      const content = await fs.readFile(filePath, 'utf-8');
      
      res.json({ content });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to read file content" 
      });
    }
  });

  // Get MCR file duration
  app.get("/api/files/:id/duration", async (req, res) => {
    try {
      const file = await storage.getMcrFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const commands = parseMcrContent(content);
      const duration = calculateMcrDuration(commands);
      
      res.json({ duration });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to calculate duration" 
      });
    }
  });

  // Lengthen MCR file
  app.post("/api/files/:id/lengthen", async (req, res) => {
    try {
      const { targetDuration } = req.body;
      if (!targetDuration || typeof targetDuration !== 'number' || targetDuration <= 0) {
        return res.status(400).json({ message: "Invalid target duration" });
      }

      const file = await storage.getMcrFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const commands = parseMcrContent(content);
      
      const lengthenedCommands = lengthenMcr(commands, targetDuration);
      const newContent = generateMcrContent(lengthenedCommands);

      await fs.writeFile(filePath, newContent);

      // Invalidate duration in client
      broadcastUpdate({
        type: 'fileModified',
        fileId: req.params.id
      });

      res.json({ message: "File lengthened successfully" });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to lengthen file" 
      });
    }
  });

  // Cleanup MCR file
  app.post("/api/files/:id/cleanup", async (req, res) => {
    try {
      const { removeMouse, removeZeroDelays } = req.body;

      const file = await storage.getMcrFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      let commands = parseMcrContent(content);
      
      if (removeMouse) {
        commands = removeMouseCommands(commands);
      }
      if (removeZeroDelays) {
        commands = removeZeroDelays(commands);
      }

      const newContent = generateMcrContent(commands);
      await fs.writeFile(filePath, newContent);

      // Invalidate duration in client
      broadcastUpdate({
        type: 'fileModified',
        fileId: req.params.id
      });

      res.json({ message: "File cleaned up successfully" });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to clean up file" 
      });
    }
  });

  // Update excluded keys for a file
  app.post("/api/files/:id/excluded-keys", async (req, res) => {
    try {
      const { excludedKeys } = req.body;
      if (!Array.isArray(excludedKeys)) {
        return res.status(400).json({ message: "Invalid excluded keys format" });
      }

      const file = await storage.getMcrFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const currentSettings = file.humanizationSettings as any || {};
      const updatedSettings = { ...currentSettings, excludedKeys };

      await storage.updateMcrFile(req.params.id, { humanizationSettings: updatedSettings });

      res.json({ message: "Excluded keys updated successfully" });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to update excluded keys" 
      });
    }
  });

    // Merge and optimize two MCR files
    app.post("/api/files/merge-optimized", async (req, res) => {
      try {
        const { fileId1, fileId2, newFileName } = req.body;
        if (!fileId1 || !fileId2 || !newFileName) {
          return res.status(400).json({ message: "Two file IDs and a new file name are required" });
        }
  
        const file1 = await storage.getMcrFile(fileId1);
        const file2 = await storage.getMcrFile(fileId2);
  
        if (!file1 || !file2) {
          return res.status(404).json({ message: "One or both files not found" });
        }
  
        const content1 = await fs.readFile(path.join(process.cwd(), 'uploads', file1.filename), 'utf-8');
        const commands1 = parseMcrContent(content1);
  
        const content2 = await fs.readFile(path.join(process.cwd(), 'uploads', file2.filename), 'utf-8');
        const commands2 = parseMcrContent(content2);
  
        // Default humanization settings for the merged file
        const defaultHumanizationSettings = {
          delayVariation: 10,
          typingErrors: 1,
          hesitationPauses: 5,
          preserveStructure: true,
          removeMouseOnUpload: true,
          timeExtensionFactor: 1.0,
          minDelay: 10,
          maxDelay: 100,
        };
  
        const mergedCommands = await mergeAndOptimizeMcrFiles(commands1, commands2, defaultHumanizationSettings);
        const newContent = generateMcrContent(mergedCommands);
  
        const filename = `${(await import('crypto')).randomBytes(16).toString('hex')}`;
        const filePath = path.join(process.cwd(), 'uploads', filename);
  
        await fs.writeFile(filePath, newContent);
  
        const stats = await fs.stat(filePath);
  
        const fileData = {
          originalName: newFileName,
          filename,
          size: stats.size,
          humanizationSettings: defaultHumanizationSettings,
          sourceFileIds: [fileId1, fileId2],
        };
  
        const validatedData = insertMcrFileSchema.parse(fileData);
        const mcrFile = await storage.createMcrFile(validatedData);
  
        await storage.addToProcessingQueue(mcrFile.id);
  
        console.log("Broadcasting fileUploaded for new file:", mcrFile);
        console.log("Broadcasting fileUploaded for new file:", mcrFile);
        console.log("Broadcasting fileUploaded for new file:", mcrFile);
        broadcastUpdate({
          type: 'fileUploaded',
          file: mcrFile
        });
  
        res.status(201).json(mcrFile);
      } catch (error) {
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to merge and optimize files"
        });
      }
    });
  // Create a new MCR file from a pattern
  app.post("/api/files/from-pattern", async (req, res) => {
    try {
      const { pattern, originalName } = req.body;

      if (!pattern || !Array.isArray(pattern) || !originalName) {
        return res.status(400).json({ message: "Pattern and originalName are required" });
      }

      const content = generateMcrContent(pattern);
      const filename = `${(await import('crypto')).randomBytes(16).toString('hex')}`;
      const filePath = path.join(process.cwd(), 'uploads', filename);

      await fs.writeFile(filePath, content);

      const stats = await fs.stat(filePath);

      const fileData = {
        originalName,
        filename,
        size: stats.size,
        humanizationSettings: { // Default settings
          delayVariation: 25,
          typingErrors: 2,
          hesitationPauses: 15,
          preserveStructure: true,
          removeMouseOnUpload: false,
        },
      };

      const validatedData = insertMcrFileSchema.parse(fileData);
      const mcrFile = await storage.createMcrFile(validatedData);

      await storage.addToProcessingQueue(mcrFile.id);

      broadcastUpdate({
        type: 'fileUploaded',
        file: mcrFile
      });

      res.status(201).json(mcrFile);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to create file from pattern" 
      });
    }
  });

  // Delete MCR file
  app.delete("/api/files/:id", async (req, res) => {
    try {
      const file = await storage.getMcrFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Clean up files
      const originalPath = path.join(process.cwd(), 'uploads', file.filename);
      await fs.unlink(originalPath).catch(() => {});

      if (file.processedFilePath) {
        const processedPath = path.join(process.cwd(), file.processedFilePath);
        await fs.unlink(processedPath).catch(() => {});
      }

      // Delete from processing queue first due to foreign key constraint
      await storage.deleteFromProcessingQueue(req.params.id);

      const deleted = await storage.deleteMcrFile(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "File not found" });
      }

      broadcastUpdate({
        type: 'fileDeleted',
        fileId: req.params.id
      });

      res.json({ message: "File deleted successfully" });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Delete failed" 
      });
    }
  });

  // Get processing statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const files = await storage.getMcrFiles();
      const patterns = await storage.getPatterns();
      const profiles = await storage.getProfiles();
      const queueStatus = await queueService.getQueueStatus();
      
      const stats = {
        totalFiles: files.length,
        completed: files.filter(f => f.status === 'completed').length,
        processing: files.filter(f => f.status === 'processing').length,
        failed: files.filter(f => f.status === 'failed').length,
        pending: files.filter(f => f.status === 'pending').length,
        totalPatterns: patterns.length,
        totalProfiles: profiles.length,
        queueStatus
      };
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Register advanced routes (patterns, profiles, images, batch processing)
  registerAdvancedRoutes(app);

  return httpServer;
}
