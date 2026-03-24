import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const VALID_STATUSES = ['submitted', 'under_review', 'approved', 'in_progress', 'completed', 'rejected'];
const VALID_IMPACTS = ['low', 'medium', 'high'];

@Injectable()
export class KaizenService {
  constructor(private prisma: PrismaService) {}

  async findAllBySite(siteId: string) {
    return this.prisma.kaizenIdea.findMany({
      where: { siteId },
      include: {
        submittedBy: { select: { firstName: true, lastName: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, siteId: string) {
    const idea = await this.prisma.kaizenIdea.findFirst({
      where: { id, siteId },
      include: {
        submittedBy: { select: { firstName: true, lastName: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
        gembaObservation: true,
      },
    });
    if (!idea) throw new NotFoundException('Kaizen idea not found');
    return idea;
  }

  async create(siteId: string, submittedById: string, data: {
    title: string;
    problem: string;
    proposedSolution?: string;
    expectedImpact?: string;
    area?: string;
    photoUrl?: string;
    gembaObservationId?: string;
  }) {
    if (data.expectedImpact && !VALID_IMPACTS.includes(data.expectedImpact)) {
      throw new BadRequestException('Invalid expectedImpact');
    }

    // Validate gemba observation belongs to same site
    if (data.gembaObservationId) {
      const obs = await this.prisma.gembaObservation.findFirst({
        where: { id: data.gembaObservationId, walk: { siteId } },
      });
      if (!obs) throw new BadRequestException('Gemba observation not found or does not belong to this site');
    }

    return this.prisma.kaizenIdea.create({
      data: { siteId, submittedById, ...data },
      include: { submittedBy: { select: { firstName: true, lastName: true } } },
    });
  }

  async update(id: string, siteId: string, data: {
    title?: string;
    problem?: string;
    proposedSolution?: string;
    expectedImpact?: string;
    area?: string;
    result?: string;
    photoUrl?: string;
  }) {
    const idea = await this.prisma.kaizenIdea.findFirst({ where: { id, siteId } });
    if (!idea) throw new NotFoundException('Kaizen idea not found');

    if (data.expectedImpact && !VALID_IMPACTS.includes(data.expectedImpact)) {
      throw new BadRequestException('Invalid expectedImpact');
    }

    return this.prisma.kaizenIdea.update({
      where: { id },
      data,
      include: {
        submittedBy: { select: { firstName: true, lastName: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async changeStatus(id: string, siteId: string, status: string, reviewedById?: string, reviewNotes?: string) {
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const idea = await this.prisma.kaizenIdea.findFirst({ where: { id, siteId } });
    if (!idea) throw new NotFoundException('Kaizen idea not found');

    const data: any = { status };
    if (reviewedById) data.reviewedById = reviewedById;
    if (reviewNotes) data.reviewNotes = reviewNotes;
    if (status === 'completed') data.implementedAt = new Date();

    return this.prisma.kaizenIdea.update({
      where: { id },
      data,
      include: {
        submittedBy: { select: { firstName: true, lastName: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }
}
