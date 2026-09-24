import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureSwagger(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('建筑工程项目成本管控 API')
    .setDescription('预算编制、成本归集、变更管理和成本分析的 RESTful API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });
}
