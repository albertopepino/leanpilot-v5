import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private maintenance: MaintenanceService) {}

  // ===== PLANS =====

  @Get('plans')
  @Roles('viewer')
  @ApiOperation({ summary: 'List maintenance plans for a workstation' })
  async findPlans(
    @CurrentUser('siteId') siteId: string,
    @Query('workstationId') workstationId?: string,
  ) {
    return this.maintenance.findPlans(siteId, { workstationId });
  }

  @Post('plans')
  @Roles('manager')
  @ApiOperation({ summary: 'Create a maintenance plan' })
  async createPlan(
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      workstationId: string;
      name: string;
      type?: string;
      frequencyDays: number;
      frequencyHours?: number;
      estimatedMinutes?: number;
      instructions?: string;
      assignedToId?: string;
      nextDueDate: string;
    },
  ) {
    return this.maintenance.createPlan(siteId, body);
  }

  @Patch('plans/:id')
  @Roles('manager')
  @ApiOperation({ summary: 'Update a maintenance plan' })
  async updatePlan(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      name?: string;
      type?: string;
      frequencyDays?: number;
      frequencyHours?: number;
      estimatedMinutes?: number;
      instructions?: string;
      assignedToId?: string;
      nextDueDate?: string;
    },
  ) {
    return this.maintenance.updatePlan(id, siteId, body);
  }

  @Delete('plans/:id')
  @Roles('manager')
  @ApiOperation({ summary: 'Soft-delete a maintenance plan' })
  async deletePlan(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.maintenance.deletePlan(id, siteId);
  }

  // ===== LOGS =====

  @Get('logs')
  @Roles('viewer')
  @ApiOperation({ summary: 'List maintenance logs' })
  async findLogs(
    @CurrentUser('siteId') siteId: string,
    @Query('workstationId') workstationId?: string,
    @Query('type') type?: string,
  ) {
    return this.maintenance.findLogs(siteId, { workstationId, type });
  }

  @Post('logs')
  @Roles('operator')
  @ApiOperation({ summary: 'Log maintenance work (auto-advances plan nextDueDate)' })
  async createLog(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      workstationId: string;
      planId?: string;
      type: string;
      description: string;
      partsUsed?: string;
      failureCode?: string;
      durationMinutes?: number;
      downtimeMinutes?: number;
      cost?: number;
      status?: string;
    },
  ) {
    return this.maintenance.createLog(siteId, userId, body);
  }

  // ===== OVERDUE =====

  @Get('overdue')
  @Roles('viewer')
  @ApiOperation({ summary: 'List overdue maintenance plans' })
  async getOverdue(@CurrentUser('siteId') siteId: string) {
    return this.maintenance.getOverdue(siteId);
  }

  // ===== METRICS =====

  @Get('metrics')
  @Roles('viewer')
  @ApiOperation({ summary: 'Compute MTBF and MTTR from corrective logs' })
  async getMetrics(
    @CurrentUser('siteId') siteId: string,
    @Query('workstationId') workstationId?: string,
  ) {
    return this.maintenance.getMetrics(siteId, workstationId);
  }

  // ===== CILT =====

  @Get('cilt')
  @Roles('viewer')
  @ApiOperation({ summary: 'List CILT checks' })
  async findCiltChecks(
    @CurrentUser('siteId') siteId: string,
    @Query('workstationId') workstationId?: string,
    @Query('date') date?: string,
  ) {
    return this.maintenance.findCiltChecks(siteId, { workstationId, date });
  }

  @Post('cilt')
  @Roles('operator')
  @ApiOperation({ summary: 'Submit a CILT check' })
  async createCiltCheck(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      workstationId: string;
      date: string;
      shift?: string;
      cleaningDone?: boolean;
      cleaningNotes?: string;
      inspectionDone?: boolean;
      inspectionNotes?: string;
      lubricationDone?: boolean;
      lubricationNotes?: string;
      tighteningDone?: boolean;
      tighteningNotes?: string;
      abnormalityFound?: boolean;
      abnormalityDescription?: string;
      photoUrl?: string;
      maintenanceLogId?: string;
    },
  ) {
    return this.maintenance.createCiltCheck(siteId, userId, body);
  }
}
