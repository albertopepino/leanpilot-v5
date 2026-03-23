import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS — allow frontend dev server
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://leanpilot.me', 'https://www.leanpilot.me']
      : ['http://localhost:3000'],
    credentials: true,
  });

  // Validation pipe — auto-validate DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown properties
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true,           // Auto-transform types
    }),
  );

  // Swagger (dev only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('LeanPilot API')
      .setDescription('Lean Manufacturing Management Platform')
      .setVersion('4.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  console.log(`🏭 LeanPilot API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
