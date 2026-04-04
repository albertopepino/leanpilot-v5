import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private dashboard: DashboardService,
    private prisma: PrismaService,
  ) {}

  @Get('overview')
  async getOverview(@CurrentUser('siteId') siteId: string) {
    return this.dashboard.getOverview(siteId);
  }

  @Get('oee-trend')
  async getOeeTrend(
    @CurrentUser('siteId') siteId: string,
    @Query('workstationId') workstationId?: string,
    @Query('period') period?: string,
    @Query('granularity') granularity?: string,
  ) {
    return this.dashboard.getOeeTrend(
      siteId,
      workstationId,
      period || '30d',
      (granularity === 'week' ? 'week' : 'day') as 'day' | 'week',
    );
  }

  @Get('oee')
  async getOee(
    @CurrentUser('siteId') siteId: string,
    @Query('workstationId') workstationId?: string,
    @Query('period') period?: string,
  ) {
    return this.dashboard.getOee(siteId, workstationId, period || 'week');
  }

  @Get('shift-handover')
  async getShiftHandover(
    @CurrentUser('siteId') siteId: string,
    @Query('hours') hours?: string,
  ) {
    return this.dashboard.getShiftHandover(siteId, hours ? parseInt(hours, 10) : 8);
  }

  @Get('pareto')
  async getPareto(
    @CurrentUser('siteId') siteId: string,
    @Query('period') period?: string,
  ) {
    return this.dashboard.getPareto(siteId, period || 'week');
  }

  @Get('layout')
  async getLayout(@CurrentUser('id') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dashboardLayout: true },
    });
    return {
      layout: user?.dashboardLayout
        ? JSON.parse(user.dashboardLayout)
        : null,
    };
  }

  @Patch('layout')
  async saveLayout(
    @CurrentUser('id') userId: string,
    @Body() body: { layout: any },
  ) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { dashboardLayout: JSON.stringify(body.layout) },
    });
    return { saved: true };
  }
}
