import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_RCA_STATUSES = ['open', 'in_progress', 'completed', 'verified'];
const VALID_ISHIKAWA_CATEGORIES = ['man', 'machine', 'method', 'material', 'measurement', 'environment'];
const VALID_8D_STATUSES = [
  'd0_initiated', 'd1_team', 'd2_problem', 'd3_containment',
  'd4_root_cause', 'd5_corrective', 'd6_implemented', 'd7_prevention', 'd8_closed',
];

@Injectable()
export class RootCauseService {
  constructor(private prisma: PrismaService) {}

  // ===== FIVE WHY =====

  async findFiveWhy(siteId: string, limit = 50, offset = 0) {
    const take = Math.min(Math.max(1, limit), 200);
    const skip = Math.max(0, offset);
    const where = { siteId };

    const [data, total] = await Promise.all([
      this.prisma.fiveWhyAnalysis.findMany({
        where,
        include: {
          analyst: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { steps: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.fiveWhyAnalysis.count({ where }),
    ]);

    return { data, total, limit: take, offset: skip };
  }

  async findFiveWhyById(id: string, siteId: string) {
    const analysis = await this.prisma.fiveWhyAnalysis.findFirst({
      where: { id, siteId },
      include: {
        analyst: { select: { id: true, firstName: true, lastName: true } },
        steps: { orderBy: { stepNumber: 'asc' } },
      },
    });
    if (!analysis) throw new NotFoundException('Five-Why analysis not found');
    return analysis;
  }

  async createFiveWhy(siteId: string, userId: string, data: {
    title: string;
    ncrId?: string;
    incidentId?: string;
    categoryTag?: string;
  }) {
    return this.prisma.fiveWhyAnalysis.create({
      data: {
        siteId,
        analystId: userId,
        title: data.title,
        ncrId: data.ncrId,
        incidentId: data.incidentId,
        categoryTag: data.categoryTag,
      },
      include: {
        analyst: { select: { id: true, firstName: true, lastName: true } },
        steps: true,
      },
    });
  }

  async updateFiveWhy(id: string, siteId: string, data: {
    title?: string;
    status?: string;
    rootCauseSummary?: string;
    categoryTag?: string;
  }) {
    const analysis = await this.prisma.fiveWhyAnalysis.findFirst({ where: { id, siteId } });
    if (!analysis) throw new NotFoundException('Five-Why analysis not found');

    if (data.status && !VALID_RCA_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status. Must be: ${VALID_RCA_STATUSES.join(', ')}`);
    }

    const updateData: any = { ...data };
    if (data.status === 'completed' && !analysis.completedAt) {
      updateData.completedAt = new Date();
    }

    return this.prisma.fiveWhyAnalysis.update({
      where: { id },
      data: updateData,
      include: {
        analyst: { select: { id: true, firstName: true, lastName: true } },
        steps: { orderBy: { stepNumber: 'asc' } },
      },
    });
  }

  async upsertFiveWhyStep(analysisId: string, siteId: string, data: {
    stepNumber: number;
    question: string;
    answer: string;
  }) {
    // Validate analysis belongs to site
    const analysis = await this.prisma.fiveWhyAnalysis.findFirst({ where: { id: analysisId, siteId } });
    if (!analysis) throw new NotFoundException('Five-Why analysis not found');

    if (data.stepNumber < 1 || data.stepNumber > 5) {
      throw new BadRequestException('Step number must be between 1 and 5');
    }

    // Upsert: update if step exists, create if not
    const existing = await this.prisma.fiveWhyStep.findUnique({
      where: { analysisId_stepNumber: { analysisId, stepNumber: data.stepNumber } },
    });

    if (existing) {
      return this.prisma.fiveWhyStep.update({
        where: { id: existing.id },
        data: { question: data.question, answer: data.answer },
      });
    }

    return this.prisma.fiveWhyStep.create({
      data: {
        analysisId,
        stepNumber: data.stepNumber,
        question: data.question,
        answer: data.answer,
      },
    });
  }

  // ===== ISHIKAWA =====

  async findIshikawa(siteId: string, limit = 50, offset = 0) {
    const take = Math.min(Math.max(1, limit), 200);
    const skip = Math.max(0, offset);
    const where = { siteId };

    const [data, total] = await Promise.all([
      this.prisma.ishikawaAnalysis.findMany({
        where,
        include: {
          analyst: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { causes: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.ishikawaAnalysis.count({ where }),
    ]);

    return { data, total, limit: take, offset: skip };
  }

  async findIshikawaById(id: string, siteId: string) {
    const analysis = await this.prisma.ishikawaAnalysis.findFirst({
      where: { id, siteId },
      include: {
        analyst: { select: { id: true, firstName: true, lastName: true } },
        causes: true,
      },
    });
    if (!analysis) throw new NotFoundException('Ishikawa analysis not found');
    return analysis;
  }

  async createIshikawa(siteId: string, userId: string, data: {
    title: string;
    ncrId?: string;
    incidentId?: string;
    categoryTag?: string;
  }) {
    return this.prisma.ishikawaAnalysis.create({
      data: {
        siteId,
        analystId: userId,
        title: data.title,
        ncrId: data.ncrId,
        incidentId: data.incidentId,
        categoryTag: data.categoryTag,
      },
      include: {
        analyst: { select: { id: true, firstName: true, lastName: true } },
        causes: true,
      },
    });
  }

  async updateIshikawa(id: string, siteId: string, data: {
    title?: string;
    status?: string;
    rootCauseSummary?: string;
    categoryTag?: string;
  }) {
    const analysis = await this.prisma.ishikawaAnalysis.findFirst({ where: { id, siteId } });
    if (!analysis) throw new NotFoundException('Ishikawa analysis not found');

    if (data.status && !VALID_RCA_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status. Must be: ${VALID_RCA_STATUSES.join(', ')}`);
    }

    const updateData: any = { ...data };
    if (data.status === 'completed' && !analysis.completedAt) {
      updateData.completedAt = new Date();
    }

    return this.prisma.ishikawaAnalysis.update({
      where: { id },
      data: updateData,
      include: {
        analyst: { select: { id: true, firstName: true, lastName: true } },
        causes: true,
      },
    });
  }

  async addIshikawaCause(analysisId: string, siteId: string, data: {
    category: string;
    description: string;
    isRootCause?: boolean;
  }) {
    const analysis = await this.prisma.ishikawaAnalysis.findFirst({ where: { id: analysisId, siteId } });
    if (!analysis) throw new NotFoundException('Ishikawa analysis not found');

    if (!VALID_ISHIKAWA_CATEGORIES.includes(data.category)) {
      throw new BadRequestException(`Invalid category. Must be: ${VALID_ISHIKAWA_CATEGORIES.join(', ')}`);
    }

    return this.prisma.ishikawaCause.create({
      data: {
        analysisId,
        category: data.category,
        description: data.description,
        isRootCause: data.isRootCause ?? false,
      },
    });
  }

  async removeIshikawaCause(causeId: string, analysisId: string, siteId: string) {
    // Validate analysis belongs to site
    const analysis = await this.prisma.ishikawaAnalysis.findFirst({ where: { id: analysisId, siteId } });
    if (!analysis) throw new NotFoundException('Ishikawa analysis not found');

    const cause = await this.prisma.ishikawaCause.findFirst({ where: { id: causeId, analysisId } });
    if (!cause) throw new NotFoundException('Cause not found');

    return this.prisma.ishikawaCause.delete({ where: { id: causeId } });
  }

  // ===== 8D =====

  async findEightD(siteId: string, limit = 50, offset = 0) {
    const take = Math.min(Math.max(1, limit), 200);
    const skip = Math.max(0, offset);
    const where = { siteId };

    const [data, total] = await Promise.all([
      this.prisma.eightDReport.findMany({
        where,
        include: {
          teamLeader: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.eightDReport.count({ where }),
    ]);

    return { data, total, limit: take, offset: skip };
  }

  async findEightDById(id: string, siteId: string) {
    const report = await this.prisma.eightDReport.findFirst({
      where: { id, siteId },
      include: {
        teamLeader: { select: { id: true, firstName: true, lastName: true } },
        fiveWhy: { include: { steps: { orderBy: { stepNumber: 'asc' } } } },
        ishikawa: { include: { causes: true } },
      },
    });
    if (!report) throw new NotFoundException('8D report not found');
    return report;
  }

  async createEightD(siteId: string, userId: string, data: {
    title: string;
    ncrId?: string;
    incidentId?: string;
    teamMembers?: string;
    categoryTag?: string;
  }) {
    return this.prisma.eightDReport.create({
      data: {
        siteId,
        teamLeaderId: userId,
        title: data.title,
        ncrId: data.ncrId,
        incidentId: data.incidentId,
        teamMembers: data.teamMembers,
        categoryTag: data.categoryTag,
      },
      include: {
        teamLeader: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async updateEightD(id: string, siteId: string, data: {
    title?: string;
    status?: string;
    teamMembers?: string;
    d2ProblemDescription?: string;
    d2IsIsNot?: string;
    d3ContainmentActions?: string;
    d3ContainmentEffective?: boolean;
    d4FiveWhyId?: string;
    d4IshikawaId?: string;
    d4RootCauseSummary?: string;
    d5CorrectiveActions?: string;
    d6ImplementationNotes?: string;
    d7SystemicChanges?: string;
    d7LessonsLearned?: string;
    d8CustomerResponse?: string;
    categoryTag?: string;
  }) {
    const report = await this.prisma.eightDReport.findFirst({ where: { id, siteId } });
    if (!report) throw new NotFoundException('8D report not found');

    if (data.status && !VALID_8D_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status. Must be: ${VALID_8D_STATUSES.join(', ')}`);
    }

    const updateData: any = { ...data };
    if (data.status === 'd8_closed' && !report.d8ClosedAt) {
      updateData.d8ClosedAt = new Date();
    }

    return this.prisma.eightDReport.update({
      where: { id },
      data: updateData,
      include: {
        teamLeader: { select: { id: true, firstName: true, lastName: true } },
        fiveWhy: { include: { steps: { orderBy: { stepNumber: 'asc' } } } },
        ishikawa: { include: { causes: true } },
      },
    });
  }

  // ===== PARETO =====

  async getPareto(siteId: string) {
    // Aggregate categoryTag across all 3 RCA types
    const [fiveWhyTags, ishikawaTags, eightDTags] = await Promise.all([
      this.prisma.fiveWhyAnalysis.groupBy({
        by: ['categoryTag'],
        where: { siteId, categoryTag: { not: null } },
        _count: { id: true },
      }),
      this.prisma.ishikawaAnalysis.groupBy({
        by: ['categoryTag'],
        where: { siteId, categoryTag: { not: null } },
        _count: { id: true },
      }),
      this.prisma.eightDReport.groupBy({
        by: ['categoryTag'],
        where: { siteId, categoryTag: { not: null } },
        _count: { id: true },
      }),
    ]);

    // Merge counts
    const merged: Record<string, number> = {};
    for (const row of fiveWhyTags) {
      if (row.categoryTag) merged[row.categoryTag] = (merged[row.categoryTag] || 0) + row._count.id;
    }
    for (const row of ishikawaTags) {
      if (row.categoryTag) merged[row.categoryTag] = (merged[row.categoryTag] || 0) + row._count.id;
    }
    for (const row of eightDTags) {
      if (row.categoryTag) merged[row.categoryTag] = (merged[row.categoryTag] || 0) + row._count.id;
    }

    // Sort descending for Pareto
    const sorted = Object.entries(merged)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Compute cumulative percentage
    const total = sorted.reduce((sum, item) => sum + item.count, 0);
    let cumulative = 0;
    return sorted.map(item => {
      cumulative += item.count;
      return {
        category: item.category,
        count: item.count,
        percentage: total > 0 ? Math.round((item.count / total) * 10000) / 100 : 0,
        cumulativePercentage: total > 0 ? Math.round((cumulative / total) * 10000) / 100 : 0,
      };
    });
  }
}
