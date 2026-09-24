import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = Date.now();
    response.on('finish', () => {
      if (request.method === 'GET') {
        return;
      }

      logger.info('audit request completed', {
        requestId: request.requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        userId: request.user?.id,
        role: request.user?.role,
        durationMs: Date.now() - startedAt
      });
    });

    next();
  }
}
