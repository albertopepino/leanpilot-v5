import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_PLAN_TYPES = ['preventive', 'predictive', 'condition_based', 'calibration'];
const VALID_LOG_TYPES = ['preventive', 'corrective', 'emergency'];
const VALID_LOG_STATUSES = ['completed', 'partial', 'deferred'];

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  // ===== PLANS =====

  async findPlans(siteId: string, filters?: { workstationId?: string }) {
    const where: any = { siteId, isActive: true };
    if (filters?.workstationId) {
      where.workstationId = filters.workstationId;
    }

    return this.prisma.maintenancePlan.findMany({
      where,
      include: {
        workstation: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { logs: true } },
      },
      orderBy: { nextDueDate: 'asc' },
    });
  }

  async createPlan(siteId: string, data: {
    workstationId: string;
    name: string;
    type?: string;
    frequencyDays: number;
    frequencyHours?: number;
    estimatedMinutes?: number;
    instructions?: string;
    assignedToId?: string;
    nextDueDate: string;
  }) {
    if (data.type && !VALID_PLAN_TYPES.includes(data.type)) {
      throw new BadRequestException(`Invalid plan type. Must be: ${VALID_PLAN_TYPES.join(', ')}`);
    }

    // Validate workstation belongs to this site
    const ws = await this.prisma.workstation.findFirst({
      where: { id: data.workstationId, siteId },
    });
    if (!ws) throw new BadRequestException('Workstation not found in this site');

    return this.prisma.maintenancePlan.create({
      data: {
        siteId,
        workstationId: data.workstationId,
        name: data.name,
        type: data.type || 'preventive',
        frequencyDays: data.frequencyDays,
        frequencyHours: data.frequencyHours,
        estimatedMinutes: data.estimatedMinutes,
        instructions: data.instructions,
        assignedToId: data.assignedToId,
        nextDueDate: new Date(data.nextDueDate),
      },
      include: {
        workstation: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async updatePlan(id: string, siteId: string, data: {
    name?: string;
    type?: string;
    frequencyDays?: number;
    frequencyHours?: number;
    estimatedMinutes?: number;
    instructions?: string;
    assignedToId?: string;
    nextDueDate?: string;
  }) {
    const plan = await this.prisma.maintenancePlan.findFirst({ where: { id, siteId } });
    if (!plan) throw new NotFoundException('Maintenance plan not found');

    if (data.type && !VALID_PLAN_TYPES.includes(data.type)) {
      throw new BadRequestException(`Invalid plan type. Must be: ${VALID_PLAN_TYPES.join(', ')}`);
    }

    const updateData: any = { ...data };
    if (data.nextDueDate) {
      updateData.nextDueDate = new Date(data.nextDueDate);
    }

    return this.prisma.maintenancePlan.update({
      where: { id },
      data: updateData,
      include: {
        workstation: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async deletePlan(id: string, siteId: string) {
    const plan = await this.prisma.maintenancePlan.findFirst({ where: { id, siteId } });
    if (!plan) throw new NotFoundException('Maintenance plan not found');

    // Soft delete
    return this.prisma.maintenancePlan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ===== LOGS =====

  async findLogs(siteId: string, filters?: { workstationId?: string; type?: string }) {
    const where: any = { siteId };
    if (filters?.workstationId) {
      where.workstationId = filters.workstationId;
    }
    if (filters?.type && VALID_LOG_TYPES.includes(filters.type)) {
      where.type = filters.type;
    }

    return this.prisma.maintenanceLog.findMany({
      where,
      include: {
        workstation: { select: { id: true, name: true } },
        performedBy: { select: { id: true, firstName: true, lastName: true } },
        plan: { select: { id: true, name: true } },
      },
      orderBy: { performedAt: 'desc' },
    });
  }

  async createLog(siteId: string, userId: string, data: {
    workstationId: string;
    planId?: string;
    type: string;
    description: string;
    partsUsed?: string;
    failureCode?: string;
    durationMinutes?: number;
    downtimeMinutes?: number;
    cost?: number;
    status?: string;
  }) {
    if (!VALID_LOG_TYPES.includes(data.type)) {
      throw new BadRequestException(`Invalid log type. Must be: ${VALID_LOG_TYPES.join(', ')}`);
    }
    if (data.status && !VALID_LOG_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status. Must be: ${VALID_LOG_STATUSES.join(', ')}`);
    }

    // Validate workstation belongs to site
    const ws = await this.prisma.workstation.findFirst({
      where: { id: data.workstationId, siteId },
    });
    if (!ws) throw new BadRequestException('Workstation not found in this site');

    // If planId provided, validate it and auto-advance nextDueDate
    if (data.planId) {
      const plan = await this.prisma.maintenancePlan.findFirst({
        where: { id: data.planId, siteId },
      });
      if (!plan) throw new BadRequestException('Maintenance plan not found in this site');

      const now = new Date();
      const nextDue = new Date(now.getTime() + plan.frequencyDays * 24 * 60 * 60 * 1000);

      await this.prisma.maintenancePlan.update({
        where: { id: data.planId },
        data: {
          lastCompletedDate: now,
          nextDueDate: nextDue,
        },
      });
    }

    return this.prisma.maintenanceLog.create({
      data: {
        siteId,
        workstationId: data.workstationId,
        planId: data.planId,
        type: data.type,
        performedById: userId,
        description: data.description,
        partsUsed: data.partsUsed,
        failureCode: data.failureCode,
        durationMinutes: data.durationMinutes,
        downtimeMinutes: data.downtimeMinutes,
        cost: data.cost,
        status: data.status || 'completed',
      },
      include: {
        workstation: { select: { id: true, name: true } },
        performedBy: { select: { id: true, firstName: true, lastName: true } },
        plan: { select: { id: true, name: true } },
      },
    });
  }

  // ===== OVERDUE =====

  async getOverdue(siteId: string) {
    return this.prisma.maintenancePlan.findMany({
      where: {
        siteId,
        isActive: true,
        nextDueDate: { lt: new Date() },
      },
      include: {
        workstation: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { nextDueDate: 'asc' },
    });
  }

  // ===== METRICS (MTBF / MTTR) =====

  async getMetrics(siteId: string, workstationId?: string) {
    const where: any = { siteId, type: 'corrective' };
    if (workstationId) {
      where.workstationId = workstationId;
    }

    const logs = await this.prisma.maintenanceLog.findMany({
      where,
      orderBy: { performedAt: 'asc' },
      select: {
        performedAt: true,
        durationMinutes: true,
        downtimeMinutes: true,
      },
    });

    if (logs.length === 0) {
      return { mtbf: null, mttr: null, totalFailures: 0, avgDowntimeMinutes: null };
    }

    // MTTR: average duration of corrective maintenance
    const durations = logs.filter(l => l.durationMinutes != null).map(l => l.durationMinutes!);
    const mttr = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;

    // MTBF: average time between failures (in hours)
    let mtbf: number | null = null;
    if (logs.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < logs.length; i++) {
        const diff = logs[i].performedAt.getTime() - logs[i - 1].performedAt.getTime();
        intervals.push(diff / (1000 * 60 * 60)); // hours
      }
      mtbf = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }

    // Average downtime
    const downtimes = logs.filter(l => l.downtimeMinutes != null).map(l => l.downtimeMinutes!);
    const avgDowntimeMinutes = downtimes.length > 0
      ? downtimes.reduce((a, b) => a + b, 0) / downtimes.length
      : null;

    return {
      mtbf: mtbf != null ? Math.round(mtbf * 100) / 100 : null,
      mttr: mttr != null ? Math.round(mttr * 100) / 100 : null,
      totalFailures: logs.length,
      avgDowntimeMinutes: avgDowntimeMinutes != null ? Math.round(avgDowntimeMinutes * 100) / 100 : null,
    };
  }

  // ===== CILT =====

  async findCiltChecks(siteId: string, filters?: { workstationId?: string; date?: string }) {
    const where: any = { siteId };
    if (filters?.workstationId) {
      where.workstationId = filters.workstationId;
    }
    if (filters?.date) {
      where.date = filters.date;
    }

    return this.prisma.ciltCheck.findMany({
      where,
      include: {
        workstation: { select: { id: true, name: true } },
        operator: { select: { id: true, firstName: true, lastName: true } },
        maintenanceLog: { select: { id: true, type: true, description: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCiltCheck(siteId: string, userId: string, data: {
    workstationId: string;
    date: string;
    shift?: string;
    cleaningDone?: boolean;
    cleaningNotes?: string;
    inspectionDone?: boolean;
    inspectionNotes?: string;
    lubricationDone?: boolean;
    lubricationNotes?: string;
    tighteningDone?: boolean;
    tighteningNotes?: string;
    abnormalityFound?: boolean;
    abnormalityDescription?: string;
    photoUrl?: string;
    maintenanceLogId?: string;
  }) {
    // Validate workstation belongs to site
    const ws = await this.prisma.workstation.findFirst({
      where: { id: data.workstationId, siteId },
    });
    if (!ws) throw new BadRequestException('Workstation not found in this site');

    return this.prisma.ciltCheck.create({
      data: {
        siteId,
        operatorId: userId,
        workstationId: data.workstationId,
        date: data.date,
        shift: data.shift,
        cleaningDone: data.cleaningDone,
        cleaningNotes: data.cleaningNotes,
        inspectionDone: data.inspectionDone,
        inspectionNotes: data.inspectionNotes,
        lubricationDone: data.lubricationDone,
        lubricationNotes: data.lubricationNotes,
        tighteningDone: data.tighteningDone,
        tighteningNotes: data.tighteningNotes,
        abnormalityFound: data.abnormalityFound,
        abnormalityDescription: data.abnormalityDescription,
        photoUrl: data.photoUrl,
        maintenanceLogId: data.maintenanceLogId,
      },
      include: {
        workstation: { select: { id: true, name: true } },
        operator: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
