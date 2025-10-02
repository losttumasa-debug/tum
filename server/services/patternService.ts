import { McrCommand, Pattern, InsertPattern, PatternMetadata } from '@shared/schema';
import { db } from '../db';
import { patterns, patternUsage, mcrFiles } from '@shared/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { cacheService } from './cacheService';
import kmeans from 'ml-kmeans';

interface SequencePattern {
  sequence: McrCommand[];
  frequency: number;
  occurrences: Array<{ fileId: string; index: number }>;
}

export class PatternService {
  async minePatterns(
    fileIds: string[],
    minSequenceLength: number = 3,
    minFrequency: number = 2
  ): Promise<Pattern[]> {
    const fileContents = await Promise.all(
      fileIds.map(async (id) => {
        const file = await db.query.mcrFiles.findFirst({ where: eq(mcrFiles.id, id) });
        return { fileId: id, file };
      })
    );

    const allCommands: Array<{ fileId: string; commands: McrCommand[] }> = [];
    
    for (const { fileId, file } of fileContents) {
      if (!file) continue;
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const { parseMcrContent } = await import('./mcrProcessor');
      const commands = parseMcrContent(content);
      allCommands.push({ fileId, commands });
    }

    const discoveredPatterns = this.findFrequentSequences(
      allCommands,
      minSequenceLength,
      minFrequency
    );

    const savedPatterns: Pattern[] = [];
    
    for (const pattern of discoveredPatterns) {
      const metadata = this.calculatePatternMetadata(pattern);
      
      const [savedPattern] = await db
        .insert(patterns)
        .values({
          name: this.generatePatternName(pattern.sequence),
          commandSequence: pattern.sequence as any,
          frequency: pattern.frequency,
          confidence: this.calculateConfidence(pattern.frequency, fileIds.length),
          sourceFileIds: Array.from(new Set(pattern.occurrences.map(o => o.fileId))),
          metadata: metadata as any,
        })
        .returning();
      
      savedPatterns.push(savedPattern);
    }

    return savedPatterns;
  }

  private findFrequentSequences(
    allCommands: Array<{ fileId: string; commands: McrCommand[] }>,
    minLength: number,
    minFrequency: number
  ): SequencePattern[] {
    const patterns: Map<string, SequencePattern> = new Map();

    for (const { fileId, commands } of allCommands) {
      for (let len = minLength; len <= Math.min(commands.length, 15); len++) {
        for (let i = 0; i <= commands.length - len; i++) {
          const sequence = commands.slice(i, i + len);
          const key = this.sequenceToKey(sequence);
          
          if (!patterns.has(key)) {
            patterns.set(key, {
              sequence,
              frequency: 0,
              occurrences: [],
            });
          }
          
          const pattern = patterns.get(key)!;
          pattern.frequency++;
          pattern.occurrences.push({ fileId, index: i });
        }
      }
    }

    return Array.from(patterns.values())
      .filter(p => p.frequency >= minFrequency)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 100);
  }

  private sequenceToKey(sequence: McrCommand[]): string {
    return sequence
      .map(cmd => `${cmd.type}:${cmd.action}:${cmd.key || ''}`)
      .join('|');
  }

  private calculatePatternMetadata(pattern: SequencePattern): PatternMetadata {
    const delays = pattern.sequence
      .filter(cmd => cmd.type === 'delay' && cmd.delay)
      .map(cmd => cmd.delay!);
    
    const avgDuration = delays.length > 0
      ? delays.reduce((sum, d) => sum + d, 0) / delays.length
      : 0;

    const variance = delays.length > 1
      ? delays.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / delays.length
      : 0;

    return {
      averageDuration: avgDuration,
      variationStdDev: Math.sqrt(variance),
      timesUsed: 0,
      successRate: 1.0,
    };
  }

  private calculateConfidence(frequency: number, totalFiles: number): number {
    return Math.min(frequency / (totalFiles * 2), 1.0);
  }

  private generatePatternName(sequence: McrCommand[]): string {
    const keyboardCommands = sequence.filter(c => c.type === 'keyboard' && c.key);
    if (keyboardCommands.length > 0) {
      const keys = keyboardCommands.map(c => c.key).join('-');
      return `Pattern: ${keys.substring(0, 30)}`;
    }
    return `Pattern: ${sequence.length} commands`;
  }

  async getTopPatterns(limit: number = 20): Promise<Pattern[]> {
    return await db.query.patterns.findMany({
      orderBy: [desc(patterns.confidence), desc(patterns.frequency)],
      limit,
    });
  }

  async getPatternsByFileIds(fileIds: string[]): Promise<Pattern[]> {
    const allPatterns = await db.query.patterns.findMany();
    
    return allPatterns.filter(pattern => {
      const sourceIds = pattern.sourceFileIds || [];
      return fileIds.some(id => sourceIds.includes(id));
    });
  }

  async findSimilarPatterns(commands: McrCommand[], threshold: number = 0.8): Promise<Pattern[]> {
    const allPatterns = await db.query.patterns.findMany();
    const similarPatterns: Array<{ pattern: Pattern; similarity: number }> = [];

    for (const pattern of allPatterns) {
      const patternCommands = pattern.commandSequence as McrCommand[];
      const similarity = this.calculateSimilarity(commands, patternCommands);
      
      if (similarity >= threshold) {
        similarPatterns.push({ pattern, similarity });
      }
    }

    return similarPatterns
      .sort((a, b) => b.similarity - a.similarity)
      .map(p => p.pattern);
  }

  private calculateSimilarity(seq1: McrCommand[], seq2: McrCommand[]): number {
    const len = Math.min(seq1.length, seq2.length);
    if (len === 0) return 0;

    let matches = 0;
    for (let i = 0; i < len; i++) {
      if (
        seq1[i].type === seq2[i].type &&
        seq1[i].action === seq2[i].action &&
        seq1[i].key === seq2[i].key
      ) {
        matches++;
      }
    }

    return matches / Math.max(seq1.length, seq2.length);
  }

  async analyzeCommandTransitions(fileIds: string[]): Promise<Map<string, Map<string, number>>> {
    const transitions = new Map<string, Map<string, number>>();

    for (const fileId of fileIds) {
      const file = await db.query.mcrFiles.findFirst({ where: eq(mcrFiles.id, fileId) });
      if (!file) continue;

      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const { parseMcrContent } = await import('./mcrProcessor');
      const commands = parseMcrContent(content);

      for (let i = 0; i < commands.length - 1; i++) {
        const current = `${commands[i].type}:${commands[i].key || commands[i].action}`;
        const next = `${commands[i + 1].type}:${commands[i + 1].key || commands[i + 1].action}`;

        if (!transitions.has(current)) {
          transitions.set(current, new Map());
        }
        
        const nextMap = transitions.get(current)!;
        nextMap.set(next, (nextMap.get(next) || 0) + 1);
      }
    }

    return transitions;
  }

  async getPredictedNextCommand(
    previousCommands: McrCommand[],
    transitions: Map<string, Map<string, number>>
  ): Promise<McrCommand | null> {
    if (previousCommands.length === 0) return null;

    const lastCmd = previousCommands[previousCommands.length - 1];
    const key = `${lastCmd.type}:${lastCmd.key || lastCmd.action}`;
    const nextOptions = transitions.get(key);

    if (!nextOptions || nextOptions.size === 0) return null;

    let maxCount = 0;
    let bestNext = '';
    
    nextOptions.forEach((count, next) => {
      if (count > maxCount) {
        maxCount = count;
        bestNext = next;
      }
    });

    const [type, keyOrAction] = bestNext.split(':');
    return {
      type: type as any,
      action: type === 'keyboard' ? 'keydown' : keyOrAction,
      key: type === 'keyboard' ? keyOrAction : undefined,
    };
  }

  async recordPatternUsage(patternId: string, fileId: string, success: boolean): Promise<void> {
    const existing = await db.query.patternUsage.findFirst({
      where: eq(patternUsage.patternId, patternId),
    });

    if (existing) {
      const newUsageCount = (existing.usageCount || 0) + 1;
      const currentSuccess = existing.successRate || 1.0;
      const newSuccessRate = (currentSuccess * (newUsageCount - 1) + (success ? 1 : 0)) / newUsageCount;

      await db
        .update(patternUsage)
        .set({
          usageCount: newUsageCount,
          successRate: newSuccessRate,
        })
        .where(eq(patternUsage.id, existing.id));
    } else {
      await db.insert(patternUsage).values({
        patternId,
        fileId,
        usageCount: 1,
        successRate: success ? 1.0 : 0.0,
      });
    }

    await cacheService.incrementPatternUsage(patternId);
  }
}

export const patternService = new PatternService();
