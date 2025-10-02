import Redis from 'ioredis';
import crypto from 'crypto';
import { McrCommand } from '@shared/schema';

class CacheService {
  private redis: Redis | null = null;
  private defaultTTL = 60 * 60 * 24; // 24 hours
  private enabled = false;

  constructor() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 2) return null;
          const delay = Math.min(times * 50, 500);
          return delay;
        },
      });

      this.redis.on('error', (err) => {
        this.enabled = false;
      });

      this.redis.on('connect', () => {
        console.log('✓ Redis connected - caching enabled');
        this.enabled = true;
      });

      this.redis.connect().catch(() => {
        console.log('⚠ Redis not available - caching disabled (performance may be reduced)');
        this.enabled = false;
        this.redis = null;
      });
    } catch (error) {
      console.log('⚠ Redis initialization failed - caching disabled');
      this.enabled = false;
      this.redis = null;
    }
  }

  generateFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async cacheCommands(fileHash: string, commands: McrCommand[]): Promise<void> {
    if (!this.enabled || !this.redis) return;
    try {
      const key = `mcr:commands:${fileHash}`;
      await this.redis.setex(key, this.defaultTTL, JSON.stringify(commands));
    } catch (error) {
      // Silently fail - caching is optional
    }
  }

  async getCachedCommands(fileHash: string): Promise<McrCommand[] | null> {
    if (!this.enabled || !this.redis) return null;
    try {
      const key = `mcr:commands:${fileHash}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  async cachePatternAnalysis(fileHashes: string[], patterns: any): Promise<void> {
    if (!this.enabled || !this.redis) return;
    try {
      const key = `mcr:patterns:${fileHashes.sort().join(':')}`;
      await this.redis.setex(key, this.defaultTTL, JSON.stringify(patterns));
    } catch (error) {
      // Silently fail
    }
  }

  async getCachedPatternAnalysis(fileHashes: string[]): Promise<any | null> {
    if (!this.enabled || !this.redis) return null;
    try {
      const key = `mcr:patterns:${fileHashes.sort().join(':')}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  async cacheImageAnalysis(imageId: string, analysis: any): Promise<void> {
    if (!this.enabled || !this.redis) return;
    try {
      const key = `image:analysis:${imageId}`;
      await this.redis.setex(key, this.defaultTTL, JSON.stringify(analysis));
    } catch (error) {
      // Silently fail
    }
  }

  async getCachedImageAnalysis(imageId: string): Promise<any | null> {
    if (!this.enabled || !this.redis) return null;
    try {
      const key = `image:analysis:${imageId}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  async incrementPatternUsage(patternId: string): Promise<number> {
    if (!this.enabled || !this.redis) return 0;
    try {
      const key = `pattern:usage:${patternId}`;
      return await this.redis.incr(key);
    } catch (error) {
      return 0;
    }
  }

  async getPatternUsageCount(patternId: string): Promise<number> {
    if (!this.enabled || !this.redis) return 0;
    try {
      const key = `pattern:usage:${patternId}`;
      const count = await this.redis.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      return 0;
    }
  }

  async invalidateFileCache(fileHash: string): Promise<void> {
    const pattern = `mcr:*:${fileHash}*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async clearAllCache(): Promise<void> {
    await this.redis.flushdb();
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export const cacheService = new CacheService();
