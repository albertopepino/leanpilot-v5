import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateKaizenDto } from './dto/create-kaizen.dto';
import { ReviewKaizenDto } from './dto/review-kaizen.dto';

@Injectable()
export class KaizenService {
  constructor(private prisma: PrismaService) {}

  async findAllBySite(siteId: string, status?: string) {
    return this.prisma.kaizenItem.findMany({
      where: { siteId, ...(status ? { status } : {}) },
      include: {
        submittedBy: { select: { firstName: true, lastName: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const item = await this.prisma.kaizenItem.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!item) throw new NotFoundException('Kaizen item not found');
    return item;
  }

  async create(dto: CreateKaizenDto, userId: string, siteId: string) {
    return this.prisma.kaizenItem.create({
      data: {
        title: dto.title,
        problem: dto.problem,
        suggestion: dto.suggestion,
        expectedImpact: dto.expectedImpact || 'medium',
        area: dto.area,
        submittedById: userId,
        siteId,
      },
    });
  }

  async review(id: string, dto: ReviewKaizenDto, reviewerId: string) {
    const item = await this.prisma.kaizenItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Kaizen item not found');

    return this.prisma.kaizenItem.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNotes: dto.reviewNotes,
        reviewedById: reviewerId,
        implementedAt: dto.status === 'completed' ? new Date() : undefined,
      },
    });
  }
}
