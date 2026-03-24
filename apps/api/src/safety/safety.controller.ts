import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SafetyService } from './safety.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Safety')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('safety')
export class SafetyController {
  constructor(private safety: SafetyService) {}

  @Get('incidents')
  @Roles('viewer')
  @ApiOperation({ summary: 'List safety incidents with filters' })
  async findIncidents(
    @CurrentUser('siteId') siteId: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.safety.findIncidents(siteId, { type, severity, status, dateFrom, dateTo });
  }

  @Get('incidents/:id')
  @Roles('viewer')
  @ApiOperation({ summary: 'Safety incident detail with attachments' })
  async findIncidentById(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.safety.findIncidentById(id, siteId);
  }

  @Post('incidents')
  @Roles('operator')
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
  @Roles('operator')
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
  @Roles('viewer')
  @ApiOperation({ summary: 'Safety metrics: TRIR, LTIR, days since last incident, near-miss ratio' })
  async getMetrics(@CurrentUser('siteId') siteId: string) {
    return this.safety.getMetrics(siteId);
  }

  @Post('incidents/:id/attachments')
  @Roles('operator')
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
