import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
        responseMs: Date.now() - start,
      };
    } catch {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        responseMs: Date.now() - start,
      };
    }
  }
}
