import {
  Controller, Post, Get, UseGuards, UseInterceptors,
  UploadedFile, Query, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private uploads: UploadsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) // 10MB max
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('function') func: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const VALID_FUNCTIONS = ['quality', 'five-s', 'kaizen', 'gemba', 'documents', 'safety', 'maintenance', 'general'];
    if (!func) {
      func = 'general';
    } else if (!VALID_FUNCTIONS.includes(func)) {
      throw new BadRequestException(`Invalid upload function: ${func}. Must be one of: ${VALID_FUNCTIONS.join(', ')}`);
    }
    return this.uploads.upload(file, siteId, func);
  }

  @Get('quota')
  async getQuota(@CurrentUser('siteId') siteId: string) {
    return this.uploads.getQuota(siteId);
  }
}
