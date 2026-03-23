import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FiveSService } from './five-s.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CreateAuditDto } from './dto/create-audit.dto';
import { SubmitScoresDto } from './dto/submit-scores.dto';

@ApiTags('5S Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tools/five-s')
export class FiveSController {
  constructor(private fiveS: FiveSService) {}

  @Get()
  @Roles('viewer')
  @ApiOperation({ summary: 'List all 5S audits for current site' })
  async findAll(@CurrentUser('siteId') siteId: string) {
    return this.fiveS.findAllBySite(siteId);
  }

  @Get(':id')
  @Roles('viewer')
  @ApiOperation({ summary: 'Get audit details with scores' })
  async findById(@Param('id') id: string) {
    return this.fiveS.findById(id);
  }

  @Post()
  @Roles('operator')
  @ApiOperation({ summary: 'Start a new 5S audit' })
  async create(
    @Body() dto: CreateAuditDto,
    @CurrentUser('id') auditorId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.fiveS.create(dto, auditorId, siteId);
  }

  @Post(':id/scores')
  @Roles('operator')
  @ApiOperation({ summary: 'Submit or update audit scores' })
  async submitScores(@Param('id') id: string, @Body() dto: SubmitScoresDto) {
    return this.fiveS.submitScores(id, dto);
  }
}
