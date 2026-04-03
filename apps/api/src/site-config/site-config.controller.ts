import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SiteConfigService } from './site-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Site Configuration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('site-config')
export class SiteConfigController {
  constructor(private siteConfig: SiteConfigService) {}

  @Get('tools')
  @Roles('viewer')
  async getToolConfigs(@CurrentUser('siteId') siteId: string) {
    return this.siteConfig.getToolConfigs(siteId);
  }

  @Patch('tools')
  @Roles('site_admin')
  async updateToolConfigs(
    @CurrentUser('siteId') siteId: string,
    @Body() body: {
      tools: Array<{ toolSlug: string; isEnabled: boolean; minRole: string }>;
    },
  ) {
    return this.siteConfig.updateToolConfigs(siteId, body.tools);
  }
}
