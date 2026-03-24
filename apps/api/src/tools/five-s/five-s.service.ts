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

  async complete(auditId: string, siteId: string) {
    const audit = await this.prisma.fiveSAudit.findFirst({ where: { id: auditId, siteId } });
    if (!audit) throw new NotFoundException('Audit not found');

    return this.prisma.fiveSAudit.update({
      where: { id: auditId },
      data: { status: 'completed', completedAt: new Date() },
    });
  }
}
