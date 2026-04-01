import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TierMeetingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(siteId: string, filters: {
    tier?: number;
    date?: string;
    status?: string;
  }) {
    const where: any = { siteId };
    if (filters.tier) where.tier = filters.tier;
    if (filters.date) where.date = filters.date;
    if (filters.status) where.status = filters.status;

    return this.prisma.tierMeeting.findMany({
      where,
      include: {
        leader: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, siteId: string) {
    const meeting = await this.prisma.tierMeeting.findFirst({
      where: { id, siteId },
      include: {
        leader: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
    });
    if (!meeting) throw new NotFoundException('Tier meeting not found');
    return meeting;
  }

  async create(siteId: string, leaderId: string, data: {
    tier: number;
    date: string;
    shift?: string;
    attendees?: string;
    notes?: string;
  }) {
    if (data.tier < 1 || data.tier > 3) {
      throw new BadRequestException('Tier must be 1, 2, or 3');
    }

    return this.prisma.tierMeeting.create({
      data: {
        siteId,
        leaderId,
        tier: data.tier,
        date: data.date,
        shift: data.shift,
        attendees: data.attendees,
        notes: data.notes,
      },
      include: {
        leader: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
    });
  }

  async complete(id: string, siteId: string) {
    const meeting = await this.prisma.tierMeeting.findFirst({ where: { id, siteId } });
    if (!meeting) throw new NotFoundException('Tier meeting not found');

    return this.prisma.tierMeeting.update({
      where: { id },
      data: { status: 'completed', endedAt: new Date() },
      include: {
        leader: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
    });
  }

  async addItem(meetingId: string, siteId: string, data: {
    category: string;
    status?: string;
    metric?: string;
    value?: string;
    target?: string;
    comment?: string;
  }) {
    const meeting = await this.prisma.tierMeeting.findFirst({ where: { id: meetingId, siteId } });
    if (!meeting) throw new NotFoundException('Tier meeting not found');

    return this.prisma.tierMeetingItem.create({
      data: {
        meetingId,
        category: data.category,
        status: data.status || 'green',
        metric: data.metric,
        value: data.value,
        target: data.target,
        comment: data.comment,
      },
    });
  }

  async updateItem(meetingId: string, itemId: string, siteId: string, createdById: string, data: {
    status?: string;
    metric?: string;
    value?: string;
    target?: string;
    comment?: string;
    escalated?: boolean;
    escalateTitle?: string;
    escalateAssigneeId?: string;
    escalateDueDate?: string;
  }) {
    const meeting = await this.prisma.tierMeeting.findFirst({ where: { id: meetingId, siteId } });
    if (!meeting) throw new NotFoundException('Tier meeting not found');

    const item = await this.prisma.tierMeetingItem.findFirst({
      where: { id: itemId, meetingId },
    });
    if (!item) throw new NotFoundException('Tier meeting item not found');

    let actionId = item.actionId;

    // Auto-create action when escalating
    if (data.escalated && !item.escalated) {
      if (!data.escalateTitle || !data.escalateAssigneeId || !data.escalateDueDate) {
        throw new BadRequestException('Escalation requires escalateTitle, escalateAssigneeId, and escalateDueDate');
      }

      const action = await this.prisma.action.create({
        data: {
          siteId,
          title: data.escalateTitle,
          source: 'tier_meeting',
          sourceId: meetingId,
          assigneeId: data.escalateAssigneeId,
          createdById,
          dueDate: new Date(data.escalateDueDate),
          category: data.status ? item.category : item.category,
          tierLevel: meeting.tier,
          escalatedAt: new Date(),
        },
      });
      actionId = action.id;
    }

    return this.prisma.tierMeetingItem.update({
      where: { id: itemId },
      data: {
        status: data.status,
        metric: data.metric,
        value: data.value,
        target: data.target,
        comment: data.comment,
        escalated: data.escalated ?? item.escalated,
        actionId,
      },
    });
  }
}
