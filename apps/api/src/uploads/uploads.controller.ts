import {
  Controller, Post, Get, UseGuards, UseInterceptors,
  UploadedFile, Query, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private uploads: UploadsService) {}

  @Post()
  @Roles('operator')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) // 10MB max
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('function') func: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const validFunctions = ['quality', 'five-s', 'kaizen', 'gemba'];
    if (!validFunctions.includes(func)) {
      func = 'general';
    }
    return this.uploads.upload(file, siteId, func);
  }

  @Get('quota')
  @Roles('viewer')
  async getQuota(@CurrentUser('siteId') siteId: string) {
    return this.uploads.getQuota(siteId);
  }
}
