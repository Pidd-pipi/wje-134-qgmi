import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = Date.now();
    request.requestId = request.headers['x-request-id']?.toString() ?? randomUUID();
    response.setHeader('x-request-id', request.requestId);

    response.on('finish', () => {
      logger.info('request completed', {
        requestId: request.requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt
      });
    });

    next();
  }
}
