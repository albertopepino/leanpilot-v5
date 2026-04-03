import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EscalationService } from './escalation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Escalation Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('escalation')
export class EscalationController {
  constructor(private escalation: EscalationService) {}

  @Get()
  @RequirePermission('people', 'view')
  async findAll(@CurrentUser('siteId') siteId: string) {
    return this.escalation.findAllBySite(siteId);
  }

  @Get(':id')
  @RequirePermission('people', 'view')
  async findOne(@Param('id') id: string) {
    return this.escalation.findById(id);
  }

  @Post()
  @RequirePermission('people', 'manage')
  async create(
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      name: string;
      triggerType: string;
      conditionMinutes: number;
      notifyGroup: string;
      notifyLevel: string;
      escalationTier?: number;
    },
  ) {
    return this.escalation.create(siteId, body);
  }

  @Patch(':id')
  @RequirePermission('people', 'manage')
  async update(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      name?: string;
      triggerType?: string;
      conditionMinutes?: number;
      notifyGroup?: string;
      notifyLevel?: string;
      escalationTier?: number;
      isActive?: boolean;
    },
  ) {
    return this.escalation.update(id, siteId, body);
  }

  @Delete(':id')
  @RequirePermission('people', 'manage')
  async delete(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.escalation.delete(id, siteId);
  }
}
