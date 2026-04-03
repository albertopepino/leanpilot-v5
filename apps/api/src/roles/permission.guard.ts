import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, RequiredPermission } from './permission.decorator';
import {
  SYSTEM_ADMIN_ROLES,
  LEVEL_HIERARCHY,
  COMPLIANCE_FLOOR,
} from './permission.constants';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) return true; // No permission required

    const { user } = context.switchToHttp().getRequest();
    if (!user) return true; // No user yet — JwtAuthGuard will handle authentication

    // System admins bypass all permission checks
    if (SYSTEM_ADMIN_ROLES.includes(user.role)) return true;

    // Load user's permissions if not already loaded on this request
    if (!user.permissions) {
      if (user.customRoleId) {
        const role = await this.prisma.customRole.findUnique({
          where: { id: user.customRoleId },
          include: { permissions: true },
        });
        user.permissions = role?.permissions || [];
      } else {
        user.permissions = [];
      }
    }

    // Check compliance floor
    const floorLevel = COMPLIANCE_FLOOR[required.group];
    if (floorLevel) {
      const requiredNum = LEVEL_HIERARCHY[required.level] || 0;
      const floorNum = LEVEL_HIERARCHY[floorLevel] || 0;
      if (requiredNum <= floorNum) return true;
    }

    // Find user's permission for this feature group
    const perm = user.permissions.find(
      (p: { featureGroup: string }) => p.featureGroup === required.group,
    );
    if (!perm) return false;

    const userLevel = LEVEL_HIERARCHY[perm.level] || 0;
    const requiredLevel = LEVEL_HIERARCHY[required.level] || 0;

    return userLevel >= requiredLevel;
  }
}
