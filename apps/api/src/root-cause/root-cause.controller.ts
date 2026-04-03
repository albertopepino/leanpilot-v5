import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RootCauseService } from './root-cause.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Root Cause Analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('rca')
export class RootCauseController {
  constructor(private rootCause: RootCauseService) {}

  // ===== FIVE WHY =====

  @Get('five-why')
  @RequirePermission('problem_solving', 'view')
  @ApiOperation({ summary: 'List all Five-Why analyses' })
  async findFiveWhy(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.rootCause.findFiveWhy(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get('five-why/:id')
  @RequirePermission('problem_solving', 'view')
  @ApiOperation({ summary: 'Five-Why detail with steps' })
  async findFiveWhyById(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.rootCause.findFiveWhyById(id, siteId);
  }

  @Post('five-why')
  @RequirePermission('problem_solving', 'participate')
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
  @RequirePermission('problem_solving', 'participate')
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
  @RequirePermission('problem_solving', 'participate')
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
  @RequirePermission('problem_solving', 'view')
  @ApiOperation({ summary: 'List all Ishikawa analyses' })
  async findIshikawa(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.rootCause.findIshikawa(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get('ishikawa/:id')
  @RequirePermission('problem_solving', 'view')
  @ApiOperation({ summary: 'Ishikawa detail with causes' })
  async findIshikawaById(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.rootCause.findIshikawaById(id, siteId);
  }

  @Post('ishikawa')
  @RequirePermission('problem_solving', 'participate')
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
  @RequirePermission('problem_solving', 'participate')
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
  @RequirePermission('problem_solving', 'participate')
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
  @RequirePermission('problem_solving', 'participate')
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
  @RequirePermission('problem_solving', 'view')
  @ApiOperation({ summary: 'List 8D reports' })
  async findEightD(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.rootCause.findEightD(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get('eight-d/:id')
  @RequirePermission('problem_solving', 'view')
  @ApiOperation({ summary: '8D report detail with linked RCA' })
  async findEightDById(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.rootCause.findEightDById(id, siteId);
  }

  @Post('eight-d')
  @RequirePermission('problem_solving', 'manage')
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
  @RequirePermission('problem_solving', 'manage')
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
  @RequirePermission('problem_solving', 'view')
  @ApiOperation({ summary: 'Pareto aggregation of categoryTag across all RCA types' })
  async getPareto(@CurrentUser('siteId') siteId: string) {
    return this.rootCause.getPareto(siteId);
  }
}
