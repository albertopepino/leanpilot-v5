import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SkillsService } from './skills.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Skills Matrix')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('skills')
export class SkillsController {
  constructor(private skills: SkillsService) {}

  @Get('matrix')
  @RequirePermission('people', 'view')
  async getMatrix(@CurrentUser('siteId') siteId: string) {
    return this.skills.getMatrix(siteId);
  }

  @Get('gaps')
  @RequirePermission('people', 'view')
  async getGaps(@CurrentUser('siteId') siteId: string) {
    return this.skills.getGaps(siteId);
  }

  @Get('user/:userId')
  @RequirePermission('people', 'view')
  async getUserSkills(
    @Param('userId') userId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.skills.getUserSkills(siteId, userId);
  }

  @Get()
  @RequirePermission('people', 'view')
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.skills.findAll(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Post()
  @RequirePermission('people', 'manage')
  async create(
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      name: string;
      category?: string;
      description?: string;
    },
  ) {
    return this.skills.create(siteId, body);
  }

  @Patch(':id')
  @RequirePermission('people', 'manage')
  async update(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      name?: string;
      category?: string;
      description?: string;
      isActive?: boolean;
    },
  ) {
    return this.skills.update(id, siteId, body);
  }

  @Patch('user/:userId/skill/:skillId')
  @RequirePermission('people', 'manage')
  async setUserSkillLevel(
    @Param('userId') userId: string,
    @Param('skillId') skillId: string,
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') assessedById: string,
    @Body() body: {
      level: number;
      certifiedDate?: string;
      expiryDate?: string;
      notes?: string;
    },
  ) {
    return this.skills.setUserSkillLevel(siteId, userId, skillId, assessedById, body);
  }
}
