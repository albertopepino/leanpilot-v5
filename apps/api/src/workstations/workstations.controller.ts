import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkstationsService } from './workstations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Workstations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workstations')
export class WorkstationsController {
  constructor(private workstations: WorkstationsService) {}

  @Get()
  @Roles('viewer')
  async findAll(@CurrentUser('siteId') siteId: string) {
    return this.workstations.findAllBySite(siteId);
  }

  @Get(':id')
  @Roles('viewer')
  async findById(@Param('id') id: string) {
    return this.workstations.findById(id);
  }

  @Post()
  @Roles('site_admin')
  async create(@Body() body: { name: string; type?: string; area?: string; code: string }, @CurrentUser('siteId') siteId: string) {
    return this.workstations.create({ ...body, siteId });
  }

  @Patch(':id')
  @Roles('site_admin')
  async update(@Param('id') id: string, @Body() body: { name?: string; type?: string; area?: string; isActive?: boolean }) {
    return this.workstations.update(id, body);
  }
}
