import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ActionsService } from './actions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Action Tracker')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('actions')
export class ActionsController {
  constructor(private actions: ActionsService) {}

  @Get('summary')
  @Roles('viewer')
  async getSummary(@CurrentUser('siteId') siteId: string) {
    return this.actions.getSummary(siteId);
  }

  @Get()
  @Roles('viewer')
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('source') source?: string,
    @Query('overdue') overdue?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.actions.findAll(siteId, {
      status,
      category,
      assigneeId,
      source,
      overdue: overdue === 'true',
    }, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get(':id')
  @Roles('viewer')
  async findOne(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.actions.findById(id, siteId);
  }

  @Post()
  @Roles('manager')
  async create(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
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
    },
  ) {
    return this.actions.create(siteId, userId, body);
  }

  @Patch(':id')
  @Roles('operator')
  async update(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      title?: string;
      description?: string;
      category?: string;
      priority?: string;
      assigneeId?: string;
      dueDate?: string;
      notes?: string;
      tierLevel?: number;
    },
  ) {
    return this.actions.update(id, siteId, body);
  }

  @Patch(':id/status')
  @Roles('operator')
  async changeStatus(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { status: string },
  ) {
    return this.actions.changeStatus(id, siteId, body.status);
  }
}
