import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { A3Service } from './a3.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('A3 Problem Solving')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('a3')
export class A3Controller {
  constructor(private a3: A3Service) {}

  @Get()
  @Roles('operator')
  async findAll(@CurrentUser('siteId') siteId: string) {
    return this.a3.findAll(siteId);
  }

  @Get(':id')
  @Roles('operator')
  async findOne(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.a3.findById(id, siteId);
  }

  @Post()
  @Roles('operator')
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
  @Roles('operator')
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
  @Roles('operator')
  async changeStatus(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { status: string },
  ) {
    return this.a3.changeStatus(id, siteId, body.status);
  }
}
