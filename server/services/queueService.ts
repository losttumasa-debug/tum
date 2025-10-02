import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { McrFile, HumanizationSettings } from '@shared/schema';
import { storage } from '../storage';
import { processMcrFile } from './mcrProcessor';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

export interface ProcessingJobData {
  fileId: string;
  file: McrFile;
  settings: HumanizationSettings;
}

export interface ImageAnalysisJobData {
  imageId: string;
  imagePath: string;
}

export interface PatternMiningJobData {
  fileIds: string[];
  minFrequency?: number;
}

class QueueService {
  private processingQueue: Queue;
  private imageAnalysisQueue: Queue;
  private patternMiningQueue: Queue;
  private worker: Worker | null = null;
  private imageWorker: Worker | null = null;
  private patternWorker: Worker | null = null;
  private broadcastCallback: ((data: any) => void) | null = null;

  constructor() {
    this.processingQueue = new Queue('mcr-processing', { connection });
    this.imageAnalysisQueue = new Queue('image-analysis', { connection });
    this.patternMiningQueue = new Queue('pattern-mining', { connection });
  }

  setBroadcastCallback(callback: (data: any) => void) {
    this.broadcastCallback = callback;
  }

  async addProcessingJob(file: McrFile, priority: number = 10): Promise<string> {
    const job = await this.processingQueue.add(
      'process-mcr',
      {
        fileId: file.id,
        file,
        settings: file.humanizationSettings as HumanizationSettings,
      } as ProcessingJobData,
      {
        priority,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );
    return job.id!;
  }

  async addImageAnalysisJob(imageId: string, imagePath: string): Promise<string> {
    const job = await this.imageAnalysisQueue.add(
      'analyze-image',
      {
        imageId,
        imagePath,
      } as ImageAnalysisJobData,
      {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 3000,
        },
      }
    );
    return job.id!;
  }

  async addPatternMiningJob(fileIds: string[], minFrequency: number = 2): Promise<string> {
    const job = await this.patternMiningQueue.add(
      'mine-patterns',
      {
        fileIds,
        minFrequency,
      } as PatternMiningJobData,
      {
        attempts: 2,
      }
    );
    return job.id!;
  }

  startWorkers() {
    this.worker = new Worker(
      'mcr-processing',
      async (job: Job<ProcessingJobData>) => {
        console.log(`Processing job ${job.id} for file ${job.data.fileId}`);
        const broadcastUpdate = (data: any) => {
          if (this.broadcastCallback) {
            this.broadcastCallback(data);
          }
        };
        await processMcrFile(job.data.file, storage, broadcastUpdate);
      },
      {
        connection,
        concurrency: 3,
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    console.log('Queue workers started with concurrency: 3');
  }

  async getQueueStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.processingQueue.getWaitingCount(),
      this.processingQueue.getActiveCount(),
      this.processingQueue.getCompletedCount(),
      this.processingQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async getJobStatus(jobId: string) {
    const job = await this.processingQueue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      progress: job.progress,
      state: await job.getState(),
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
    };
  }

  async pauseQueue() {
    await this.processingQueue.pause();
  }

  async resumeQueue() {
    await this.processingQueue.resume();
  }

  async clearCompletedJobs() {
    await this.processingQueue.clean(0, 1000, 'completed');
  }

  async close() {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.imageWorker) {
      await this.imageWorker.close();
    }
    if (this.patternWorker) {
      await this.patternWorker.close();
    }
    await this.processingQueue.close();
    await this.imageAnalysisQueue.close();
    await this.patternMiningQueue.close();
    await connection.quit();
  }
}

export const queueService = new QueueService();
