import { Controller, Get, Patch, Param, Body, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../roles/permission.guard';
import { RequirePermission } from '../roles/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  /** GDPR Art. 20 — Any authenticated user can export their own data */
  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Export own user data (GDPR Art. 20)' })
  async exportMyData(@CurrentUser('id') userId: string) {
    return this.users.exportUserData(userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('people', 'view')
  @ApiOperation({ summary: 'List users (scoped by role)' })
  async findAll(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.users.findAll(user, limit ? +limit : 50, offset ? +offset : 0);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('people', 'view')
  @ApiOperation({ summary: 'Get user by ID' })
  async findById(@Param('id') id: string, @CurrentUser('corporateId') corporateId: string) {
    return this.users.findById(id, corporateId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('people', 'manage')
  @ApiOperation({ summary: 'Update user (admin only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.users.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('people', 'manage')
  @ApiOperation({ summary: 'Deactivate user (soft delete)' })
  async deactivate(@Param('id') id: string, @CurrentUser('corporateId') corporateId: string) {
    return this.users.deactivate(id, corporateId);
  }

  /** GDPR Art. 17 — Anonymize user and delete non-essential data */
  @Delete(':id/gdpr')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('people', 'manage')
  @ApiOperation({ summary: 'GDPR delete user (anonymize + purge non-essential data)' })
  async gdprDelete(
    @Param('id') id: string,
    @CurrentUser('corporateId') corporateId: string,
  ) {
    return this.users.gdprDelete(id, corporateId);
  }
}
