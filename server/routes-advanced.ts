import type { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { patternService } from "./services/patternService";
import { profileService } from "./services/profileService";
import { imageAnalysisService } from "./services/imageAnalysisService";
import { queueService } from "./services/queueService";
import { storage } from "./storage";

const imageUpload = multer({
  dest: 'uploads/images/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.bmp'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (PNG, JPG, JPEG, BMP)'));
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit
  }
});

export function registerAdvancedRoutes(app: Express) {
  // ==================== PATTERN ENDPOINTS ====================
  
  // Get all patterns
  app.get("/api/patterns", async (req, res) => {
    try {
      const patterns = await patternService.getTopPatterns(50);
      res.json(patterns);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch patterns" 
      });
    }
  });

  // Mine patterns from multiple files
  app.post("/api/patterns/mine", async (req, res) => {
    try {
      const { fileIds, minSequenceLength = 3, minFrequency = 2 } = req.body;
      
      if (!fileIds || !Array.isArray(fileIds) || fileIds.length < 2) {
        return res.status(400).json({ 
          message: "At least 2 file IDs are required for pattern mining" 
        });
      }

      // Add to queue for background processing
      const jobId = await queueService.addPatternMiningJob(fileIds, minFrequency);
      
      // For now, process synchronously for demo
      const patterns = await patternService.minePatterns(fileIds, minSequenceLength, minFrequency);
      
      res.json({ 
        message: "Pattern mining completed",
        jobId,
        patterns,
        count: patterns.length 
      });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Pattern mining failed" 
      });
    }
  });

  // Get patterns by file IDs
  app.post("/api/patterns/by-files", async (req, res) => {
    try {
      const { fileIds } = req.body;
      
      if (!fileIds || !Array.isArray(fileIds)) {
        return res.status(400).json({ message: "File IDs array is required" });
      }

      const patterns = await patternService.getPatternsByFileIds(fileIds);
      res.json(patterns);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch patterns" 
      });
    }
  });

  // Analyze command transitions (Markov chain)
  app.post("/api/patterns/transitions", async (req, res) => {
    try {
      const { fileIds } = req.body;
      
      if (!fileIds || !Array.isArray(fileIds)) {
        return res.status(400).json({ message: "File IDs array is required" });
      }

      const transitions = await patternService.analyzeCommandTransitions(fileIds);
      
      const transitionsArray = Array.from(transitions.entries()).map(([from, toMap]) => ({
        from,
        transitions: Array.from(toMap.entries()).map(([to, count]) => ({ to, count }))
      }));

      res.json({ 
        fileIds,
        transitionCount: transitionsArray.length,
        transitions: transitionsArray 
      });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to analyze transitions" 
      });
    }
  });

  // Delete pattern
  app.delete("/api/patterns/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePattern(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Pattern not found" });
      }
      res.json({ message: "Pattern deleted successfully" });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete pattern" 
      });
    }
  });

  // ==================== PROFILE ENDPOINTS ====================
  
  // Get all humanization profiles
  app.get("/api/profiles", async (req, res) => {
    try {
      const profiles = await profileService.getAllProfiles();
      res.json(profiles);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch profiles" 
      });
    }
  });

  // Get default profile
  app.get("/api/profiles/default", async (req, res) => {
    try {
      const profile = await profileService.getDefaultProfile();
      if (!profile) {
        return res.status(404).json({ message: "No default profile found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch default profile" 
      });
    }
  });

  // Get specific profile
  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const profile = await profileService.getProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch profile" 
      });
    }
  });

  // Create new profile
  app.post("/api/profiles", async (req, res) => {
    try {
      const profile = await profileService.createProfile(req.body);
      res.status(201).json(profile);
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to create profile" 
      });
    }
  });

  // Update profile
  app.put("/api/profiles/:id", async (req, res) => {
    try {
      const profile = await profileService.updateProfile(req.params.id, req.body);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to update profile" 
      });
    }
  });

  // Delete profile
  app.delete("/api/profiles/:id", async (req, res) => {
    try {
      const deleted = await profileService.deleteProfile(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Profile not found" });
      }
      res.json({ message: "Profile deleted successfully" });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete profile" 
      });
    }
  });

  // ==================== IMAGE ANALYSIS ENDPOINTS ====================
  
  // Get all images
  app.get("/api/images", async (req, res) => {
    try {
      const images = await storage.getImages();
      res.json(images);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch images" 
      });
    }
  });

  // Get specific image
  app.get("/api/images/:id", async (req, res) => {
    try {
      const image = await storage.getImage(req.params.id);
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }
      res.json(image);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch image" 
      });
    }
  });

  // Upload image
  app.post("/api/images/upload", imageUpload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image uploaded" });
      }

      const imageData = {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
      };

      const image = await storage.createImage(imageData);

      res.json(image);
    } catch (error) {
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Image upload failed" 
      });
    }
  });

  // Analyze uploaded image (OCR + UI detection)
  app.post("/api/images/:id/analyze", async (req, res) => {
    try {
      const image = await storage.getImage(req.params.id);
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }

      const imagePath = path.join(process.cwd(), 'uploads/images', image.filename);
      
      // Add to queue for background processing
      const jobId = await queueService.addImageAnalysisJob(image.id, imagePath);

      // For demo, also process synchronously
      const analysis = await imageAnalysisService.analyzeImage(image.id, imagePath);

      res.json({ 
        message: "Image analysis started",
        jobId,
        analysis 
      });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Image analysis failed" 
      });
    }
  });

  // Get image analysis results
  app.get("/api/images/:id/analysis", async (req, res) => {
    try {
      const analysis = await imageAnalysisService.getImageAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ message: "Image analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch analysis" 
      });
    }
  });

  // Generate MCR from image
  app.post("/api/images/:id/generate-mcr", async (req, res) => {
    try {
      const { fileName = "generated_from_image.mcr", usePatterns = false } = req.body;
      
      const commands = usePatterns
        ? await imageAnalysisService.generateMCRFromImageWithPatterns(req.params.id)
        : await imageAnalysisService.generateMCRFromImage(req.params.id);

      const mcrFileId = await imageAnalysisService.saveMCRFromImage(
        req.params.id,
        commands,
        fileName
      );

      const mcrFile = await storage.getMcrFile(mcrFileId);
      
      res.status(201).json({ 
        message: "MCR file generated from image",
        mcrFile,
        commandCount: commands.length 
      });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "MCR generation failed" 
      });
    }
  });

  // Delete image
  app.delete("/api/images/:id", async (req, res) => {
    try {
      const image = await storage.getImage(req.params.id);
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }

      // Delete the file from disk
      const imagePath = path.join(process.cwd(), 'uploads/images', image.filename);
      try {
        await fs.unlink(imagePath);
      } catch (err) {
        console.error("Failed to delete image file:", err);
      }

      // Delete from database
      await storage.deleteImage(req.params.id);
      
      res.json({ message: "Image deleted successfully" });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete image" 
      });
    }
  });

  // ==================== BATCH PROCESSING ENDPOINTS ====================
  
  // Process multiple files with intelligent pattern-based humanization
  app.post("/api/batch/process", async (req, res) => {
    try {
      const { fileIds, profileId, learnPatterns = true } = req.body;
      
      if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ message: "File IDs array is required" });
      }

      let profile = null;
      if (profileId) {
        profile = await profileService.getProfile(profileId);
        if (!profile) {
          return res.status(404).json({ message: "Profile not found" });
        }
      }

      const jobIds = [];
      for (const fileId of fileIds) {
        const file = await storage.getMcrFile(fileId);
        if (!file) continue;
        
        if (profile) {
          await storage.updateMcrFile(fileId, {
            humanizationSettings: profile.settings as any,
          });
        }

        const jobId = await queueService.addProcessingJob(file);
        jobIds.push({ fileId, jobId });
      }

      // If learning patterns, mine them after processing
      if (learnPatterns && fileIds.length >= 2) {
        await queueService.addPatternMiningJob(fileIds);
      }

      res.json({ 
        message: "Batch processing started",
        jobs: jobIds,
        profileUsed: profile?.name || 'default settings'
      });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Batch processing failed" 
      });
    }
  });

  // Get queue status
  app.get("/api/queue/status", async (req, res) => {
    try {
      const status = await queueService.getQueueStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch queue status" 
      });
    }
  });

  // Pause queue
  app.post("/api/queue/pause", async (req, res) => {
    try {
      await queueService.pauseQueue();
      res.json({ message: "Queue paused" });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to pause queue" 
      });
    }
  });

  // Resume queue
  app.post("/api/queue/resume", async (req, res) => {
    try {
      await queueService.resumeQueue();
      res.json({ message: "Queue resumed" });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to resume queue" 
      });
    }
  });

  // Clear completed jobs
  app.post("/api/queue/clear", async (req, res) => {
    try {
      await queueService.clearCompletedJobs();
      res.json({ message: "Completed jobs cleared" });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to clear jobs" 
      });
    }
  });
}
