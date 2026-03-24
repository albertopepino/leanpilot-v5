import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { KaizenService } from './kaizen.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Kaizen Board')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tools/kaizen')
export class KaizenController {
  constructor(private kaizen: KaizenService) {}

  @Get()
  @Roles('operator')
  async findAll(@CurrentUser('siteId') siteId: string) {
    return this.kaizen.findAllBySite(siteId);
  }

  @Post()
  @Roles('operator')
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
      gembaObservationId?: string;
    },
  ) {
    return this.kaizen.create(siteId, userId, body);
  }

  @Get(':id')
  @Roles('operator')
  async findOne(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.kaizen.findById(id, siteId);
  }

  @Patch(':id')
  @Roles('operator')
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
    },
  ) {
    return this.kaizen.update(id, siteId, body);
  }

  @Patch(':id/status')
  @Roles('manager')
  async changeStatus(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') reviewerId: string,
    @Body() body: { status: string; reviewNotes?: string },
  ) {
    return this.kaizen.changeStatus(id, siteId, body.status, reviewerId, body.reviewNotes);
  }
}
