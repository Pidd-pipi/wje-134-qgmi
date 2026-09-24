import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { RedisService } from '../services/redis.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService
  ) {}

  async use(request: Request, _response: Response, next: NextFunction): Promise<void> {
    const windowSeconds = this.configService.get<number>('redis.rateLimitWindowSeconds') ?? 60;
    const maxRequests = this.configService.get<number>('redis.rateLimitMaxRequests') ?? 60;
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const key = `rate-limit:${ip}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const count = await this.redisService.incrementWithTtl(key, windowSeconds + 5);

    if (count > maxRequests) {
      throw new HttpException(`接口限流：每IP每${windowSeconds}秒最多${maxRequests}次请求`, HttpStatus.TOO_MANY_REQUESTS);
    }

    next();
  }
}
