import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documents: DocumentsService) {}

  @Get()
  @Roles('viewer')
  @ApiOperation({ summary: 'List documents with optional filters' })
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.documents.findAll(siteId, { category, status, search });
  }

  @Get(':id')
  @Roles('viewer')
  @ApiOperation({ summary: 'Document detail with revision history' })
  async findById(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.documents.findById(id, siteId);
  }

  @Post()
  @Roles('manager')
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
  @Roles('manager')
  @ApiOperation({ summary: 'Update document metadata' })
  async update(
    @Param('id') id: string,
    @CurrentUser('siteId') siteId: string,
    @Body() body: { title?: string; description?: string; category?: string },
  ) {
    return this.documents.update(id, siteId, body);
  }

  @Post(':id/revisions')
  @Roles('manager')
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
  @Roles('manager')
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
