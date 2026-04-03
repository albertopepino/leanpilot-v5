import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CapaService } from './capa.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('CAPA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('capa')
export class CapaController {
  constructor(private capaService: CapaService) {}

  @Get()
  @RequirePermission('quality', 'view')
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('ncrId') ncrId?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    const filters: { status?: string; ncrId?: string; assigneeId?: string } = {};
    if (status) filters.status = status;
    if (ncrId) filters.ncrId = ncrId;
    if (assigneeId) filters.assigneeId = assigneeId;

    return this.capaService.findAllBySite(
      siteId,
      limit ? +limit : 50,
      offset ? +offset : 0,
      Object.keys(filters).length > 0 ? filters : undefined,
    );
  }

  @Get('summary')
  @RequirePermission('quality', 'view')
  async getSummary(@CurrentUser('siteId') siteId: string) {
    return this.capaService.getSummary(siteId);
  }

  @Get(':id')
  @RequirePermission('quality', 'view')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.capaService.findById(id, siteId);
  }

  @Post()
  @RequirePermission('quality', 'manage')
  async create(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      ncrId?: string;
      incidentId?: string;
      type: string;
      title: string;
      description: string;
      assigneeId: string;
      dueDate: string;
      priority?: string;
      rootCause?: string;
    },
  ) {
    return this.capaService.create(siteId, userId, body);
  }

  @Patch(':id')
  @RequirePermission('quality', 'manage')
  async update(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      title?: string;
      description?: string;
      assigneeId?: string;
      dueDate?: string;
      priority?: string;
      status?: string;
      rootCause?: string;
      actionTaken?: string;
      verificationMethod?: string;
      verificationDate?: string;
      verifiedById?: string;
      effectivenessCheck?: string;
      effectivenessDate?: string;
      effectiveResult?: string;
    },
  ) {
    return this.capaService.update(id, siteId, body);
  }
}
