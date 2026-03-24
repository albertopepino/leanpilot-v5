import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkstationsService {
  constructor(private prisma: PrismaService) {}

  async findAllBySite(siteId: string) {
    const workstations = await this.prisma.workstation.findMany({
      where: { siteId, isActive: true },
      orderBy: { area: 'asc' },
    });

    // Get latest event per workstation for current status
    const withStatus = await Promise.all(
      workstations.map(async (ws) => {
        const lastEvent = await this.prisma.workstationEvent.findFirst({
          where: { workstationId: ws.id, eventType: 'status_change' },
          orderBy: { timestamp: 'desc' },
          select: { status: true, timestamp: true, reasonCode: true, notes: true },
        });
        const activeRun = await this.prisma.productionRun.findFirst({
          where: { workstationId: ws.id, status: 'active' },
          include: {
            phase: { include: { order: { select: { poNumber: true, productName: true } } } },
          },
        });
        return {
          ...ws,
          currentStatus: lastEvent?.status || 'idle',
          statusSince: lastEvent?.timestamp || null,
          currentPO: activeRun ? {
            poNumber: activeRun.phase.order.poNumber,
            productName: activeRun.phase.order.productName,
            phaseName: activeRun.phase.name,
            produced: activeRun.producedQuantity,
          } : null,
        };
      }),
    );

    return withStatus;
  }

  async findById(id: string, siteId: string) {
    const ws = await this.prisma.workstation.findFirst({ where: { id, siteId } });
    if (!ws) throw new NotFoundException('Workstation not found');
    return ws;
  }

  async create(data: { name: string; type?: string; area?: string; code: string; siteId: string }) {
    return this.prisma.workstation.create({ data });
  }

  async update(id: string, siteId: string, data: { name?: string; type?: string; area?: string; isActive?: boolean }) {
    const ws = await this.prisma.workstation.findFirst({ where: { id, siteId } });
    if (!ws) throw new NotFoundException('Workstation not found');
    return this.prisma.workstation.update({ where: { id }, data });
  }
}
