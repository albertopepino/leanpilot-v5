import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SkillsService } from './skills.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Skills Matrix')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('skills')
export class SkillsController {
  constructor(private skills: SkillsService) {}

  @Get('matrix')
  @Roles('operator')
  async getMatrix(@CurrentUser('siteId') siteId: string) {
    return this.skills.getMatrix(siteId);
  }

  @Get('gaps')
  @Roles('operator')
  async getGaps(@CurrentUser('siteId') siteId: string) {
    return this.skills.getGaps(siteId);
  }

  @Get('user/:userId')
  @Roles('operator')
  async getUserSkills(
    @Param('userId') userId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.skills.getUserSkills(siteId, userId);
  }

  @Get()
  @Roles('operator')
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.skills.findAll(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Post()
  @Roles('manager')
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
  @Roles('manager')
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
  @Roles('manager')
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
