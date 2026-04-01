import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_STATUSES = ['recording', 'analyzing', 'improved', 'verified'];

@Injectable()
export class SmedService {
  constructor(private prisma: PrismaService) {}

  async findAll(siteId: string, filters: {
    workstationId?: string;
    status?: string;
  }) {
    const where: any = { siteId };
    if (filters.workstationId) where.workstationId = filters.workstationId;
    if (filters.status) where.status = filters.status;

    return this.prisma.smedAnalysis.findMany({
      where,
      include: {
        workstation: { select: { id: true, name: true, code: true } },
        analyst: { select: { id: true, firstName: true, lastName: true } },
        activities: { orderBy: { sequence: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, siteId: string) {
    const analysis = await this.prisma.smedAnalysis.findFirst({
      where: { id, siteId },
      include: {
        workstation: { select: { id: true, name: true, code: true } },
        analyst: { select: { id: true, firstName: true, lastName: true } },
        activities: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!analysis) throw new NotFoundException('SMED analysis not found');
    return analysis;
  }

  async create(siteId: string, analystId: string, data: {
    workstationId: string;
    title: string;
    productFrom?: string;
    productTo?: string;
    baselineMinutes?: number;
    targetMinutes?: number;
    notes?: string;
  }) {
    // Validate workstation belongs to site
    const workstation = await this.prisma.workstation.findFirst({
      where: { id: data.workstationId, siteId },
    });
    if (!workstation) throw new BadRequestException('Workstation not found or does not belong to this site');

    return this.prisma.smedAnalysis.create({
      data: {
        siteId,
        analystId,
        workstationId: data.workstationId,
        title: data.title,
        productFrom: data.productFrom,
        productTo: data.productTo,
        baselineMinutes: data.baselineMinutes,
        targetMinutes: data.targetMinutes,
        notes: data.notes,
      },
      include: {
        workstation: { select: { id: true, name: true, code: true } },
        analyst: { select: { id: true, firstName: true, lastName: true } },
        activities: { orderBy: { sequence: 'asc' } },
      },
    });
  }

  async update(id: string, siteId: string, data: {
    title?: string;
    productFrom?: string;
    productTo?: string;
    status?: string;
    baselineMinutes?: number;
    targetMinutes?: number;
    actualMinutes?: number;
    notes?: string;
  }) {
    const analysis = await this.prisma.smedAnalysis.findFirst({ where: { id, siteId } });
    if (!analysis) throw new NotFoundException('SMED analysis not found');

    if (data.status && !VALID_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const updateData: any = { ...data };
    if (data.status === 'verified') {
      updateData.completedAt = new Date();
    }

    return this.prisma.smedAnalysis.update({
      where: { id },
      data: updateData,
      include: {
        workstation: { select: { id: true, name: true, code: true } },
        analyst: { select: { id: true, firstName: true, lastName: true } },
        activities: { orderBy: { sequence: 'asc' } },
      },
    });
  }

  async addActivity(analysisId: string, siteId: string, data: {
    sequence: number;
    description: string;
    type?: string;
    durationSeconds: number;
    canConvert?: boolean;
    improvement?: string;
  }) {
    const analysis = await this.prisma.smedAnalysis.findFirst({ where: { id: analysisId, siteId } });
    if (!analysis) throw new NotFoundException('SMED analysis not found');

    if (data.type && !['internal', 'external'].includes(data.type)) {
      throw new BadRequestException('Type must be internal or external');
    }

    return this.prisma.smedActivity.create({
      data: {
        analysisId,
        sequence: data.sequence,
        description: data.description,
        type: data.type || 'internal',
        durationSeconds: data.durationSeconds,
        canConvert: data.canConvert ?? false,
        improvement: data.improvement,
      },
    });
  }

  async updateActivity(analysisId: string, activityId: string, siteId: string, data: {
    sequence?: number;
    description?: string;
    type?: string;
    durationSeconds?: number;
    canConvert?: boolean;
    convertedTo?: string;
    improvement?: string;
  }) {
    const analysis = await this.prisma.smedAnalysis.findFirst({ where: { id: analysisId, siteId } });
    if (!analysis) throw new NotFoundException('SMED analysis not found');

    const activity = await this.prisma.smedActivity.findFirst({
      where: { id: activityId, analysisId },
    });
    if (!activity) throw new NotFoundException('SMED activity not found');

    if (data.type && !['internal', 'external'].includes(data.type)) {
      throw new BadRequestException('Type must be internal or external');
    }
    if (data.convertedTo && !['internal', 'external'].includes(data.convertedTo)) {
      throw new BadRequestException('convertedTo must be internal or external');
    }

    return this.prisma.smedActivity.update({
      where: { id: activityId },
      data,
    });
  }

  async removeActivity(analysisId: string, activityId: string, siteId: string) {
    const analysis = await this.prisma.smedAnalysis.findFirst({ where: { id: analysisId, siteId } });
    if (!analysis) throw new NotFoundException('SMED analysis not found');

    const activity = await this.prisma.smedActivity.findFirst({
      where: { id: activityId, analysisId },
    });
    if (!activity) throw new NotFoundException('SMED activity not found');

    await this.prisma.smedActivity.delete({ where: { id: activityId } });
    return { success: true };
  }
}
