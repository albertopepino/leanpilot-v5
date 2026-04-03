import { Controller, Get, Patch, Param, Body, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles('manager')
  @ApiOperation({ summary: 'List users (scoped by role)' })
  async findAll(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.users.findAll(user, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get(':id')
  @Roles('manager')
  @ApiOperation({ summary: 'Get user by ID' })
  async findById(@Param('id') id: string, @CurrentUser('corporateId') corporateId: string) {
    return this.users.findById(id, corporateId);
  }

  @Patch(':id')
  @Roles('site_admin')
  @ApiOperation({ summary: 'Update user (admin only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.users.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('site_admin')
  @ApiOperation({ summary: 'Deactivate user (soft delete)' })
  async deactivate(@Param('id') id: string, @CurrentUser('corporateId') corporateId: string) {
    return this.users.deactivate(id, corporateId);
  }
}
