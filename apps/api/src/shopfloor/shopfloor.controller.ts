import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ShopfloorService } from './shopfloor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Shop Floor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shopfloor')
export class ShopfloorController {
  constructor(private shopfloor: ShopfloorService) {}

  @Get('workstation/:workstationId/pos')
  @Roles('operator')
  async getAvailablePOs(@Param('workstationId') workstationId: string) {
    return this.shopfloor.getAvailablePOs(workstationId);
  }

  @Get('workstation/:workstationId/active-run')
  @Roles('operator')
  async getActiveRun(@Param('workstationId') workstationId: string) {
    return this.shopfloor.getActiveRun(workstationId);
  }

  @Get('reason-codes')
  @Roles('operator')
  async getReasonCodes(@CurrentUser('siteId') siteId: string, @Query('category') category: string) {
    return this.shopfloor.getReasonCodes(siteId, category);
  }

  @Post('start-run')
  @Roles('operator')
  async startRun(
    @Body() body: { phaseId: string; workstationId: string },
    @CurrentUser('id') operatorId: string,
  ) {
    return this.shopfloor.startRun(body.phaseId, body.workstationId, operatorId);
  }

  @Post('status-change')
  @Roles('operator')
  async changeStatus(
    @Body() body: { workstationId: string; status: string; reasonCode?: string; notes?: string },
    @CurrentUser('id') operatorId: string,
  ) {
    return this.shopfloor.changeStatus(body.workstationId, operatorId, body);
  }

  @Post('flag')
  @Roles('operator')
  async flag(
    @Body() body: { workstationId: string; notes: string },
    @CurrentUser('id') operatorId: string,
  ) {
    return this.shopfloor.flag(body.workstationId, operatorId, body.notes);
  }

  @Post('close-run/:runId')
  @Roles('operator')
  async closeRun(
    @Param('runId') runId: string,
    @Body() body: { producedQuantity: number; scrapQuantity: number; notes?: string },
    @CurrentUser('id') operatorId: string,
  ) {
    return this.shopfloor.closeRun(runId, operatorId, body);
  }
}
