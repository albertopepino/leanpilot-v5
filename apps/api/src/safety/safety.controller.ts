import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SafetyService } from './safety.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Safety')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('safety')
export class SafetyController {
  constructor(private safety: SafetyService) {}

  @Get('incidents')
  @RequirePermission('safety', 'view')
  @ApiOperation({ summary: 'List safety incidents with filters' })
  async findIncidents(
    @CurrentUser('siteId') siteId: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.safety.findIncidents(siteId, { type, severity, status, dateFrom, dateTo }, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get('incidents/:id')
  @RequirePermission('safety', 'view')
  @ApiOperation({ summary: 'Safety incident detail with attachments' })
  async findIncidentById(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.safety.findIncidentById(id, siteId);
  }

  @Post('incidents')
  @RequirePermission('safety', 'participate')
  @ApiOperation({ summary: 'Report a safety incident' })
  async createIncident(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      workstationId?: string;
      type: string;
      severity?: string;
      outcome?: string;
      date: string;
      time?: string;
      location: string;
      title: string;
      description: string;
      injuredPerson?: string;
      injuryType?: string;
      bodyPart?: string;
      treatmentGiven?: string;
      daysLost?: number;
      potentialSeverity?: string;
      isOshaRecordable?: boolean;
      immediateAction?: string;
      witnessNames?: string;
      photoUrl?: string;
    },
  ) {
    return this.safety.createIncident(siteId, userId, body);
  }

  @Patch('incidents/:id')
  @RequirePermission('safety', 'manage')
  @ApiOperation({ summary: 'Update investigation, status, or details' })
  async updateIncident(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      type?: string;
      severity?: string;
      outcome?: string;
      title?: string;
      description?: string;
      injuredPerson?: string;
      injuryType?: string;
      bodyPart?: string;
      treatmentGiven?: string;
      daysLost?: number;
      potentialSeverity?: string;
      isOshaRecordable?: boolean;
      immediateAction?: string;
      witnessNames?: string;
      status?: string;
      investigatorId?: string;
      investigationDate?: string;
      investigationNotes?: string;
      fiveWhyId?: string;
      ishikawaId?: string;
      eightDReportId?: string;
      photoUrl?: string;
    },
  ) {
    return this.safety.updateIncident(id, siteId, body);
  }

  @Get('metrics')
  @RequirePermission('safety', 'view')
  @ApiOperation({ summary: 'Safety metrics: TRIR, LTIR, days since last incident, near-miss ratio' })
  async getMetrics(@CurrentUser('siteId') siteId: string) {
    return this.safety.getMetrics(siteId);
  }

  @Get('trends')
  @RequirePermission('safety', 'view')
  @ApiOperation({ summary: 'Safety trends: incidents by month, near-miss ratio trend, days since last injury' })
  async getTrends(
    @CurrentUser('siteId') siteId: string,
    @Query('months') months?: string,
  ) {
    return this.safety.getTrends(siteId, months ? parseInt(months, 10) : 12);
  }

  @Post('incidents/:id/attachments')
  @RequirePermission('safety', 'participate')
  @ApiOperation({ summary: 'Upload attachment to safety incident' })
  async addAttachment(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      fileName: string;
      fileUrl: string;
    },
  ) {
    return this.safety.addAttachment(id, siteId, userId, body);
  }
}
