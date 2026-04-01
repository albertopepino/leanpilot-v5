import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SmedService } from './smed.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('SMED Changeover Analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('smed')
export class SmedController {
  constructor(private smed: SmedService) {}

  @Get()
  @Roles('operator')
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('workstationId') workstationId?: string,
    @Query('status') status?: string,
  ) {
    return this.smed.findAll(siteId, { workstationId, status });
  }

  @Get(':id')
  @Roles('operator')
  async findOne(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.smed.findById(id, siteId);
  }

  @Post()
  @Roles('operator')
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
  @Roles('operator')
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
  @Roles('operator')
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
  @Roles('operator')
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
  @Roles('operator')
  async removeActivity(
    @Param('id') analysisId: string,
    @Param('actId') activityId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.smed.removeActivity(analysisId, activityId, siteId);
  }
}
