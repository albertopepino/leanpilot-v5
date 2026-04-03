import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GembaService } from './gemba.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Gemba Walk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('gemba')
export class GembaController {
  constructor(private gemba: GembaService) {}

  @Get()
  @RequirePermission('continuous_improvement', 'view')
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.gemba.findAllBySite(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get('waste-pareto')
  @RequirePermission('continuous_improvement', 'view')
  async getWastePareto(
    @CurrentUser('siteId') siteId: string,
    @Query('months') months?: string,
  ) {
    return this.gemba.getWastePareto(siteId, months ? parseInt(months, 10) : 3);
  }

  @Get('muda-signals')
  @RequirePermission('continuous_improvement', 'view')
  async getMudaSignals(@CurrentUser('siteId') siteId: string) {
    return this.gemba.getOpenMudaSignals(siteId);
  }

  @Get(':id')
  @RequirePermission('continuous_improvement', 'view')
  async findById(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.gemba.findById(id, siteId);
  }

  @Post()
  @RequirePermission('continuous_improvement', 'manage')
  async startWalk(@CurrentUser('siteId') siteId: string, @CurrentUser('id') userId: string) {
    return this.gemba.startWalk(siteId, userId);
  }

  @Patch(':id/complete')
  @RequirePermission('continuous_improvement', 'manage')
  async completeWalk(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.gemba.completeWalk(id, siteId);
  }

  @Post(':id/observations')
  @RequirePermission('continuous_improvement', 'manage')
  async addObservation(
    @Param('id') walkId: string,
    @CurrentUser('id') observerId: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      workstationId?: string;
      wasteCategory: string;
      severity?: string;
      description: string;
      photoUrl?: string;
      operatorQuote?: string;
    },
  ) {
    return this.gemba.addObservation(walkId, siteId, observerId, body);
  }

  @Patch('observations/:id/status')
  @RequirePermission('continuous_improvement', 'manage')
  async updateObservationStatus(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { status: string },
  ) {
    return this.gemba.updateObservationStatus(id, siteId, body.status);
  }

  @Patch('observations/:id/pdca')
  @RequirePermission('continuous_improvement', 'participate')
  async updateObservationPdca(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { actionRequired?: string; assignedToId?: string; dueDate?: string; completedAt?: string },
  ) {
    return this.gemba.updateObservationPdca(id, siteId, body);
  }
}
