import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CAPA_STATUSES = ['open', 'in_progress', 'implemented', 'verification', 'effective', 'closed', 'ineffective'];

@Injectable()
export class CapaService {
  constructor(private prisma: PrismaService) {}

  async findAllBySite(
    siteId: string,
    limit = 50,
    offset = 0,
    filters?: { status?: string; ncrId?: string; assigneeId?: string },
  ) {
    const take = Math.min(Math.max(1, limit), 200);
    const skip = Math.max(0, offset);
    const where: any = { siteId };

    if (filters?.status) where.status = filters.status;
    if (filters?.ncrId) where.ncrId = filters.ncrId;
    if (filters?.assigneeId) where.assigneeId = filters.assigneeId;

    const [data, total] = await Promise.all([
      this.prisma.correctiveAction.findMany({
        where,
        include: {
          ncr: { select: { id: true, title: true, severity: true, status: true } },
          assignee: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          verifiedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.correctiveAction.count({ where }),
    ]);

    return { data, total, limit: take, offset: skip };
  }

  async findById(id: string, siteId: string) {
    const capa = await this.prisma.correctiveAction.findFirst({
      where: { id, siteId },
      include: {
        ncr: { select: { id: true, title: true, severity: true, status: true, description: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!capa) throw new NotFoundException('CAPA not found');
    return capa;
  }

  async create(
    siteId: string,
    createdById: string,
    data: {
      ncrId?: string;
      incidentId?: string;
      type: string;
      title: string;
      description: string;
      assigneeId: string;
      dueDate: string;
      priority?: string;
      rootCause?: string;
    },
  ) {
    // Validate type
    if (!['corrective', 'preventive'].includes(data.type)) {
      throw new BadRequestException('Type must be "corrective" or "preventive"');
    }

    // Corrective actions require an NCR or incident
    if (data.type === 'corrective' && !data.ncrId && !data.incidentId) {
      throw new BadRequestException('Corrective actions require an NCR or incident reference');
    }

    // Validate priority if provided
    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) {
      throw new BadRequestException('Priority must be low, medium, high, or critical');
    }

    // Validate ncrId belongs to site
    if (data.ncrId) {
      const ncr = await this.prisma.nonConformanceReport.findFirst({
        where: { id: data.ncrId, siteId },
      });
      if (!ncr) throw new BadRequestException('NCR not found in this site');
    }

    // Auto-generate capaNumber: CAPA-{year}-{seq:03d}
    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const count = await this.prisma.correctiveAction.count({
      where: {
        siteId,
        createdAt: { gte: yearStart, lt: yearEnd },
      },
    });
    const seq = count + 1;
    const capaNumber = `CAPA-${year}-${String(seq).padStart(3, '0')}`;

    return this.prisma.correctiveAction.create({
      data: {
        siteId,
        createdById,
        capaNumber,
        ncrId: data.ncrId,
        incidentId: data.incidentId,
        type: data.type,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        dueDate: new Date(data.dueDate),
        priority: data.priority || 'medium',
        rootCause: data.rootCause,
      },
      include: {
        ncr: { select: { id: true, title: true, severity: true, status: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(
    id: string,
    siteId: string,
    data: {
      title?: string;
      description?: string;
      assigneeId?: string;
      dueDate?: string;
      priority?: string;
      status?: string;
      rootCause?: string;
      actionTaken?: string;
      verificationMethod?: string;
      verificationDate?: string;
      verifiedById?: string;
      effectivenessCheck?: string;
      effectivenessDate?: string;
      effectiveResult?: string;
    },
  ) {
    const capa = await this.prisma.correctiveAction.findFirst({ where: { id, siteId } });
    if (!capa) throw new NotFoundException('CAPA not found');

    // Closed/effective CAPAs are immutable quality records
    if (capa.status === 'closed' || capa.status === 'effective') {
      throw new BadRequestException('Cannot modify a closed or effective CAPA — create a new CAPA referencing the original instead');
    }

    if (data.status && !CAPA_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${CAPA_STATUSES.join(', ')}`);
    }

    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) {
      throw new BadRequestException('Priority must be low, medium, high, or critical');
    }

    if (data.effectiveResult && !['effective', 'ineffective', 'partial'].includes(data.effectiveResult)) {
      throw new BadRequestException('Effective result must be effective, ineffective, or partial');
    }

    const updateData: any = { ...data };

    // Convert date strings to Date objects
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
    if (data.verificationDate) updateData.verificationDate = new Date(data.verificationDate);
    if (data.effectivenessDate) updateData.effectivenessDate = new Date(data.effectivenessDate);

    // Auto-set timestamps based on status transitions
    if (data.status === 'implemented' && !capa.implementedAt) {
      updateData.implementedAt = new Date();
    }
    if ((data.status === 'closed' || data.status === 'effective') && !capa.closedAt) {
      updateData.closedAt = new Date();
    }

    return this.prisma.correctiveAction.update({
      where: { id },
      data: updateData,
      include: {
        ncr: { select: { id: true, title: true, severity: true, status: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getSummary(siteId: string) {
    const [byStatus, overdue, total, effective, ineffective] = await Promise.all([
      this.prisma.correctiveAction.groupBy({
        by: ['status'],
        where: { siteId },
        _count: { id: true },
      }),
      this.prisma.correctiveAction.count({
        where: {
          siteId,
          dueDate: { lt: new Date() },
          status: { notIn: ['closed', 'effective', 'ineffective'] },
        },
      }),
      this.prisma.correctiveAction.count({ where: { siteId } }),
      this.prisma.correctiveAction.count({
        where: { siteId, effectiveResult: 'effective' },
      }),
      this.prisma.correctiveAction.count({
        where: { siteId, effectiveResult: { in: ['effective', 'ineffective', 'partial'] } },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[row.status] = row._count.id;
    }

    return {
      total,
      byStatus: statusCounts,
      overdue,
      effectivenessRate: ineffective > 0
        ? Math.round((effective / ineffective) * 10000) / 100
        : null,
    };
  }
}
