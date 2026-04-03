import { NestFactory, Reflector } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

// BigInt cannot be serialized to JSON by default — convert to Number for API responses
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://nbg1.your-objectstorage.com'],
        connectSrc: ["'self'", 'wss:', 'ws:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    } : false, // Disable CSP in dev (Swagger needs inline scripts)
    crossOriginEmbedderPolicy: false, // Allow loading images from S3
  }));

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS — allow frontend dev server
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://leanpilot.me', 'https://www.leanpilot.me']
      : ['http://localhost:3000', 'http://localhost:4001'],
    credentials: true,
  });

  // Global audit interceptor — logs all POST/PATCH/DELETE requests
  const auditInterceptor = app.get(
    (await import('./audit/audit.interceptor')).AuditInterceptor,
  );
  app.useGlobalInterceptors(auditInterceptor);

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
  const logger = new Logger('Bootstrap');
  logger.log(`LeanPilot API running on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
