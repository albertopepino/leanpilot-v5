import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { KAIZEN_STATUSES } from '../../common/constants';
import { KaizenService } from './kaizen.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CreateKaizenDto } from './dto/create-kaizen.dto';
import { ReviewKaizenDto } from './dto/review-kaizen.dto';

@ApiTags('Kaizen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tools/kaizen')
export class KaizenController {
  constructor(private kaizen: KaizenService) {}

  @Get()
  @Roles('viewer')
  @ApiOperation({ summary: 'List Kaizen items for current site' })
  @ApiQuery({ name: 'status', enum: KAIZEN_STATUSES, required: false })
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('status') status?: string,
  ) {
    return this.kaizen.findAllBySite(siteId, status);
  }

  @Get(':id')
  @Roles('viewer')
  @ApiOperation({ summary: 'Get Kaizen item details' })
  async findById(@Param('id') id: string) {
    return this.kaizen.findById(id);
  }

  @Post()
  @Roles('operator')
  @ApiOperation({ summary: 'Submit a new Kaizen suggestion' })
  async create(
    @Body() dto: CreateKaizenDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('siteId') siteId: string,
  ) {
    return this.kaizen.create(dto, userId, siteId);
  }

  @Patch(':id/review')
  @Roles('manager')
  @ApiOperation({ summary: 'Review a Kaizen suggestion' })
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewKaizenDto,
    @CurrentUser('id') reviewerId: string,
  ) {
    return this.kaizen.review(id, dto, reviewerId);
  }
}
