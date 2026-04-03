import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FiveSService } from './five-s.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../roles/permission.guard';
import { RequirePermission } from '../../roles/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('5S Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('tools/five-s')
export class FiveSController {
  constructor(private fiveS: FiveSService) {}

  @Get()
  @RequirePermission('continuous_improvement', 'view')
  async findAll(@CurrentUser('siteId') siteId: string) {
    return this.fiveS.findAllBySite(siteId);
  }

  @Post()
  @RequirePermission('continuous_improvement', 'participate')
  async create(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') auditorId: string,
    @Body() body: { area: string },
  ) {
    return this.fiveS.create(siteId, auditorId, body.area);
  }

  @Get('trends')
  @RequirePermission('continuous_improvement', 'view')
  async getTrends(
    @CurrentUser('siteId') siteId: string,
    @Query('area') area?: string,
    @Query('months') months?: string,
  ) {
    return this.fiveS.getTrends(siteId, area, months ? parseInt(months, 10) : 6);
  }

  @Get(':id')
  @RequirePermission('continuous_improvement', 'view')
  async findOne(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.fiveS.findById(id, siteId);
  }

  @Patch(':id/scores')
  @RequirePermission('continuous_improvement', 'participate')
  async updateScores(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { scores: Array<{ category: string; score: number; notes?: string; photoUrl?: string }> },
  ) {
    return this.fiveS.updateScores(id, siteId, body.scores);
  }

  @Patch(':id/complete')
  @RequirePermission('continuous_improvement', 'participate')
  async complete(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.fiveS.complete(id, siteId);
  }
}
