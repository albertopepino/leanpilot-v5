import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { QualityService } from './quality.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quality')
export class QualityController {
  constructor(private quality: QualityService) {}

  // ── Templates ────────────────────────────────────────────────────

  @Get('templates')
  @Roles('operator')
  async getTemplates(@CurrentUser('siteId') siteId: string) {
    return this.quality.getTemplates(siteId);
  }

  @Post('templates')
  @Roles('manager')
  async createTemplate(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      name: string;
      productName?: string;
      phase?: string;
      checkpoints: Array<{
        sequence: number;
        description: string;
        measurementType?: string;
        unit?: string;
        lowerLimit?: number;
        upperLimit?: number;
        targetValue?: number;
        isRequired?: boolean;
      }>;
    },
  ) {
    return this.quality.createTemplate(siteId, userId, body);
  }

  @Get('templates/:id')
  @Roles('operator')
  async getTemplate(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.quality.getTemplate(id, siteId);
  }

  // ── Inspections ──────────────────────────────────────────────────

  @Get('inspections')
  @Roles('operator')
  async getInspections(@CurrentUser('siteId') siteId: string) {
    return this.quality.getInspections(siteId);
  }

  @Post('inspections')
  @Roles('operator')
  async createInspection(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') inspectorId: string,
    @Body() body: { templateId: string; workstationId: string; orderId?: string; phaseId?: string },
  ) {
    return this.quality.createInspection(siteId, inspectorId, body);
  }

  @Get('inspections/:id')
  @Roles('operator')
  async getInspection(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.quality.getInspection(id, siteId);
  }

  @Post('inspections/:id/results')
  @Roles('operator')
  async submitResults(
    @Param('id') inspectionId: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      results: Array<{
        checkpointId: string;
        value: string;
        passed: boolean;
        notes?: string;
        photoUrl?: string;
      }>;
    },
  ) {
    return this.quality.submitResults(inspectionId, siteId, body.results);
  }

  // ── NCR ──────────────────────────────────────────────────────────

  @Get('ncr')
  @Roles('operator')
  async getNcrs(@CurrentUser('siteId') siteId: string) {
    return this.quality.getNcrs(siteId);
  }

  @Post('ncr')
  @Roles('operator')
  async createNcr(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') reporterId: string,
    @Body() body: {
      title?: string;
      severity: string;
      description: string;
      defectQuantity?: number;
      workstationId?: string;
      orderId?: string;
    },
  ) {
    return this.quality.createNcr(siteId, reporterId, body);
  }

  @Get('ncr/:id')
  @Roles('operator')
  async getNcr(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.quality.getNcr(id, siteId);
  }

  @Patch('ncr/:id')
  @Roles('manager')
  async updateNcr(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      rootCause?: string;
      containmentAction?: string;
      correctiveAction?: string;
      preventiveAction?: string;
      status?: string;
    },
  ) {
    const data: any = { ...body };
    if (body.status === 'closed') data.verifiedById = userId;
    return this.quality.updateNcr(id, siteId, data);
  }

  @Post('ncr/:id/attachments')
  @Roles('operator')
  async addAttachment(
    @Param('id') ncrId: string,
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { fileName: string; fileUrl: string },
  ) {
    return this.quality.addAttachment(ncrId, siteId, userId, body.fileName, body.fileUrl);
  }

  // ── SPC ──────────────────────────────────────────────────────────

  @Get('spc')
  @Roles('operator')
  async getSpcData(
    @Query('checkpointId') checkpointId: string,
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 50;
    return this.quality.getSpcData(checkpointId, siteId, isNaN(parsed) ? 50 : parsed);
  }
}
