import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const CATEGORIES = ['sort', 'set_in_order', 'shine', 'standardize', 'sustain', 'safety'];

@Injectable()
export class FiveSService {
  constructor(private prisma: PrismaService) {}

  async findAllBySite(siteId: string) {
    return this.prisma.fiveSAudit.findMany({
      where: { siteId },
      include: {
        auditor: { select: { firstName: true, lastName: true } },
        _count: { select: { scores: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, siteId: string) {
    const audit = await this.prisma.fiveSAudit.findFirst({
      where: { id, siteId },
      include: {
        auditor: { select: { firstName: true, lastName: true } },
        scores: { orderBy: { category: 'asc' } },
      },
    });
    if (!audit) throw new NotFoundException('Audit not found');
    return audit;
  }

  async create(siteId: string, auditorId: string, area: string) {
    const audit = await this.prisma.fiveSAudit.create({
      data: {
        siteId,
        auditorId,
        area,
        maxScore: CATEGORIES.length * 5,
      },
    });

    await this.prisma.fiveSScore.createMany({
      data: CATEGORIES.map(cat => ({
        auditId: audit.id,
        category: cat,
        score: 0,
      })),
    });

    return this.findById(audit.id, siteId);
  }

  async updateScores(
    auditId: string,
    siteId: string,
    scores: Array<{ category: string; score: number; notes?: string; photoUrl?: string }>,
  ) {
    // Verify ownership and immutability
    const audit = await this.prisma.fiveSAudit.findFirst({ where: { id: auditId, siteId } });
    if (!audit) throw new NotFoundException('Audit not found');
    if (audit.status === 'completed') throw new BadRequestException('Cannot edit a completed audit — create a new one instead');

    // Filter to valid categories and reject empty submissions
    const validScores = scores.filter(s => CATEGORIES.includes(s.category));
    if (validScores.length === 0) {
      throw new NotFoundException('No valid score categories provided');
    }

    // Batch update in a transaction
    await this.prisma.$transaction(
      validScores
        .map(s =>
          this.prisma.fiveSScore.update({
            where: { auditId_category: { auditId, category: s.category } },
            data: {
              score: Math.max(0, Math.min(5, s.score)),
              notes: s.notes,
              photoUrl: s.photoUrl,
            },
          }),
        ),
    );

    // Recalculate totals
    const allScores = await this.prisma.fiveSScore.findMany({ where: { auditId } });
    const totalScore = allScores.reduce((sum, s) => sum + s.score, 0);
    const maxScore = CATEGORIES.length * 5;
    const percentage = Math.round((totalScore / maxScore) * 1000) / 10;

    await this.prisma.fiveSAudit.update({
      where: { id: auditId },
      data: { totalScore, percentage },
    });

    return this.findById(auditId, siteId);
  }

  async getTrends(siteId: string, area?: string, months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const where: any = { siteId, status: 'completed', completedAt: { gte: since } };
    if (area) where.area = area;

    const audits = await this.prisma.fiveSAudit.findMany({
      where,
      include: { scores: true },
      orderBy: { completedAt: 'asc' },
    });

    // Group by month
    const monthMap: Record<string, {
      sort: number[]; set_in_order: number[]; shine: number[];
      standardize: number[]; sustain: number[]; safety: number[];
      totals: number[]; percentages: number[];
    }> = {};

    for (const audit of audits) {
      const monthKey = audit.completedAt
        ? audit.completedAt.toISOString().slice(0, 7)
        : audit.createdAt.toISOString().slice(0, 7);

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          sort: [], set_in_order: [], shine: [],
          standardize: [], sustain: [], safety: [],
          totals: [], percentages: [],
        };
      }

      for (const score of audit.scores) {
        const cat = score.category as keyof typeof monthMap[string];
        if (monthMap[monthKey][cat] && Array.isArray(monthMap[monthKey][cat])) {
          (monthMap[monthKey][cat] as number[]).push(score.score);
        }
      }
      monthMap[monthKey].totals.push(audit.totalScore);
      monthMap[monthKey].percentages.push(audit.percentage);
    }

    const avg = (arr: number[]) => arr.length > 0
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
      : 0;

    const monthlyTrends = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        sort: avg(data.sort),
        set_in_order: avg(data.set_in_order),
        shine: avg(data.shine),
        standardize: avg(data.standardize),
        sustain: avg(data.sustain),
        safety: avg(data.safety),
        total: avg(data.totals),
        percentage: avg(data.percentages),
      }));

    // Area breakdown
    const areaWhere: any = { siteId, status: 'completed', completedAt: { gte: since } };
    const areaAudits = await this.prisma.fiveSAudit.findMany({
      where: areaWhere,
      orderBy: { completedAt: 'desc' },
    });

    const areaMap: Record<string, { latest: number; count: number }> = {};
    for (const a of areaAudits) {
      if (!areaMap[a.area]) {
        areaMap[a.area] = { latest: a.percentage, count: 0 };
      }
      areaMap[a.area].count++;
    }

    const areas = Object.entries(areaMap).map(([areaName, data]) => ({
      area: areaName,
      latestScore: data.latest,
      auditCount: data.count,
    }));

    return {
      months: monthlyTrends,
      areas,
      insufficientData: audits.length < 3,
    };
  }

  async complete(auditId: string, siteId: string) {
    const audit = await this.prisma.fiveSAudit.findFirst({ where: { id: auditId, siteId } });
    if (!audit) throw new NotFoundException('Audit not found');

    await this.prisma.fiveSAudit.update({
      where: { id: auditId },
      data: { status: 'completed', completedAt: new Date() },
    });

    return this.findById(auditId, siteId);
  }
}
