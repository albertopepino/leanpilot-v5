import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('people', 'manage')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(
    @CurrentUser() user: { siteId: string },
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.rolesService.findAllBySite(user.siteId, limit, offset);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findById(id);
  }

  @Post()
  create(
    @CurrentUser() user: { siteId: string },
    @Body()
    body: {
      name: string;
      description?: string;
      permissions: Array<{ featureGroup: string; level: string }>;
    },
  ) {
    return this.rolesService.create(user.siteId, body);
  }

  @Patch('assign')
  assign(
    @CurrentUser() user: { siteId: string },
    @Body() body: { userId: string; roleId: string },
  ) {
    return this.rolesService.assignToUser(body.userId, body.roleId, user.siteId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { siteId: string },
    @Body()
    body: {
      name?: string;
      description?: string;
      permissions?: Array<{ featureGroup: string; level: string }>;
    },
  ) {
    return this.rolesService.update(id, user.siteId, body);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser() user: { siteId: string },
  ) {
    return this.rolesService.delete(id, user.siteId);
  }

  @Post(':id/clone')
  clone(
    @Param('id') id: string,
    @CurrentUser() user: { siteId: string },
    @Body() body: { name: string },
  ) {
    return this.rolesService.cloneRole(id, user.siteId, body.name);
  }

}
