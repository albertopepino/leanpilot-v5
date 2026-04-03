import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documents: DocumentsService) {}

  @Get()
  @RequirePermission('quality', 'view')
  @ApiOperation({ summary: 'List documents with optional filters' })
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.documents.findAll(siteId, { category, status, search }, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get(':id')
  @RequirePermission('quality', 'view')
  @ApiOperation({ summary: 'Document detail with revision history' })
  async findById(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.documents.findById(id, siteId);
  }

  @Post()
  @RequirePermission('quality', 'participate')
  @ApiOperation({ summary: 'Create a new document' })
  async create(
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      title: string;
      description?: string;
      category: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
    },
  ) {
    return this.documents.create(siteId, userId, body);
  }

  @Patch(':id')
  @RequirePermission('quality', 'manage')
  @ApiOperation({ summary: 'Update document metadata' })
  async update(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { title?: string; description?: string; category?: string },
  ) {
    return this.documents.update(id, siteId, body);
  }

  @Post(':id/revisions')
  @RequirePermission('quality', 'participate')
  @ApiOperation({ summary: 'Upload new document revision' })
  async addRevision(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: {
      fileUrl: string;
      fileName: string;
      fileSize: number;
      changeNotes?: string;
    },
  ) {
    return this.documents.addRevision(id, siteId, userId, body);
  }

  @Patch(':id/status')
  @RequirePermission('quality', 'manage')
  @ApiOperation({ summary: 'Change document status (draft/review/approved/obsolete)' })
  async changeStatus(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { status: string },
  ) {
    return this.documents.changeStatus(id, siteId, body.status, userId);
  }
}
