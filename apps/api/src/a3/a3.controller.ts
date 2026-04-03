import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { A3Service } from './a3.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('A3 Problem Solving')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('a3')
export class A3Controller {
  constructor(private a3: A3Service) {}

  @Get()
  @RequirePermission('problem_solving', 'view')
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.a3.findAll(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get(':id')
  @RequirePermission('problem_solving', 'view')
  async findOne(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.a3.findById(id, siteId);
  }

  @Post()
  @RequirePermission('problem_solving', 'participate')
  async create(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      title: string;
      sponsorId?: string;
      background?: string;
      currentCondition?: string;
      targetCondition?: string;
      categoryTag?: string;
    },
  ) {
    return this.a3.create(siteId, userId, body);
  }

  @Patch(':id')
  @RequirePermission('problem_solving', 'participate')
  async update(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      title?: string;
      sponsorId?: string;
      background?: string;
      currentCondition?: string;
      targetCondition?: string;
      gapAnalysis?: string;
      rootCauseAnalysis?: string;
      fiveWhyId?: string;
      ishikawaId?: string;
      countermeasures?: string;
      implementationPlan?: string;
      confirmationMethod?: string;
      followUpDate?: string;
      followUpNotes?: string;
      categoryTag?: string;
    },
  ) {
    return this.a3.update(id, siteId, body);
  }

  @Patch(':id/status')
  @RequirePermission('problem_solving', 'manage')
  async changeStatus(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { status: string },
  ) {
    return this.a3.changeStatus(id, siteId, body.status);
  }
}
