import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findForUser(userId: string, siteId: string, filters: {
    unreadOnly?: boolean;
    limit?: number;
  }) {
    const where: any = { userId, siteId };
    if (filters.unreadOnly) where.isRead = false;

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
    });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string, siteId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, siteId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }

  async getUnreadCount(userId: string, siteId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, siteId, isRead: false },
    });
    return { count };
  }

  async create(siteId: string, userId: string, data: {
    type: string;
    title: string;
    message: string;
    sourceType?: string;
    sourceId?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        siteId,
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
      },
    });
  }
}
