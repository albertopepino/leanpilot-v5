import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CorporateService } from './corporate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Corporate')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('corporate')
export class CorporateController {
  constructor(private corporate: CorporateService) {}

  @Get('overview')
  @Roles('corporate_admin')
  @ApiOperation({ summary: 'Corporate overview with all sites' })
  async getOverview(@CurrentUser('corporateId') corporateId: string) {
    return this.corporate.getOverview(corporateId);
  }
}
