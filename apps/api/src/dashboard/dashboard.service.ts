import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSiteKPIs(siteId: string) {
    const [userCount, auditCount, kaizenTotal, kaizenCompleted, recentAudits] =
      await Promise.all([
        this.prisma.user.count({ where: { siteId, isActive: true } }),
        this.prisma.fiveSAudit.count({ where: { siteId, status: 'completed' } }),
        this.prisma.kaizenItem.count({ where: { siteId } }),
        this.prisma.kaizenItem.count({ where: { siteId, status: 'completed' } }),
        this.prisma.fiveSAudit.findMany({
          where: { siteId, status: 'completed' },
          orderBy: { completedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            area: true,
            percentage: true,
            completedAt: true,
            auditor: { select: { firstName: true, lastName: true } },
          },
        }),
      ]);

    // Average 5S score (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentScores = await this.prisma.fiveSAudit.aggregate({
      where: {
        siteId,
        status: 'completed',
        completedAt: { gte: thirtyDaysAgo },
      },
      _avg: { percentage: true },
    });

    return {
      users: userCount,
      audits: {
        total: auditCount,
        averageScore: Math.round(recentScores._avg.percentage || 0),
        recent: recentAudits,
      },
      kaizen: {
        total: kaizenTotal,
        completed: kaizenCompleted,
        completionRate: kaizenTotal > 0
          ? Math.round((kaizenCompleted / kaizenTotal) * 100)
          : 0,
      },
    };
  }
}
