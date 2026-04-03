import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { KaizenService } from './kaizen.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../roles/permission.guard';
import { RequirePermission } from '../../roles/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Kaizen Board')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('tools/kaizen')
export class KaizenController {
  constructor(private kaizen: KaizenService) {}

  @Get()
  @RequirePermission('continuous_improvement', 'view')
  async findAll(@CurrentUser('siteId') siteId: string) {
    return this.kaizen.findAllBySite(siteId);
  }

  @Post()
  @RequirePermission('continuous_improvement', 'participate')
  async create(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      title: string;
      problem: string;
      proposedSolution?: string;
      expectedImpact?: string;
      area?: string;
      photoUrl?: string;
      expectedSavings?: number;
      actualSavings?: number;
      costToImplement?: number;
      savingsType?: string;
      gembaObservationId?: string;
    },
  ) {
    return this.kaizen.create(siteId, userId, body);
  }

  @Get(':id')
  @RequirePermission('continuous_improvement', 'view')
  async findOne(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.kaizen.findById(id, siteId);
  }

  @Patch(':id')
  @RequirePermission('continuous_improvement', 'participate')
  async update(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      title?: string;
      problem?: string;
      proposedSolution?: string;
      expectedImpact?: string;
      area?: string;
      result?: string;
      photoUrl?: string;
      expectedSavings?: number;
      actualSavings?: number;
      costToImplement?: number;
      savingsType?: string;
    },
  ) {
    return this.kaizen.update(id, siteId, body);
  }

  @Patch(':id/status')
  @RequirePermission('continuous_improvement', 'manage')
  async changeStatus(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') reviewerId: string,
    @Body() body: { status: string; reviewNotes?: string; actualSavings?: number; costToImplement?: number },
  ) {
    return this.kaizen.changeStatus(id, siteId, body.status, reviewerId, body.reviewNotes, body.actualSavings, body.costToImplement);
  }
}
