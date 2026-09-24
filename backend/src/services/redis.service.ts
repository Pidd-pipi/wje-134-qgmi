import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis(this.configService.get<string>('redis.url') ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });

    this.client.on('error', (error) => {
      logger.warn('redis client error', { error: error.message });
    });
  }

  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
    await this.ensureConnected();
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }

    return count;
  }

  async getJson<T>(key: string): Promise<T | null> {
    await this.ensureConnected();
    const value = await this.client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.ensureConnected();
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  /** 按模式批量删除 key（使用 SCAN 游标，生产安全） */
  async deleteByPattern(pattern: string): Promise<number> {
    await this.ensureConnected();
    const stream = this.client.scanStream({ match: pattern, count: 100 });
    let deleted = 0;

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (keys: string[]) => {
        if (keys.length > 0) {
          this.client
            .unlink(keys)
            .then((count) => {
              deleted += count;
            })
            .catch(reject);
        }
      });
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });

    return deleted;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }
}
