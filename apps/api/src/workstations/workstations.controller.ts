import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkstationsService } from './workstations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Workstations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('workstations')
export class WorkstationsController {
  constructor(private workstations: WorkstationsService) {}

  @Get()
  @RequirePermission('maintenance', 'view')
  async findAll(@CurrentUser('siteId') siteId: string) {
    return this.workstations.findAllBySite(siteId);
  }

  @Get(':id')
  @RequirePermission('maintenance', 'view')
  async findById(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.workstations.findById(id, siteId);
  }

  @Post()
  @RequirePermission('maintenance', 'manage')
  async create(@Body() body: { name: string; type?: string; area?: string; code: string }, @CurrentUser('siteId') siteId: string) {
    return this.workstations.create({ ...body, siteId });
  }

  @Patch(':id')
  @RequirePermission('maintenance', 'manage')
  async update(@Param('id') id: string, @Body() body: { name?: string; type?: string; area?: string; isActive?: boolean }, @CurrentUser('siteId') siteId: string) {
    return this.workstations.update(id, siteId, body);
  }
}
