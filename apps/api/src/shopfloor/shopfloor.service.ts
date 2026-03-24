import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShopfloorService {
  constructor(private prisma: PrismaService) {}

  /** Verify workstation belongs to caller's site */
  private async verifyWorkstationSite(workstationId: string, siteId: string) {
    const ws = await this.prisma.workstation.findFirst({ where: { id: workstationId, siteId } });
    if (!ws) throw new NotFoundException('Workstation not found or does not belong to your site');
    return ws;
  }

  /** Get POs available for a workstation (phases assigned to this machine) */
  async getAvailablePOs(workstationId: string, siteId: string) {
    await this.verifyWorkstationSite(workstationId, siteId);
    const phases = await this.prisma.productionOrderPhase.findMany({
      where: {
        workstationId,
        status: { not: 'completed' },
        order: { status: { in: ['released', 'in_progress'] } },
      },
      include: {
        order: { select: { poNumber: true, productName: true, targetQuantity: true, unit: true, priority: true, dueDate: true } },
      },
      orderBy: { order: { priority: 'desc' } },
    });

    // Calculate produced quantity per phase from completed runs
    return Promise.all(phases.map(async (phase) => {
      const runs = await this.prisma.productionRun.aggregate({
        where: { phaseId: phase.id },
        _sum: { producedQuantity: true, scrapQuantity: true },
      });
      return {
        phaseId: phase.id,
        sequence: phase.sequence,
        phaseName: phase.name,
        cycleTimeSeconds: phase.cycleTimeSeconds,
        poNumber: phase.order.poNumber,
        productName: phase.order.productName,
        targetQuantity: phase.order.targetQuantity,
        unit: phase.order.unit,
        priority: phase.order.priority,
        dueDate: phase.order.dueDate,
        producedQuantity: runs._sum.producedQuantity || 0,
        scrapQuantity: runs._sum.scrapQuantity || 0,
      };
    }));
  }

  /** Start a production run (operator scans PO) */
  async startRun(phaseId: string, workstationId: string, operatorId: string, siteId: string) {
    await this.verifyWorkstationSite(workstationId, siteId);
    // Check no active run on this workstation
    const activeRun = await this.prisma.productionRun.findFirst({
      where: { workstationId, status: 'active' },
    });
    if (activeRun) {
      throw new BadRequestException('Workstation already has an active production run. Close it first.');
    }

    const phase = await this.prisma.productionOrderPhase.findFirst({
      where: { id: phaseId, order: { siteId } },
      include: { order: true },
    });
    if (!phase) throw new NotFoundException('Phase not found or does not belong to your site');

    // Update phase and order status
    await this.prisma.productionOrderPhase.update({
      where: { id: phaseId },
      data: { status: 'in_progress' },
    });
    if (phase.order.status === 'released') {
      await this.prisma.productionOrder.update({
        where: { id: phase.orderId },
        data: { status: 'in_progress' },
      });
    }

    // Create production run
    const run = await this.prisma.productionRun.create({
      data: {
        phaseId,
        workstationId,
        operatorId,
        shiftDate: new Date().toISOString().split('T')[0],
      },
    });

    // Log po_start event
    await this.prisma.workstationEvent.create({
      data: {
        workstationId,
        productionRunId: run.id,
        operatorId,
        eventType: 'po_start',
        status: 'running',
      },
    });

    return run;
  }

  /** Change workstation status (operator taps button) */
  async changeStatus(workstationId: string, operatorId: string, siteId: string, data: {
    status: string;
    reasonCode?: string;
    notes?: string;
  }) {
    const VALID_STATUSES = ['running', 'breakdown', 'changeover', 'quality_hold', 'idle', 'maintenance', 'planned_stop'];
    if (!VALID_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    await this.verifyWorkstationSite(workstationId, siteId);
    const activeRun = await this.prisma.productionRun.findFirst({
      where: { workstationId, status: 'active' },
    });

    return this.prisma.workstationEvent.create({
      data: {
        workstationId,
        productionRunId: activeRun?.id || null,
        operatorId,
        eventType: 'status_change',
        status: data.status,
        reasonCode: data.reasonCode || null,
        notes: data.notes || null,
      },
    });
  }

  /** Flag (note without status change) */
  async flag(workstationId: string, operatorId: string, siteId: string, notes: string) {
    await this.verifyWorkstationSite(workstationId, siteId);
    const activeRun = await this.prisma.productionRun.findFirst({
      where: { workstationId, status: 'active' },
    });

    return this.prisma.workstationEvent.create({
      data: {
        workstationId,
        productionRunId: activeRun?.id || null,
        operatorId,
        eventType: 'flag',
        notes,
      },
    });
  }

  /** Close production run (end of shift / end of PO) */
  async closeRun(runId: string, operatorId: string, siteId: string, data: {
    producedQuantity: number;
    scrapQuantity: number;
    notes?: string;
  }) {
    const run = await this.prisma.productionRun.findFirst({
      where: { id: runId },
      include: { workstation: { select: { siteId: true } } },
    });
    if (!run) throw new NotFoundException('Production run not found');
    if (run.workstation.siteId !== siteId) throw new NotFoundException('Production run not found');
    if (run.status !== 'active') throw new BadRequestException('Run is not active');

    // Update run
    const updated = await this.prisma.productionRun.update({
      where: { id: runId },
      data: {
        producedQuantity: data.producedQuantity,
        scrapQuantity: data.scrapQuantity,
        endedAt: new Date(),
        status: 'completed',
      },
    });

    // Log po_end event
    await this.prisma.workstationEvent.create({
      data: {
        workstationId: run.workstationId,
        productionRunId: runId,
        operatorId,
        eventType: 'po_end',
        notes: data.notes || null,
      },
    });

    // Set workstation to idle
    await this.prisma.workstationEvent.create({
      data: {
        workstationId: run.workstationId,
        operatorId,
        eventType: 'status_change',
        status: 'idle',
      },
    });

    return updated;
  }

  /** Get active run for a workstation */
  async getActiveRun(workstationId: string, siteId: string) {
    await this.verifyWorkstationSite(workstationId, siteId);
    return this.prisma.productionRun.findFirst({
      where: { workstationId, status: 'active' },
      include: {
        phase: {
          include: { order: { select: { poNumber: true, productName: true, targetQuantity: true, unit: true } } },
        },
        events: { orderBy: { timestamp: 'desc' }, take: 10 },
      },
    });
  }

  /** Get reason codes for a status category */
  async getReasonCodes(siteId: string, category: string) {
    return this.prisma.reasonCode.findMany({
      where: { siteId, category, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
