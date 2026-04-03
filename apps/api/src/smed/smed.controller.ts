import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SmedService } from './smed.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('SMED Changeover Analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('smed')
export class SmedController {
  constructor(private smed: SmedService) {}

  @Get()
  @RequirePermission('problem_solving', 'view')
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('workstationId') workstationId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.smed.findAll(siteId, { workstationId, status }, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get(':id')
  @RequirePermission('problem_solving', 'view')
  async findOne(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.smed.findById(id, siteId);
  }

  @Post()
  @RequirePermission('problem_solving', 'participate')
  async create(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      workstationId: string;
      title: string;
      productFrom?: string;
      productTo?: string;
      baselineMinutes?: number;
      targetMinutes?: number;
      notes?: string;
    },
  ) {
    return this.smed.create(siteId, userId, body);
  }

  @Patch(':id')
  @RequirePermission('problem_solving', 'participate')
  async update(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      title?: string;
      productFrom?: string;
      productTo?: string;
      status?: string;
      baselineMinutes?: number;
      targetMinutes?: number;
      actualMinutes?: number;
      notes?: string;
    },
  ) {
    return this.smed.update(id, siteId, body);
  }

  @Post(':id/activities')
  @RequirePermission('problem_solving', 'participate')
  async addActivity(
    @Param('id') analysisId: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      sequence: number;
      description: string;
      type?: string;
      durationSeconds: number;
      canConvert?: boolean;
      improvement?: string;
    },
  ) {
    return this.smed.addActivity(analysisId, siteId, body);
  }

  @Patch(':id/activities/:actId')
  @RequirePermission('problem_solving', 'participate')
  async updateActivity(
    @Param('id') analysisId: string,
    @Param('actId') activityId: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      sequence?: number;
      description?: string;
      type?: string;
      durationSeconds?: number;
      canConvert?: boolean;
      convertedTo?: string;
      improvement?: string;
    },
  ) {
    return this.smed.updateActivity(analysisId, activityId, siteId, body);
  }

  @Delete(':id/activities/:actId')
  @RequirePermission('problem_solving', 'participate')
  async removeActivity(
    @Param('id') analysisId: string,
    @Param('actId') activityId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.smed.removeActivity(analysisId, activityId, siteId);
  }
}
