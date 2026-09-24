import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureSwagger } from './config/swagger.config';
import { ErrorHandlerMiddleware } from './middlewares/errorHandler.middleware';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.enableCors();
  app.setGlobalPrefix('api', {
    exclude: ['health']
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new ErrorHandlerMiddleware());

  configureSwagger(app);

  const port = config.get<number>('BACKEND_INTERNAL_PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
  logger.info(`cost-control-api backend listening on ${port}`);
}

void bootstrap();
