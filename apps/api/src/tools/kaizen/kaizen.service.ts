import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const VALID_STATUSES = ['submitted', 'under_review', 'approved', 'in_progress', 'completed', 'rejected'];
const VALID_IMPACTS = ['low', 'medium', 'high'];

// Server-side state machine — only these transitions are allowed
const NEXT_STATUS: Record<string, string[]> = {
  submitted: ['under_review', 'rejected'],
  under_review: ['submitted', 'approved', 'rejected'],
  approved: ['under_review', 'in_progress', 'rejected'],
  in_progress: ['approved', 'completed'],
  completed: ['in_progress'],
  rejected: ['submitted'],
};

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
    expectedSavings?: number;
    actualSavings?: number;
    costToImplement?: number;
    savingsType?: string;
    gembaObservationId?: string;
  }) {
    if (data.expectedImpact && !VALID_IMPACTS.includes(data.expectedImpact)) {
      throw new BadRequestException('Invalid expectedImpact');
    }
    // Validate savings are non-negative
    if (data.expectedSavings !== undefined && data.expectedSavings < 0) throw new BadRequestException('expectedSavings must be non-negative');
    if (data.costToImplement !== undefined && data.costToImplement < 0) throw new BadRequestException('costToImplement must be non-negative');
    // Strip actualSavings on create — can only be set when completing
    delete data.actualSavings;

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
    expectedSavings?: number;
    actualSavings?: number;
    costToImplement?: number;
    savingsType?: string;
  }) {
    const idea = await this.prisma.kaizenIdea.findFirst({ where: { id, siteId } });
    if (!idea) throw new NotFoundException('Kaizen idea not found');

    if (data.expectedImpact && !VALID_IMPACTS.includes(data.expectedImpact)) {
      throw new BadRequestException('Invalid expectedImpact');
    }
    // Validate savings are non-negative
    if (data.expectedSavings !== undefined && data.expectedSavings < 0) throw new BadRequestException('expectedSavings must be non-negative');
    if (data.costToImplement !== undefined && data.costToImplement < 0) throw new BadRequestException('costToImplement must be non-negative');
    if (data.actualSavings !== undefined && data.actualSavings < 0) throw new BadRequestException('actualSavings must be non-negative');
    // actualSavings only writable on completed ideas
    if (data.actualSavings !== undefined && idea.status !== 'completed') {
      delete data.actualSavings;
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

  async changeStatus(id: string, siteId: string, status: string, reviewedById?: string, reviewNotes?: string, actualSavings?: number, costToImplement?: number) {
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const idea = await this.prisma.kaizenIdea.findFirst({ where: { id, siteId } });
    if (!idea) throw new NotFoundException('Kaizen idea not found');

    // Validate state transition
    const allowed = NEXT_STATUS[idea.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot transition from "${idea.status}" to "${status}". Allowed: ${allowed.join(', ') || 'none'}`);
    }

    // Validate savings are non-negative
    if (actualSavings !== undefined && actualSavings < 0) throw new BadRequestException('actualSavings must be non-negative');
    if (costToImplement !== undefined && costToImplement < 0) throw new BadRequestException('costToImplement must be non-negative');

    const data: any = { status };
    if (reviewedById) data.reviewedById = reviewedById;
    if (reviewNotes) data.reviewNotes = reviewNotes;
    if (status === 'completed') data.implementedAt = new Date();
    if (actualSavings !== undefined) data.actualSavings = actualSavings;
    if (costToImplement !== undefined) data.costToImplement = costToImplement;

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
