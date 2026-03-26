import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('overview')
  @Roles('viewer')
  async getOverview(@CurrentUser('siteId') siteId: string) {
    return this.dashboard.getOverview(siteId);
  }

  @Get('oee')
  @Roles('viewer')
  async getOee(
    @CurrentUser('siteId') siteId: string,
    @Query('workstationId') workstationId?: string,
    @Query('period') period?: string,
  ) {
    return this.dashboard.getOee(siteId, workstationId, period || 'week');
  }

  @Get('shift-handover')
  @Roles('viewer')
  async getShiftHandover(
    @CurrentUser('siteId') siteId: string,
    @Query('hours') hours?: string,
  ) {
    return this.dashboard.getShiftHandover(siteId, hours ? parseInt(hours, 10) : 8);
  }

  @Get('pareto')
  @Roles('viewer')
  async getPareto(
    @CurrentUser('siteId') siteId: string,
    @Query('period') period?: string,
  ) {
    return this.dashboard.getPareto(siteId, period || 'week');
  }
}
