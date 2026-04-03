import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GembaService } from './gemba.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Gemba Walk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gemba')
export class GembaController {
  constructor(private gemba: GembaService) {}

  @Get()
  @Roles('manager')
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.gemba.findAllBySite(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get('muda-signals')
  @Roles('viewer')
  async getMudaSignals(@CurrentUser('siteId') siteId: string) {
    return this.gemba.getOpenMudaSignals(siteId);
  }

  @Get(':id')
  @Roles('manager')
  async findById(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.gemba.findById(id, siteId);
  }

  @Post()
  @Roles('manager')
  async startWalk(@CurrentUser('siteId') siteId: string, @CurrentUser('id') userId: string) {
    return this.gemba.startWalk(siteId, userId);
  }

  @Patch(':id/complete')
  @Roles('manager')
  async completeWalk(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.gemba.completeWalk(id, siteId);
  }

  @Post(':id/observations')
  @Roles('manager')
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
  @Roles('manager')
  async updateObservationStatus(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { status: string },
  ) {
    return this.gemba.updateObservationStatus(id, siteId, body.status);
  }

  @Patch('observations/:id/pdca')
  @Roles('operator')
  async updateObservationPdca(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { actionRequired?: string; assignedToId?: string; dueDate?: string; completedAt?: string },
  ) {
    return this.gemba.updateObservationPdca(id, siteId, body);
  }
}
