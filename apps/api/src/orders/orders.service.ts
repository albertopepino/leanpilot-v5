import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async findAllBySite(siteId: string) {
    return this.prisma.productionOrder.findMany({
      where: { siteId },
      include: {
        phases: {
          include: { workstation: { select: { name: true, code: true } } },
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, siteId: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id, siteId },
      include: {
        phases: {
          include: {
            workstation: { select: { name: true, code: true } },
            runs: {
              include: { operator: { select: { firstName: true, lastName: true } } },
              orderBy: { startedAt: 'desc' },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(siteId: string, data: {
    poNumber: string;
    productName: string;
    targetQuantity: number;
    unit?: string;
    dueDate?: string;
    priority?: string;
    phases?: { sequence: number; name: string; workstationId: string; cycleTimeSeconds: number }[];
  }) {
    // Validate all workstationIds belong to this site
    if (data.phases?.length) {
      const wsIds = [...new Set(data.phases.map(p => p.workstationId))];
      const valid = await this.prisma.workstation.findMany({
        where: { id: { in: wsIds }, siteId },
        select: { id: true },
      });
      const validIds = new Set(valid.map(w => w.id));
      for (const p of data.phases) {
        if (!validIds.has(p.workstationId)) {
          throw new BadRequestException(`Workstation ${p.workstationId} does not belong to this site`);
        }
      }
    }

    return this.prisma.productionOrder.create({
      data: {
        siteId,
        poNumber: data.poNumber,
        productName: data.productName,
        targetQuantity: data.targetQuantity,
        unit: data.unit || 'pcs',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority || 'normal',
        phases: data.phases ? {
          create: data.phases.map(p => ({
            sequence: p.sequence,
            name: p.name,
            workstationId: p.workstationId,
            cycleTimeSeconds: p.cycleTimeSeconds,
          })),
        } : undefined,
      },
      include: { phases: true },
    });
  }
}
