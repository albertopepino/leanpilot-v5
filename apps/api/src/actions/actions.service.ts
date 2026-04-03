import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_STATUSES = ['open', 'in_progress', 'completed', 'overdue', 'cancelled'];
const VALID_CATEGORIES = ['safety', 'quality', 'delivery', 'cost', 'people'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const VALID_SOURCES = ['gemba', 'ncr', 'kaizen', 'safety', 'five_s', 'maintenance', 'tier_meeting', 'manual'];

@Injectable()
export class ActionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(siteId: string, filters: {
    status?: string;
    category?: string;
    assigneeId?: string;
    source?: string;
    overdue?: boolean;
  }, limit = 50, offset = 0) {
    const take = Math.min(Math.max(1, limit), 200);
    const skip = Math.max(0, offset);
    const where: any = { siteId };

    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.source) where.source = filters.source;

    if (filters.overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['completed', 'cancelled'] };
    }

    const [data, total] = await Promise.all([
      this.prisma.action.findMany({
        where,
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { dueDate: 'asc' },
        take,
        skip,
      }),
      this.prisma.action.count({ where }),
    ]);

    return { data, total, limit: take, offset: skip };
  }

  async findById(id: string, siteId: string) {
    const action = await this.prisma.action.findFirst({
      where: { id, siteId },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!action) throw new NotFoundException('Action not found');
    return action;
  }

  async create(siteId: string, createdById: string, data: {
    title: string;
    description?: string;
    category?: string;
    priority?: string;
    source: string;
    sourceId?: string;
    assigneeId: string;
    dueDate: string;
    notes?: string;
    tierLevel?: number;
  }) {
    if (data.category && !VALID_CATEGORIES.includes(data.category)) {
      throw new BadRequestException(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
    if (data.priority && !VALID_PRIORITIES.includes(data.priority)) {
      throw new BadRequestException(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
    if (!VALID_SOURCES.includes(data.source)) {
      throw new BadRequestException(`Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}`);
    }

    // Validate assignee belongs to site
    const assignee = await this.prisma.user.findFirst({
      where: { id: data.assigneeId, siteId },
    });
    if (!assignee) throw new BadRequestException('Assignee not found or does not belong to this site');

    return this.prisma.action.create({
      data: {
        siteId,
        createdById,
        title: data.title,
        description: data.description,
        category: data.category || 'delivery',
        priority: data.priority || 'medium',
        source: data.source,
        sourceId: data.sourceId,
        assigneeId: data.assigneeId,
        dueDate: new Date(data.dueDate),
        notes: data.notes,
        tierLevel: data.tierLevel,
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, siteId: string, data: {
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    assigneeId?: string;
    dueDate?: string;
    notes?: string;
    tierLevel?: number;
  }) {
    const action = await this.prisma.action.findFirst({ where: { id, siteId } });
    if (!action) throw new NotFoundException('Action not found');

    if (data.category && !VALID_CATEGORIES.includes(data.category)) {
      throw new BadRequestException(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
    if (data.priority && !VALID_PRIORITIES.includes(data.priority)) {
      throw new BadRequestException(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }

    if (data.assigneeId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: data.assigneeId, siteId },
      });
      if (!assignee) throw new BadRequestException('Assignee not found or does not belong to this site');
    }

    const updateData: any = { ...data };
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);

    return this.prisma.action.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async changeStatus(id: string, siteId: string, status: string) {
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const action = await this.prisma.action.findFirst({ where: { id, siteId } });
    if (!action) throw new NotFoundException('Action not found');

    const data: any = { status };
    if (status === 'completed') {
      data.completedAt = new Date();
    }

    return this.prisma.action.update({
      where: { id },
      data,
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getSummary(siteId: string) {
    const [byStatus, byCategory, overdueCount] = await Promise.all([
      this.prisma.action.groupBy({
        by: ['status'],
        where: { siteId },
        _count: true,
      }),
      this.prisma.action.groupBy({
        by: ['category'],
        where: { siteId },
        _count: true,
      }),
      this.prisma.action.count({
        where: {
          siteId,
          dueDate: { lt: new Date() },
          status: { notIn: ['completed', 'cancelled'] },
        },
      }),
    ]);

    return {
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      byCategory: byCategory.reduce((acc, c) => ({ ...acc, [c.category]: c._count }), {}),
      overdueCount,
      total: byStatus.reduce((sum, s) => sum + s._count, 0),
    };
  }
}
