import {
  Controller, Post, Get, UseGuards, UseInterceptors,
  UploadedFile, Query, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_ADMIN_ROLES, LEVEL_HIERARCHY, COMPLIANCE_FLOOR } from '../roles/permission.constants';

// Map upload function → required permission
const UPLOAD_PERMISSIONS: Record<string, { group: string; level: string }> = {
  'quality': { group: 'quality', level: 'participate' },
  'documents': { group: 'quality', level: 'participate' },
  'five-s': { group: 'continuous_improvement', level: 'participate' },
  'kaizen': { group: 'continuous_improvement', level: 'participate' },
  'gemba': { group: 'continuous_improvement', level: 'participate' },
  'safety': { group: 'safety', level: 'participate' },
  'maintenance': { group: 'maintenance', level: 'participate' },
  'general': { group: 'safety', level: 'participate' }, // minimum: any user who can report safety
};

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(
    private uploads: UploadsService,
    private prisma: PrismaService,
  ) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) // 10MB max
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('function') func: string,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const VALID_FUNCTIONS = Object.keys(UPLOAD_PERMISSIONS);
    if (!func) {
      func = 'general';
    } else if (!VALID_FUNCTIONS.includes(func)) {
      throw new BadRequestException(`Invalid upload function: ${func}. Must be one of: ${VALID_FUNCTIONS.join(', ')}`);
    }

    // System admins bypass permission checks
    if (!SYSTEM_ADMIN_ROLES.includes(user.role)) {
      const required = UPLOAD_PERMISSIONS[func];
      if (required) {
        // Check compliance floor
        const floorLevel = COMPLIANCE_FLOOR[required.group];
        const requiredNum = LEVEL_HIERARCHY[required.level] || 0;
        const floorOk = floorLevel && requiredNum <= (LEVEL_HIERARCHY[floorLevel] || 0);

        if (!floorOk) {
          // Load user permissions
          let permissions: any[] = [];
          if (user.customRoleId) {
            const role = await this.prisma.customRole.findUnique({
              where: { id: user.customRoleId },
              include: { permissions: true },
            });
            permissions = role?.permissions || [];
          }
          const perm = permissions.find((p: any) => p.featureGroup === required.group);
          const userLevel = LEVEL_HIERARCHY[(perm?.level) || 'none'] || 0;
          if (userLevel < requiredNum) {
            throw new ForbiddenException(`You do not have permission to upload to ${func}`);
          }
        }
      }
    }

    return this.uploads.upload(file, user.siteId, func);
  }

  @Get('quota')
  async getQuota(@CurrentUser('siteId') siteId: string) {
    return this.uploads.getQuota(siteId);
  }
}
