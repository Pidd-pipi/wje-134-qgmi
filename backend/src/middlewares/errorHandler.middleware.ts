import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { fail } from '../utils/response';
import { logger } from '../utils/logger';

@Catch()
export class ErrorHandlerMiddleware implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof Error ? exception.message : '内部服务错误';

    logger.error('request failed', {
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: status,
      message
    });

    response.status(status).json(fail(message, request.requestId));
  }
}
