import { Controller, Get, Post, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get('count')
  async getUnreadCount(
    @CurrentUser('id') userId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.notifications.getUnreadCount(userId, siteId);
  }

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('siteId') siteId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.findForUser(userId, siteId, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Patch(':id/read')
  async markRead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notifications.markRead(id, userId);
  }

  @Post('read-all')
  async markAllRead(
    @CurrentUser('id') userId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.notifications.markAllRead(userId, siteId);
  }
}
