import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GembaService {
  constructor(private prisma: PrismaService) {}

  async findAllBySite(siteId: string) {
    return this.prisma.gembaWalk.findMany({
      where: { siteId },
      include: {
        walker: { select: { firstName: true, lastName: true } },
        _count: { select: { observations: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findById(id: string, siteId: string) {
    const walk = await this.prisma.gembaWalk.findFirst({
      where: { id, siteId },
      include: {
        walker: { select: { firstName: true, lastName: true } },
        observations: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!walk) throw new NotFoundException('Gemba walk not found');
    return walk;
  }

  async startWalk(siteId: string, walkerId: string) {
    return this.prisma.gembaWalk.create({
      data: {
        siteId,
        walkerId,
        date: new Date().toISOString().split('T')[0],
      },
    });
  }

  async completeWalk(id: string, siteId: string) {
    const walk = await this.prisma.gembaWalk.findFirst({ where: { id, siteId } });
    if (!walk) throw new NotFoundException('Gemba walk not found');
    return this.prisma.gembaWalk.update({
      where: { id },
      data: { status: 'completed', endedAt: new Date() },
    });
  }

  async addObservation(walkId: string, siteId: string, observerId: string, data: {
    workstationId?: string;
    wasteCategory: string;
    severity?: string;
    description: string;
    photoUrl?: string;
    operatorQuote?: string;
  }) {
    // Verify walk belongs to caller's site
    const walk = await this.prisma.gembaWalk.findFirst({ where: { id: walkId, siteId } });
    if (!walk) throw new NotFoundException('Gemba walk not found');
    return this.prisma.gembaObservation.create({
      data: {
        walkId,
        observerId,
        workstationId: data.workstationId || null,
        wasteCategory: data.wasteCategory,
        severity: data.severity || 'medium',
        description: data.description,
        photoUrl: data.photoUrl || null,
        operatorQuote: data.operatorQuote || null,
      },
    });
  }

  async updateObservationStatus(id: string, siteId: string, status: string) {
    const obs = await this.prisma.gembaObservation.findFirst({
      where: { id, walk: { siteId } },
    });
    if (!obs) throw new NotFoundException('Observation not found');
    return this.prisma.gembaObservation.update({
      where: { id },
      data: { status },
    });
  }

  /** Get open muda signals for overview */
  async getOpenMudaSignals(siteId: string) {
    return this.prisma.gembaObservation.findMany({
      where: {
        walk: { siteId },
        status: { in: ['open', 'investigating'] },
      },
      include: {
        walk: { select: { date: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
