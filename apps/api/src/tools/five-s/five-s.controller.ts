import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FiveSService } from './five-s.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('5S Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tools/five-s')
export class FiveSController {
  constructor(private fiveS: FiveSService) {}

  @Get()
  @Roles('operator')
  async findAll(@CurrentUser('siteId') siteId: string) {
    return this.fiveS.findAllBySite(siteId);
  }

  @Post()
  @Roles('operator')
  async create(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') auditorId: string,
    @Body() body: { area: string },
  ) {
    return this.fiveS.create(siteId, auditorId, body.area);
  }

  @Get(':id')
  @Roles('operator')
  async findOne(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.fiveS.findById(id, siteId);
  }

  @Patch(':id/scores')
  @Roles('operator')
  async updateScores(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { scores: Array<{ category: string; score: number; notes?: string; photoUrl?: string }> },
  ) {
    return this.fiveS.updateScores(id, siteId, body.scores);
  }

  @Patch(':id/complete')
  @Roles('operator')
  async complete(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.fiveS.complete(id, siteId);
  }
}
