import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RootCauseService } from './root-cause.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Root Cause Analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rca')
export class RootCauseController {
  constructor(private rootCause: RootCauseService) {}

  // ===== FIVE WHY =====

  @Get('five-why')
  @Roles('viewer')
  @ApiOperation({ summary: 'List all Five-Why analyses' })
  async findFiveWhy(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.rootCause.findFiveWhy(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get('five-why/:id')
  @Roles('viewer')
  @ApiOperation({ summary: 'Five-Why detail with steps' })
  async findFiveWhyById(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.rootCause.findFiveWhyById(id, siteId);
  }

  @Post('five-why')
  @Roles('operator')
  @ApiOperation({ summary: 'Create a Five-Why analysis' })
  async createFiveWhy(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      title: string;
      ncrId?: string;
      incidentId?: string;
      categoryTag?: string;
    },
  ) {
    return this.rootCause.createFiveWhy(siteId, userId, body);
  }

  @Patch('five-why/:id')
  @Roles('operator')
  @ApiOperation({ summary: 'Update Five-Why (status, summary, categoryTag)' })
  async updateFiveWhy(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      title?: string;
      status?: string;
      rootCauseSummary?: string;
      categoryTag?: string;
    },
  ) {
    return this.rootCause.updateFiveWhy(id, siteId, body);
  }

  @Post('five-why/:id/steps')
  @Roles('operator')
  @ApiOperation({ summary: 'Add or update a Five-Why step (1-5)' })
  async upsertFiveWhyStep(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      stepNumber: number;
      question: string;
      answer: string;
    },
  ) {
    return this.rootCause.upsertFiveWhyStep(id, siteId, body);
  }

  // ===== ISHIKAWA =====

  @Get('ishikawa')
  @Roles('viewer')
  @ApiOperation({ summary: 'List all Ishikawa analyses' })
  async findIshikawa(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.rootCause.findIshikawa(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get('ishikawa/:id')
  @Roles('viewer')
  @ApiOperation({ summary: 'Ishikawa detail with causes' })
  async findIshikawaById(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.rootCause.findIshikawaById(id, siteId);
  }

  @Post('ishikawa')
  @Roles('operator')
  @ApiOperation({ summary: 'Create an Ishikawa analysis' })
  async createIshikawa(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      title: string;
      ncrId?: string;
      incidentId?: string;
      categoryTag?: string;
    },
  ) {
    return this.rootCause.createIshikawa(siteId, userId, body);
  }

  @Patch('ishikawa/:id')
  @Roles('operator')
  @ApiOperation({ summary: 'Update Ishikawa analysis' })
  async updateIshikawa(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      title?: string;
      status?: string;
      rootCauseSummary?: string;
      categoryTag?: string;
    },
  ) {
    return this.rootCause.updateIshikawa(id, siteId, body);
  }

  @Post('ishikawa/:id/causes')
  @Roles('operator')
  @ApiOperation({ summary: 'Add a cause to Ishikawa diagram' })
  async addIshikawaCause(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      category: string;
      description: string;
      isRootCause?: boolean;
    },
  ) {
    return this.rootCause.addIshikawaCause(id, siteId, body);
  }

  @Delete('ishikawa/:id/causes/:causeId')
  @Roles('operator')
  @ApiOperation({ summary: 'Remove a cause from Ishikawa diagram' })
  async removeIshikawaCause(
    @Param('id') id: string,
    @Param('causeId') causeId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.rootCause.removeIshikawaCause(causeId, id, siteId);
  }

  // ===== 8D =====

  @Get('eight-d')
  @Roles('viewer')
  @ApiOperation({ summary: 'List 8D reports' })
  async findEightD(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.rootCause.findEightD(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get('eight-d/:id')
  @Roles('viewer')
  @ApiOperation({ summary: '8D report detail with linked RCA' })
  async findEightDById(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.rootCause.findEightDById(id, siteId);
  }

  @Post('eight-d')
  @Roles('manager')
  @ApiOperation({ summary: 'Create an 8D report' })
  async createEightD(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      title: string;
      ncrId?: string;
      incidentId?: string;
      teamMembers?: string;
      categoryTag?: string;
    },
  ) {
    return this.rootCause.createEightD(siteId, userId, body);
  }

  @Patch('eight-d/:id')
  @Roles('manager')
  @ApiOperation({ summary: 'Update 8D report (advance status, fill D-fields)' })
  async updateEightD(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      title?: string;
      status?: string;
      teamMembers?: string;
      d2ProblemDescription?: string;
      d2IsIsNot?: string;
      d3ContainmentActions?: string;
      d3ContainmentEffective?: boolean;
      d4FiveWhyId?: string;
      d4IshikawaId?: string;
      d4RootCauseSummary?: string;
      d5CorrectiveActions?: string;
      d6ImplementationNotes?: string;
      d7SystemicChanges?: string;
      d7LessonsLearned?: string;
      d8CustomerResponse?: string;
      categoryTag?: string;
    },
  ) {
    return this.rootCause.updateEightD(id, siteId, body);
  }

  // ===== PARETO =====

  @Get('pareto')
  @Roles('viewer')
  @ApiOperation({ summary: 'Pareto aggregation of categoryTag across all RCA types' })
  async getPareto(@CurrentUser('siteId') siteId: string) {
    return this.rootCause.getPareto(siteId);
  }
}
