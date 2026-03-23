import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { SubmitScoresDto } from './dto/submit-scores.dto';

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

  async findById(id: string) {
    const audit = await this.prisma.fiveSAudit.findUnique({
      where: { id },
      include: {
        scores: true,
        auditor: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!audit) throw new NotFoundException('Audit not found');
    return audit;
  }

  async create(dto: CreateAuditDto, auditorId: string, siteId: string) {
    return this.prisma.fiveSAudit.create({
      data: {
        area: dto.area,
        notes: dto.notes,
        auditorId,
        siteId,
      },
    });
  }

  async submitScores(auditId: string, dto: SubmitScoresDto) {
    const audit = await this.prisma.fiveSAudit.findUnique({ where: { id: auditId } });
    if (!audit) throw new NotFoundException('Audit not found');

    // Upsert each score
    for (const score of dto.scores) {
      await this.prisma.fiveSScore.upsert({
        where: { auditId_category: { auditId, category: score.category } },
        create: {
          auditId,
          category: score.category,
          score: score.score,
          notes: score.notes,
        },
        update: {
          score: score.score,
          notes: score.notes,
        },
      });
    }

    // Calculate totals
    const allScores = await this.prisma.fiveSScore.findMany({ where: { auditId } });
    const totalScore = allScores.reduce((sum, s) => sum + s.score, 0);
    const maxScore = allScores.length * 5; // Each category max is 5
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // Update audit
    return this.prisma.fiveSAudit.update({
      where: { id: auditId },
      data: {
        totalScore,
        maxScore,
        percentage,
        status: dto.complete ? 'completed' : 'draft',
        completedAt: dto.complete ? new Date() : undefined,
      },
      include: { scores: true },
    });
  }
}
