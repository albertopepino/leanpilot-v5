import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TierMeetingsService } from './tier-meetings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Tier Meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tier-meetings')
export class TierMeetingsController {
  constructor(private tierMeetings: TierMeetingsService) {}

  @Get()
  @Roles('operator')
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('tier') tier?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    return this.tierMeetings.findAll(siteId, {
      tier: tier ? parseInt(tier, 10) : undefined,
      date,
      status,
    });
  }

  @Get(':id')
  @Roles('operator')
  async findOne(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.tierMeetings.findById(id, siteId);
  }

  @Post()
  @Roles('manager')
  async create(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      tier: number;
      date: string;
      shift?: string;
      attendees?: string;
      notes?: string;
    },
  ) {
    return this.tierMeetings.create(siteId, userId, body);
  }

  @Patch(':id/complete')
  @Roles('manager')
  async complete(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.tierMeetings.complete(id, siteId);
  }

  @Post(':id/items')
  @Roles('manager')
  async addItem(
    @Param('id') meetingId: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      category: string;
      status?: string;
      metric?: string;
      value?: string;
      target?: string;
      comment?: string;
    },
  ) {
    return this.tierMeetings.addItem(meetingId, siteId, body);
  }

  @Patch(':id/items/:itemId')
  @Roles('manager')
  async updateItem(
    @Param('id') meetingId: string,
    @Param('itemId') itemId: string,
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      status?: string;
      metric?: string;
      value?: string;
      target?: string;
      comment?: string;
      escalated?: boolean;
      escalateTitle?: string;
      escalateAssigneeId?: string;
      escalateDueDate?: string;
    },
  ) {
    return this.tierMeetings.updateItem(meetingId, itemId, siteId, userId, body);
  }
}
