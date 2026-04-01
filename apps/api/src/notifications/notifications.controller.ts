import { Controller, Get, Post, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get('count')
  @Roles('operator')
  async getUnreadCount(
    @CurrentUser('id') userId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.notifications.getUnreadCount(userId, siteId);
  }

  @Get()
  @Roles('operator')
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
  @Roles('operator')
  async markRead(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notifications.markRead(id, userId);
  }

  @Post('read-all')
  @Roles('operator')
  async markAllRead(
    @CurrentUser('id') userId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.notifications.markAllRead(userId, siteId);
  }
}
