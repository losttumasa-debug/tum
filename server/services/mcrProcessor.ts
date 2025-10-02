  import fs from "fs/promises";
  import path from "path";
  import { McrFile, HumanizationSettings, McrCommand, isCommandEqual } from "@shared/schema";
  import type { IStorage } from "../storage";

  export async function processMcrFile(
    file: McrFile,
    storage: IStorage,
    broadcastUpdate: (data: any) => void
  ): Promise<void> {
    const queueItem = await storage.getQueueItemByFileId(file.id);
    if (!queueItem) {
      // Or handle this case more gracefully
      throw new Error("File not found in processing queue");
    }

    try {
      // Update queue status to processing
      await storage.updateProcessingStatus(queueItem.id, {
        status: 'processing',
        startedAt: new Date(),
        currentStep: 'Reading file'
      });

      const originalPath = path.join(process.cwd(), 'uploads', file.filename);
      const content = await fs.readFile(originalPath, 'utf-8');

      await storage.updateProcessingStatus(queueItem.id, { currentStep: 'Parsing commands' });
      const parsedCommands = parseMcrContent(content);
      
      // ALWAYS remove mouse commands - keyboard only
      const commands = removeMouseCommands(parsedCommands);
      
      console.log(`Filtered ${parsedCommands.length - commands.length} mouse commands from MCR`);

      await storage.updateMcrFile(file.id, {
        originalCommands: commands.length,
        processingProgress: 10
      });

      broadcastUpdate({
        type: 'processingProgress',
        fileId: file.id,
        progress: 10
      });

      await storage.updateProcessingStatus(queueItem.id, { currentStep: 'Humanizing commands' });
      const settings = file.humanizationSettings as HumanizationSettings;
      const humanizedCommands = await humanizeCommands(
        commands,
        settings || {
          delayVariation: 25,
          typingErrors: 2,
          hesitationPauses: 15,
          preserveStructure: true
        },
        (progress) => {
          storage.updateMcrFile(file.id, { processingProgress: 10 + progress * 0.8 });
          broadcastUpdate({
            type: 'processingProgress',
            fileId: file.id,
            progress: 10 + progress * 0.8
          });
        }
      );

      await storage.updateProcessingStatus(queueItem.id, { currentStep: 'Generating output file' });
      const outputContent = generateMcrContent(humanizedCommands);

      const processedDir = path.join(process.cwd(), 'processed');
      await fs.mkdir(processedDir, { recursive: true });

      const processedFileName = `processed_${file.filename}`;
      const processedPath = path.join(processedDir, processedFileName);
      await fs.writeFile(processedPath, outputContent);

      await storage.updateProcessingStatus(queueItem.id, {
        status: 'completed',
        completedAt: new Date(),
        currentStep: 'Finished'
      });
      await storage.updateMcrFile(file.id, {
        status: 'completed',
        processedAt: new Date(),
        processedCommands: humanizedCommands.length,
        processingProgress: 100,
        processedFilePath: `processed/${processedFileName}`
      });

      broadcastUpdate({
        type: 'processingCompleted',
        fileId: file.id
      });

    } catch (error) {
      console.error("Error processing MCR file:", error);
      await storage.updateMcrFile(file.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      if (queueItem) {
        await storage.updateProcessingStatus(queueItem.id, {
          status: 'failed',
          completedAt: new Date(),
          currentStep: 'Error'
        });
      }

      broadcastUpdate({
        type: 'processingFailed',
        fileId: file.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  export function parseMcrContent(content: string): McrCommand[] {
    const lines = content.split('\n');
    const commands: McrCommand[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;

      // Parse different MCR command formats
      if (trimmed.startsWith('Keyboard :')) {
        const match = trimmed.match(/Keyboard : (.+?) : (KeyDown|KeyUp)/);
        if (match) {
          commands.push({
            type: 'keyboard',
            action: match[2].toLowerCase(),
            key: match[1]
          });
        }
      } else if (trimmed.startsWith('DELAY :')) {
        const match = trimmed.match(/DELAY : (\d+)/);
        if (match) {
          commands.push({
            type: 'delay',
            action: 'wait',
            delay: parseInt(match[1])
          });
        }
      } else if (trimmed.startsWith('Mouse :')) {
        const match = trimmed.match(/Mouse : (\d+) : (\d+) : (.*)/);
        if (match) {
          commands.push({
            type: 'mouse',
            action: match[3],
            x: parseInt(match[1]),
            y: parseInt(match[2])
          });
        }
      }
    }

    return commands;
  }

  export function calculateMcrDuration(commands: McrCommand[]): number {
    return commands.reduce((total, command) => {
      if (command.type === 'delay' && command.delay) {
        return total + command.delay;
      }
      return total;
    }, 0);
  }

  export function lengthenMcr(commands: McrCommand[], targetDuration: number): McrCommand[] {
    const currentDuration = calculateMcrDuration(commands);
    if (currentDuration <= 0 || targetDuration <= currentDuration) {
      return commands; // Return original if no duration or already long enough
    }

    const multiplier = Math.ceil(targetDuration / currentDuration);

    let lengthenedCommands: McrCommand[] = [];
    for (let i = 0; i < multiplier; i++) {
      lengthenedCommands = lengthenedCommands.concat(commands);
    }

    return lengthenedCommands;
  }

  export function removeMouseCommands(commands: McrCommand[]): McrCommand[] {
    return commands.filter(cmd => cmd.type !== 'mouse');
  }

  export function removeZeroDelays(commands: McrCommand[]): McrCommand[] {
    return commands.filter(cmd => !(cmd.type === 'delay' && cmd.delay === 0));
  }

  export function findCommonSequences(commands1: McrCommand[], commands2: McrCommand[]): McrCommand[][] {
    const keyboardCommands1 = commands1.filter(c => c.type === 'keyboard');
    const keyboardCommands2 = commands2.filter(c => c.type === 'keyboard');
    const commonSequences: McrCommand[][] = [];
    const MIN_SEQUENCE_LENGTH = 3; // Minimum number of commands to be considered a pattern

    const memo: Record<string, boolean> = {};

    for (let i = 0; i <= keyboardCommands1.length - MIN_SEQUENCE_LENGTH; i++) {
      for (let j = 0; j <= keyboardCommands2.length - MIN_SEQUENCE_LENGTH; j++) {
        let k = 0;
        while (
          i + k < keyboardCommands1.length &&
          j + k < keyboardCommands2.length &&
          isCommandEqual(keyboardCommands1[i + k], keyboardCommands2[j + k])
        ) {
          k++;
        }

        if (k >= MIN_SEQUENCE_LENGTH) {
          const sequence = keyboardCommands1.slice(i, i + k);
          const seqKey = JSON.stringify(sequence.map(s => ({key: s.key, action: s.action})));

          if (!memo[seqKey]) {
            commonSequences.push(sequence);
            memo[seqKey] = true;
          }
          // Move index i forward to avoid re-matching subsets of the found sequence
          i += k - 1;
          break; // Move to the next starting point in the first command list
        }
      }
    }

    return commonSequences;
  }

  export async function mergeAndOptimizeMcrFiles(
    commandsA: McrCommand[],
    commandsB: McrCommand[],
    humanizationSettings: HumanizationSettings
  ): Promise<McrCommand[]> {
    const commonPatterns = findCommonSequences(commandsA, commandsB);
    let mergedCommands: McrCommand[] = [];
    let lastIndexA = 0;

    for (const pattern of commonPatterns) {
      // Find the first occurrence of this pattern in commandsA after lastIndexA
      let patternStartIndex = -1;
      for (let i = lastIndexA; i <= commandsA.length - pattern.length; i++) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
          if (!isCommandEqual(commandsA[i + j], pattern[j])) {
            match = false;
            break;
          }
        }
        if (match) {
          patternStartIndex = i;
          break;
        }
      }

      if (patternStartIndex !== -1) {
        // Add commands from A before the pattern
        mergedCommands = mergedCommands.concat(commandsA.slice(lastIndexA, patternStartIndex));

        // Humanize the common pattern
        const humanizedPattern = await humanizeCommands(pattern, humanizationSettings, () => {});
        mergedCommands = mergedCommands.concat(humanizedPattern);

        // Update lastIndexA to continue after this pattern
        lastIndexA = patternStartIndex + pattern.length;
      }
    }

    // Add any remaining commands from A
    mergedCommands = mergedCommands.concat(commandsA.slice(lastIndexA));

    return mergedCommands;
  }

  export function generateMcrContent(commands: McrCommand[]): string {
    const lines: string[] = [];

    for (const command of commands) {
      switch (command.type) {
        case 'keyboard':
          lines.push(`Keyboard : ${command.key} : ${command.action === 'keydown' ? 'KeyDown' : 'KeyUp'}`);
          break;
        case 'delay':
          lines.push(`DELAY : ${command.delay}`);
          break;
        case 'mouse':
          lines.push(`Mouse : ${command.x} : ${command.y} : ${command.action}`);
          break;
      }
    }

    return lines.join('\r\n');
  }

  export async function humanizeCommands( // Exported
    commands: McrCommand[],
    settings: HumanizationSettings,
    onProgress: (progress: number) => void
  ): Promise<McrCommand[]> {
    const humanized: McrCommand[] = [];
    const totalCommands = commands.length;
    const excludedKeys = settings.excludedKeys || [];
    
    // New parameters for minimal delays and time extension
    const timeExtensionFactor = (settings as any).timeExtensionFactor || 1.0;
    const minDelayMs = (settings as any).minDelay || 10;
    const maxDelayMs = (settings as any).maxDelay || 100;
    
    // Seeded random generator for non-repetitive variations
    let randomSeed = Date.now();
    const seededRandom = () => {
      randomSeed = (randomSeed * 9301 + 49297) % 233280;
      return randomSeed / 233280;
    };

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const progress = (i / totalCommands) * 100;
      onProgress(progress);

      // Skip excluded keyboard commands
      if (command.type === 'keyboard' && command.key && excludedKeys.includes(command.key)) {
        continue; 
      }

      // Skip mouse commands (should already be filtered, but double-check)
      if (command.type === 'mouse') {
        continue;
      }

      // Add minimal hesitation before certain actions
      if (shouldAddHesitation(command, settings.hesitationPauses)) {
        const hesitationDelay = Math.round(minDelayMs + seededRandom() * (maxDelayMs - minDelayMs));
        humanized.push({
          type: 'delay',
          action: 'wait',
          delay: Math.round(hesitationDelay * timeExtensionFactor)
        });
      }

      // Apply TIME EXTENSION and minimal variation to delays
      if (command.type === 'delay' && command.delay) {
        // Apply time extension first
        let extendedDelay = command.delay * timeExtensionFactor;
        
        // Apply minimal variation (±10% max by default)
        const variation = settings.delayVariation / 100;
        const minVariation = extendedDelay * (1 - variation);
        const maxVariation = extendedDelay * (1 + variation);
        
        // Use seeded random for non-repetitive values
        let finalDelay = minVariation + seededRandom() * (maxVariation - minVariation);
        
        // Clamp to min/max bounds
        finalDelay = Math.max(minDelayMs, Math.min(maxDelayMs, finalDelay));
        
        humanized.push({
          ...command,
          delay: Math.round(finalDelay)
        });
      } else {
        humanized.push({ ...command });
      }

      // Add typing errors occasionally
      if (command.type === 'keyboard' &&
          command.action === 'keydown' &&
          shouldAddTypingError(settings.typingErrors)) {

        // Add wrong key press
        const wrongKey = getRandomWrongKey(command.key || '');
        if (wrongKey) {
          humanized.push({
            type: 'keyboard',
            action: 'keydown',
            key: wrongKey
          });
          humanized.push({
            type: 'delay',
            action: 'wait',
            delay: randomDelay(50, 150)
          });
          humanized.push({
            type: 'keyboard',
            action: 'keyup',
            key: wrongKey
          });

          // Add backspace to correct
          humanized.push({
            type: 'delay',
            action: 'wait',
            delay: randomDelay(100, 300)
          });
          humanized.push({
            type: 'keyboard',
            action: 'keydown',
            key: 'Backspace'
          });
          humanized.push({
            type: 'keyboard',
            action: 'keyup',
            key: 'Backspace'
          });
        }
      }

      // Add small random delays between actions
      if (!settings.preserveStructure && command.type !== 'delay' && i < commands.length - 1) {
        humanized.push({
          type: 'delay',
          action: 'wait',
          delay: randomDelay(5, 25)
        });
      }

      // Yield control occasionally to prevent blocking
      if (i % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return humanized;
  }

  function shouldAddHesitation(command: McrCommand, hesitationRate: number): boolean {
    if (command.type !== 'keyboard') return false;
    return Math.random() < (hesitationRate / 100);
  }

  function shouldAddTypingError(errorRate: number): boolean {
    return Math.random() < (errorRate / 100);
  }

  function getRandomWrongKey(correctKey: string): string | null {
    const keyboard: Record<string, string[]> = {
      'Q': ['W', 'A'],
      'W': ['Q', 'E', 'S'],
      'E': ['W', 'R', 'D'],
      'R': ['E', 'T', 'F'],
      'T': ['R', 'Y', 'G'],
      'Y': ['T', 'U', 'H'],
      'U': ['Y', 'I', 'J'],
      'I': ['U', 'O', 'K'],
      'O': ['I', 'P', 'L'],
      'P': ['O', 'L'],
      'A': ['Q', 'S', 'Z'],
      'S': ['A', 'W', 'D', 'X'],
      'D': ['S', 'E', 'F', 'C'],
      'F': ['D', 'R', 'G', 'V'],
      'G': ['F', 'T', 'H', 'B'],
      'H': ['G', 'Y', 'J', 'N'],
      'J': ['H', 'U', 'K', 'M'],
      'K': ['J', 'I', 'L'],
      'L': ['K', 'O', 'P'],
      'Z': ['A', 'X'],
      'X': ['Z', 'S', 'C'],
      'C': ['X', 'D', 'V'],
      'V': ['C', 'F', 'B'],
      'B': ['V', 'G', 'N'],
      'N': ['B', 'H', 'M'],
      'M': ['N', 'J']
    };

    const adjacent = keyboard[correctKey.toUpperCase()];
    if (!adjacent || adjacent.length === 0) return null;

    return adjacent[Math.floor(Math.random() * adjacent.length)];
  }

  function randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  function randomDelay(min: number, max: number): number {
    return Math.round(randomInRange(min, max));
  }