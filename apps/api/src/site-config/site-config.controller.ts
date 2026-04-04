import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SiteConfigService } from './site-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateToolConfigsDto } from './dto/update-tool-configs.dto';

@ApiTags('Site Configuration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('site-config')
export class SiteConfigController {
  constructor(private siteConfig: SiteConfigService) {}

  @Get('tools')
  async getToolConfigs(@CurrentUser('siteId') siteId: string) {
    return this.siteConfig.getToolConfigs(siteId);
  }

  @Patch('tools')
  @RequirePermission('people', 'manage')
  async updateToolConfigs(
    @CurrentUser('siteId') siteId: string,
    @Body() body: UpdateToolConfigsDto,
  ) {
    return this.siteConfig.updateToolConfigs(siteId, body.tools);
  }
}
