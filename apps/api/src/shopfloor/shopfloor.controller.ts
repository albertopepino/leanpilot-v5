import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ShopfloorService } from './shopfloor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Shop Floor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('shopfloor')
export class ShopfloorController {
  constructor(private shopfloor: ShopfloorService) {}

  @Get('workstation/:workstationId/pos')
  @RequirePermission('production', 'participate')
  async getAvailablePOs(
    @Param('workstationId') workstationId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.shopfloor.getAvailablePOs(workstationId, siteId);
  }

  @Get('workstation/:workstationId/active-run')
  @RequirePermission('production', 'participate')
  async getActiveRun(
    @Param('workstationId') workstationId: string,
    @CurrentUser('siteId') siteId: string,
    @Res() res: Response,
  ) {
    const run = await this.shopfloor.getActiveRun(workstationId, siteId);
    return res.json(run ?? null);
  }

  @Get('reason-codes/all')
  @RequirePermission('people', 'manage')
  async getAllReasonCodes(@CurrentUser('siteId') siteId: string) {
    return this.shopfloor.getAllReasonCodes(siteId);
  }

  @Post('reason-codes')
  @RequirePermission('people', 'manage')
  async createReasonCode(
    @CurrentUser('siteId') siteId: string,
    @Body() body: { category: string; code: string; label: string; color?: string; sortOrder?: number },
  ) {
    return this.shopfloor.createReasonCode(siteId, body);
  }

  @Patch('reason-codes/:id')
  @RequirePermission('people', 'manage')
  async updateReasonCode(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { label?: string; color?: string; sortOrder?: number; isActive?: boolean },
  ) {
    return this.shopfloor.updateReasonCode(id, siteId, body);
  }

  @Delete('reason-codes/:id')
  @RequirePermission('people', 'manage')
  async deleteReasonCode(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.shopfloor.deleteReasonCode(id, siteId);
  }

  @Get('reason-codes')
  @RequirePermission('production', 'participate')
  async getReasonCodes(@CurrentUser('siteId') siteId: string, @Query('category') category: string) {
    return this.shopfloor.getReasonCodes(siteId, category);
  }

  @Post('start-run')
  @RequirePermission('production', 'participate')
  async startRun(
    @Body() body: { phaseId: string; workstationId: string },
    @CurrentUser('id') operatorId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.shopfloor.startRun(body.phaseId, body.workstationId, operatorId, siteId);
  }

  @Post('status-change')
  @RequirePermission('production', 'participate')
  async changeStatus(
    @Body() body: { workstationId: string; status: string; reasonCode?: string; notes?: string },
    @CurrentUser('id') operatorId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.shopfloor.changeStatus(body.workstationId, operatorId, siteId, body);
  }

  @Post('flag')
  @RequirePermission('production', 'participate')
  async flag(
    @Body() body: { workstationId: string; notes: string },
    @CurrentUser('id') operatorId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.shopfloor.flag(body.workstationId, operatorId, siteId, body.notes);
  }

  @Post('close-run/:runId')
  @RequirePermission('production', 'participate')
  async closeRun(
    @Param('runId') runId: string,
    @Body() body: { producedQuantity: number; scrapQuantity: number; notes?: string; completePo?: boolean },
    @CurrentUser('id') operatorId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.shopfloor.closeRun(runId, operatorId, siteId, body);
  }
}
