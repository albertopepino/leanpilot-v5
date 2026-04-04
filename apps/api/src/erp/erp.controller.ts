import {
  Controller, Get, Post, Body, Query, UseGuards, UseInterceptors,
  UploadedFile, Res, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { ErpService } from './erp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('ERP Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('erp')
export class ErpController {
  constructor(private erp: ErpService) {}

  @Get('connection')
  @RequirePermission('people', 'manage')
  async getConnection(@CurrentUser('siteId') siteId: string) {
    return this.erp.getConnection(siteId);
  }

  @Post('connection')
  @RequirePermission('people', 'manage')
  async saveConnection(
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      provider: string;
      name?: string;
      baseUrl?: string;
      apiKey?: string;
      username?: string;
      password?: string;
      syncEnabled?: boolean;
      syncInterval?: number;
      config?: string;
    },
  ) {
    return this.erp.saveConnection(siteId, body);
  }

  @Post('test')
  @RequirePermission('people', 'manage')
  async testConnection(@CurrentUser('siteId') siteId: string) {
    return this.erp.testConnection(siteId);
  }

  @Post('import-orders')
  @RequirePermission('people', 'manage')
  async importOrders(@CurrentUser('siteId') siteId: string) {
    return this.erp.importOrders(siteId);
  }

  @Post('import-csv')
  @RequirePermission('people', 'manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importCsv(
    @CurrentUser('siteId') siteId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!file.originalname.endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are accepted');
    }

    const csvData = file.buffer.toString('utf-8');
    return this.erp.importOrdersFromCsv(siteId, csvData);
  }

  @Post('export-results')
  @RequirePermission('people', 'manage')
  async exportResults(@CurrentUser('siteId') siteId: string) {
    return this.erp.exportResults(siteId);
  }

  @Get('export-results/download')
  @RequirePermission('people', 'manage')
  async downloadResults(
    @CurrentUser('siteId') siteId: string,
    @Res() res: Response,
  ) {
    const csv = await this.erp.exportResultsCsv(siteId);
    const filename = `production-results-${new Date().toISOString().slice(0, 10)}.csv`;

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(csv);
  }

  @Get('sync-logs')
  @RequirePermission('people', 'manage')
  async getSyncLogs(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
  ) {
    return this.erp.getSyncLogs(siteId, limit ? +limit : 20);
  }
}
