import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_STATUSES = ['draft', 'in_progress', 'review', 'completed', 'closed'];

@Injectable()
export class A3Service {
  constructor(private prisma: PrismaService) {}

  async findAll(siteId: string) {
    return this.prisma.a3Report.findMany({
      where: { siteId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        sponsor: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, siteId: string) {
    const report = await this.prisma.a3Report.findFirst({
      where: { id, siteId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        sponsor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!report) throw new NotFoundException('A3 report not found');
    return report;
  }

  async create(siteId: string, ownerId: string, data: {
    title: string;
    sponsorId?: string;
    background?: string;
    currentCondition?: string;
    targetCondition?: string;
    categoryTag?: string;
  }) {
    if (data.sponsorId) {
      const sponsor = await this.prisma.user.findFirst({
        where: { id: data.sponsorId, siteId },
      });
      if (!sponsor) throw new BadRequestException('Sponsor not found or does not belong to this site');
    }

    return this.prisma.a3Report.create({
      data: {
        siteId,
        ownerId,
        title: data.title,
        sponsorId: data.sponsorId,
        background: data.background,
        currentCondition: data.currentCondition,
        targetCondition: data.targetCondition,
        categoryTag: data.categoryTag,
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        sponsor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, siteId: string, data: {
    title?: string;
    sponsorId?: string;
    background?: string;
    currentCondition?: string;
    targetCondition?: string;
    gapAnalysis?: string;
    rootCauseAnalysis?: string;
    fiveWhyId?: string;
    ishikawaId?: string;
    countermeasures?: string;
    implementationPlan?: string;
    confirmationMethod?: string;
    followUpDate?: string;
    followUpNotes?: string;
    categoryTag?: string;
  }) {
    const report = await this.prisma.a3Report.findFirst({ where: { id, siteId } });
    if (!report) throw new NotFoundException('A3 report not found');

    const updateData: any = { ...data };
    if (data.followUpDate) updateData.followUpDate = new Date(data.followUpDate);

    return this.prisma.a3Report.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        sponsor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async changeStatus(id: string, siteId: string, status: string) {
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const report = await this.prisma.a3Report.findFirst({ where: { id, siteId } });
    if (!report) throw new NotFoundException('A3 report not found');

    const data: any = { status };
    if (status === 'completed') {
      data.completedAt = new Date();
    }

    return this.prisma.a3Report.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        sponsor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
