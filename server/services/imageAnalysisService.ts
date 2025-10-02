import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { UIElement, McrCommand, InsertImageAnalysis, ImageAnalysis } from '@shared/schema';
import { db } from '../db';
import { imageAnalysis, images, mcrFiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { cacheService } from './cacheService';
import path from 'path';
import fs from 'fs/promises';

export class ImageAnalysisService {
  async analyzeImage(imageId: string, imagePath: string): Promise<ImageAnalysis> {
    const cached = await cacheService.getCachedImageAnalysis(imageId);
    if (cached) {
      return cached;
    }

    const [analysis] = await db
      .insert(imageAnalysis)
      .values({
        imageId,
        processingStatus: 'processing',
      })
      .returning();

    try {
      const preprocessedPath = await this.preprocessImage(imagePath);
      
      const ocrResult = await this.performOCR(preprocessedPath);
      
      const uiElements = await this.detectUIElements(preprocessedPath, ocrResult);
      
      const [updatedAnalysis] = await db
        .update(imageAnalysis)
        .set({
          ocrText: ocrResult.text,
          detectedElements: uiElements as any,
          processingStatus: 'completed',
          analyzedAt: new Date(),
        })
        .where(eq(imageAnalysis.id, analysis.id))
        .returning();

      await cacheService.cacheImageAnalysis(imageId, updatedAnalysis);
      
      await fs.unlink(preprocessedPath).catch(() => {});

      return updatedAnalysis;
    } catch (error) {
      await db
        .update(imageAnalysis)
        .set({
          processingStatus: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(imageAnalysis.id, analysis.id));
      
      throw error;
    }
  }

  private async preprocessImage(imagePath: string): Promise<string> {
    const processedPath = imagePath.replace(/(\.[^.]+)$/, '_processed$1');
    
    await sharp(imagePath)
      .greyscale()
      .normalize()
      .sharpen()
      .toFile(processedPath);

    return processedPath;
  }

  private async performOCR(imagePath: string): Promise<{ text: string; words: any[] }> {
    const result = await Tesseract.recognize(imagePath, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
        }
      },
    });

    return {
      text: result.data.text,
      words: result.data.words,
    };
  }

  private async detectUIElements(
    imagePath: string,
    ocrResult: { text: string; words: any[] }
  ): Promise<UIElement[]> {
    const elements: UIElement[] = [];
    const metadata = await sharp(imagePath).metadata();
    const imageWidth = metadata.width || 800;
    const imageHeight = metadata.height || 600;

    const words = ocrResult.words || [];
    for (const word of words) {
      if (word.confidence < 60) continue;

      const element = this.classifyUIElement(word, imageWidth, imageHeight);
      elements.push(element);
    }

    const inferredButtons = this.inferButtonsFromLayout(elements, imageWidth, imageHeight);
    elements.push(...inferredButtons);

    return elements;
  }

  private classifyUIElement(word: any, imageWidth: number, imageHeight: number): UIElement {
    const bbox = word.bbox;
    const text = word.text.trim();
    const width = bbox.x1 - bbox.x0;
    const height = bbox.y1 - bbox.y0;

    const aspectRatio = width / height;
    let type: UIElement['type'] = 'label';

    const lowerText = text.toLowerCase();
    if (
      lowerText.includes('button') ||
      lowerText === 'ok' ||
      lowerText === 'cancel' ||
      lowerText === 'submit' ||
      lowerText === 'save' ||
      lowerText === 'close'
    ) {
      type = 'button';
    } else if (aspectRatio > 3 && height < 40) {
      type = 'textfield';
    } else if (width > imageWidth * 0.3 && height < 50) {
      type = 'menu';
    }

    return {
      type,
      bounds: {
        x: bbox.x0,
        y: bbox.y0,
        width,
        height,
      },
      text,
      confidence: word.confidence / 100,
    };
  }

  private inferButtonsFromLayout(
    elements: UIElement[],
    imageWidth: number,
    imageHeight: number
  ): UIElement[] {
    const buttons: UIElement[] = [];
    const bottomRegion = imageHeight * 0.8;

    const bottomElements = elements.filter(e => e.bounds.y > bottomRegion);

    for (let i = 0; i < bottomElements.length - 1; i++) {
      const elem1 = bottomElements[i];
      const elem2 = bottomElements[i + 1];
      const distance = Math.abs(elem1.bounds.x - elem2.bounds.x);

      if (distance < 150 && elem1.text && elem2.text) {
        if (elem1.type !== 'button') {
          elem1.type = 'button';
        }
        if (elem2.type !== 'button') {
          elem2.type = 'button';
        }
      }
    }

    return buttons;
  }

  async generateMCRFromImage(imageId: string): Promise<McrCommand[]> {
    const analysisRecord = await db.query.imageAnalysis.findFirst({
      where: eq(imageAnalysis.imageId, imageId),
    });

    if (!analysisRecord || !analysisRecord.detectedElements) {
      throw new Error('Image analysis not found or not completed');
    }

    const elements = analysisRecord.detectedElements as UIElement[];
    const commands: McrCommand[] = [];

    const sortedElements = [...elements].sort((a, b) => {
      if (Math.abs(a.bounds.y - b.bounds.y) < 50) {
        return a.bounds.x - b.bounds.x;
      }
      return a.bounds.y - b.bounds.y;
    });

    for (let i = 0; i < sortedElements.length; i++) {
      const element = sortedElements[i];
      const centerX = element.bounds.x + element.bounds.width / 2;
      const centerY = element.bounds.y + element.bounds.height / 2;

      if (i > 0) {
        commands.push({
          type: 'delay',
          action: 'wait',
          delay: this.randomDelay(200, 500),
        });
      }

      commands.push({
        type: 'mouse',
        action: 'Move',
        x: Math.round(centerX),
        y: Math.round(centerY),
      });

      commands.push({
        type: 'delay',
        action: 'wait',
        delay: this.randomDelay(100, 300),
      });

      if (element.type === 'button') {
        commands.push({
          type: 'mouse',
          action: 'LeftButtonDown',
          x: Math.round(centerX),
          y: Math.round(centerY),
        });

        commands.push({
          type: 'delay',
          action: 'wait',
          delay: this.randomDelay(50, 150),
        });

        commands.push({
          type: 'mouse',
          action: 'LeftButtonUp',
          x: Math.round(centerX),
          y: Math.round(centerY),
        });
      } else if (element.type === 'textfield' && element.text) {
        commands.push({
          type: 'mouse',
          action: 'LeftButtonDown',
          x: Math.round(centerX),
          y: Math.round(centerY),
        });

        commands.push({
          type: 'mouse',
          action: 'LeftButtonUp',
          x: Math.round(centerX),
          y: Math.round(centerY),
        });

        commands.push({
          type: 'delay',
          action: 'wait',
          delay: this.randomDelay(200, 400),
        });

        for (const char of element.text) {
          commands.push({
            type: 'keyboard',
            action: 'keydown',
            key: char,
          });

          commands.push({
            type: 'delay',
            action: 'wait',
            delay: this.randomDelay(50, 150),
          });

          commands.push({
            type: 'keyboard',
            action: 'keyup',
            key: char,
          });

          commands.push({
            type: 'delay',
            action: 'wait',
            delay: this.randomDelay(30, 100),
          });
        }
      }
    }

    return commands;
  }

  async generateMCRFromImageWithPatterns(
    imageId: string,
    existingPatternIds?: string[]
  ): Promise<McrCommand[]> {
    const baseCommands = await this.generateMCRFromImage(imageId);

    if (!existingPatternIds || existingPatternIds.length === 0) {
      return baseCommands;
    }

    const { patternService } = await import('./patternService');
    const patterns = await patternService.getTopPatterns(10);

    return baseCommands;
  }

  private randomDelay(min: number, max: number): number {
    return Math.round(Math.random() * (max - min) + min);
  }

  async saveMCRFromImage(imageId: string, commands: McrCommand[], fileName: string): Promise<string> {
    const crypto = await import('crypto');
    const filename = crypto.randomBytes(16).toString('hex');
    const filePath = path.join(process.cwd(), 'uploads', filename);

    const { generateMcrContent } = await import('./mcrProcessor');
    const content = generateMcrContent(commands);
    await fs.writeFile(filePath, content);

    const stats = await fs.stat(filePath);

    const [mcrFile] = await db
      .insert(mcrFiles)
      .values({
        originalName: fileName,
        filename,
        size: stats.size,
        humanizationSettings: {
          delayVariation: 25,
          typingErrors: 2,
          hesitationPauses: 15,
          preserveStructure: true,
          removeMouseOnUpload: false,
        } as any,
      })
      .returning();

    await db
      .update(imageAnalysis)
      .set({ generatedMcrId: mcrFile.id })
      .where(eq(imageAnalysis.imageId, imageId));

    return mcrFile.id;
  }

  async getImageAnalysis(imageId: string): Promise<ImageAnalysis | null> {
    const analysis = await db.query.imageAnalysis.findFirst({
      where: eq(imageAnalysis.imageId, imageId),
    });
    return analysis || null;
  }
}

export const imageAnalysisService = new ImageAnalysisService();
