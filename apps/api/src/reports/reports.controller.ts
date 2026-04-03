import { Controller, Get, Param, Query, Patch, Body, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  // ===== TEMPLATE =====

  @Get('template')
  @RequirePermission('people', 'manage')
  @ApiOperation({ summary: 'Get report template for current site' })
  async getTemplate(@CurrentUser('siteId') siteId: string) {
    const tmpl = await this.reports.getTemplate(siteId);
    return tmpl || { siteId, companyName: '', logoUrl: null, headerText: null, accentColor: '#2563eb', footerText: null };
  }

  @Patch('template')
  @RequirePermission('people', 'manage')
  @ApiOperation({ summary: 'Create or update report template' })
  async upsertTemplate(
    @CurrentUser('siteId') siteId: string,
    @Body() body: { companyName: string; logoUrl?: string; headerText?: string; accentColor?: string; footerText?: string },
  ) {
    return this.reports.upsertTemplate(siteId, body);
  }

  // ===== PDF DOWNLOADS =====

  @Get('five-s/:auditId')
  @RequirePermission('quality', 'view')
  @ApiOperation({ summary: '5S Audit PDF report' })
  async fiveSReport(
    @Param('auditId') auditId: string,
    @CurrentUser('siteId') siteId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reports.generateFiveSReport(auditId, siteId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="5s-audit-${auditId}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('gemba/:walkId')
  @RequirePermission('quality', 'view')
  @ApiOperation({ summary: 'Gemba Walk PDF report' })
  async gembaReport(
    @Param('walkId') walkId: string,
    @CurrentUser('siteId') siteId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reports.generateGembaReport(walkId, siteId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="gemba-walk-${walkId}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('ncr/:ncrId')
  @RequirePermission('quality', 'view')
  @ApiOperation({ summary: 'NCR (8D) PDF report' })
  async ncrReport(
    @Param('ncrId') ncrId: string,
    @CurrentUser('siteId') siteId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reports.generateNcrReport(ncrId, siteId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ncr-${ncrId}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('oee')
  @RequirePermission('quality', 'view')
  @ApiOperation({ summary: 'OEE Summary PDF report' })
  async oeeReport(
    @CurrentUser('siteId') siteId: string,
    @Query('period') period: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reports.generateOeeReport(siteId, period || 'week');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="oee-summary-${period || 'week'}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
