import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Production Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  @Roles('viewer')
  async findAll(
    @CurrentUser('siteId') siteId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.orders.findAllBySite(siteId, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get(':id')
  @Roles('viewer')
  async findById(@Param('id') id: string, @CurrentUser('siteId') siteId: string) {
    return this.orders.findById(id, siteId);
  }

  @Post()
  @Roles('manager')
  async create(@CurrentUser('siteId') siteId: string, @Body() body: any) {
    return this.orders.create(siteId, body);
  }
}
