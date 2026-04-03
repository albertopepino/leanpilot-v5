import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SitesService } from './sites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@ApiTags('Sites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('sites')
export class SitesController {
  constructor(private sites: SitesService) {}

  @Get()
  @RequirePermission('people', 'view')
  @ApiOperation({ summary: 'List sites for current corporate' })
  async findAll(
    @CurrentUser('corporateId') corporateId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.sites.findAllByCorporate(corporateId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get site details' })
  async findById(@Param('id') id: string, @CurrentUser('corporateId') corporateId: string) {
    return this.sites.findById(id, corporateId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('corporate_admin')
  @ApiOperation({ summary: 'Create a new site' })
  async create(
    @Body() dto: CreateSiteDto,
    @CurrentUser('corporateId') corporateId: string,
  ) {
    return this.sites.create(dto, corporateId);
  }

  @Patch(':id')
  @RequirePermission('people', 'manage')
  @ApiOperation({ summary: 'Update site' })
  async update(@Param('id') id: string, @Body() dto: UpdateSiteDto, @CurrentUser('corporateId') corporateId: string) {
    return this.sites.update(id, corporateId, dto);
  }
}
