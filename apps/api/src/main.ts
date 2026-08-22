import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RequestIdInterceptor } from './interceptors/request-id.interceptor';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    })
  );

  app.useGlobalInterceptors(new RequestIdInterceptor());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Eyano API')
      .setDescription('API pour l\'assistant IA Eyano')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Eyano API running on http://localhost:${port}`);
}
bootstrap();
