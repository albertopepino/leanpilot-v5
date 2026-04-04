import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RetentionScheduler {
  private readonly logger = new Logger(RetentionScheduler.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async enforceRetention() {
    const now = new Date();

    // 1. Hard-delete anonymized users after 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const deletedUsers = await this.prisma.user.deleteMany({
      where: {
        isActive: false,
        email: { startsWith: 'deleted-' },
        updatedAt: { lt: thirtyDaysAgo },
      },
    });

    // 2. Archive audit logs older than 2 years (delete for now, archive later)
    const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
    const archivedLogs = await this.prisma.auditLog.deleteMany({
      where: { timestamp: { lt: twoYearsAgo } },
    });

    if (deletedUsers.count > 0 || archivedLogs.count > 0) {
      this.logger.log(
        `Retention: ${deletedUsers.count} deleted users purged, ${archivedLogs.count} old audit logs removed`,
      );
    }
  }
}
