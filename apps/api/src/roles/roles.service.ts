import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FEATURE_GROUPS,
  PERMISSION_LEVELS,
  LEVEL_HIERARCHY,
  COMPLIANCE_FLOOR,
} from './permission.constants';

interface PermissionInput {
  featureGroup: string;
  level: string;
}

interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: PermissionInput[];
}

interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: PermissionInput[];
}

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAllBySite(siteId: string, limit = 50, offset = 0) {
    const [roles, total] = await Promise.all([
      this.prisma.customRole.findMany({
        where: {
          OR: [{ siteId }, { siteId: null, isSystem: true }],
        },
        include: { permissions: true, _count: { select: { users: true } } },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.customRole.count({
        where: {
          OR: [{ siteId }, { siteId: null, isSystem: true }],
        },
      }),
    ]);

    return { roles, total };
  }

  async findById(id: string, siteId?: string) {
    const role = await this.prisma.customRole.findUnique({
      where: { id },
      include: { permissions: true, _count: { select: { users: true } } },
    });

    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    // If siteId is provided, enforce that the role belongs to the caller's site or is a system role
    if (siteId && !role.isSystem && role.siteId !== siteId) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    return role;
  }

  async create(siteId: string, data: CreateRoleInput) {
    this.validatePermissions(data.permissions);
    const permissions = this.enforceComplianceFloor(data.permissions);

    return this.prisma.customRole.create({
      data: {
        siteId,
        name: data.name,
        description: data.description,
        isSystem: false,
        isDefault: false,
        permissions: {
          create: permissions.map((p) => ({
            featureGroup: p.featureGroup,
            level: p.level,
          })),
        },
      },
      include: { permissions: true },
    });
  }

  async update(id: string, siteId: string, data: UpdateRoleInput) {
    const existing = await this.findById(id, siteId);

    if (existing.isSystem) {
      throw new BadRequestException('Cannot modify system roles');
    }

    if (existing.siteId !== siteId) {
      throw new BadRequestException('Role does not belong to this site');
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    if (data.permissions) {
      this.validatePermissions(data.permissions);
      const permissions = this.enforceComplianceFloor(data.permissions);

      // Delete existing permissions and recreate
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      updateData.permissions = {
        create: permissions.map((p) => ({
          featureGroup: p.featureGroup,
          level: p.level,
        })),
      };
    }

    return this.prisma.customRole.update({
      where: { id },
      data: updateData,
      include: { permissions: true },
    });
  }

  async delete(id: string, siteId: string) {
    const existing = await this.findById(id, siteId);

    if (existing.isSystem) {
      throw new BadRequestException('Cannot delete system roles');
    }

    if (existing.siteId !== siteId) {
      throw new BadRequestException('Role does not belong to this site');
    }

    if (existing._count.users > 0) {
      throw new ConflictException(
        `Cannot delete role with ${existing._count.users} assigned user(s). Reassign them first.`,
      );
    }

    await this.prisma.customRole.delete({ where: { id } });
    return { deleted: true };
  }

  async cloneRole(id: string, siteId: string, newName: string) {
    const source = await this.findById(id, siteId);

    return this.prisma.customRole.create({
      data: {
        siteId,
        name: newName,
        description: source.description
          ? `Cloned from ${source.name}: ${source.description}`
          : `Cloned from ${source.name}`,
        isSystem: false,
        isDefault: false,
        permissions: {
          create: source.permissions.map((p) => ({
            featureGroup: p.featureGroup,
            level: p.level,
          })),
        },
      },
      include: { permissions: true },
    });
  }

  async assignToUser(userId: string, roleId: string, siteId: string) {
    // Verify the role exists and belongs to the site (or is a system role)
    const role = await this.prisma.customRole.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role ${roleId} not found`);
    }

    if (role.siteId && role.siteId !== siteId) {
      throw new BadRequestException('Role does not belong to this site');
    }

    // Verify the user exists and belongs to the same site
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, siteId: true, role: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.siteId !== siteId) {
      throw new BadRequestException('User does not belong to this site');
    }

    // Don't allow reassigning system admin roles to custom
    if (['corporate_admin', 'site_admin'].includes(user.role)) {
      throw new BadRequestException(
        'Cannot assign custom role to system administrators. Remove their admin role first.',
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { customRoleId: roleId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        customRoleId: true,
      },
    });
  }

  async getUserPermissions(userId: string): Promise<Record<string, string>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        customRoleId: true,
        customRole: { include: { permissions: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // System admins get manage on everything
    if (['corporate_admin', 'site_admin'].includes(user.role)) {
      const result: Record<string, string> = {};
      for (const group of FEATURE_GROUPS) {
        result[group] = 'manage';
      }
      return result;
    }

    // Build permissions map from custom role
    const result: Record<string, string> = {};
    for (const group of FEATURE_GROUPS) {
      result[group] = 'none';
    }

    if (user.customRole?.permissions) {
      for (const perm of user.customRole.permissions) {
        if (perm.featureGroup in result) {
          result[perm.featureGroup] = perm.level;
        }
      }
    }

    // Enforce compliance floor
    for (const [group, minLevel] of Object.entries(COMPLIANCE_FLOOR)) {
      if (group in result) {
        const currentNum = LEVEL_HIERARCHY[result[group]] || 0;
        const floorNum = LEVEL_HIERARCHY[minLevel] || 0;
        if (currentNum < floorNum) {
          result[group] = minLevel;
        }
      }
    }

    return result;
  }

  private validatePermissions(permissions: PermissionInput[]) {
    const validGroups = new Set<string>(FEATURE_GROUPS);
    const validLevels = new Set<string>(PERMISSION_LEVELS);
    const seen = new Set<string>();

    for (const p of permissions) {
      if (!validGroups.has(p.featureGroup)) {
        throw new BadRequestException(
          `Invalid feature group: ${p.featureGroup}`,
        );
      }
      if (!validLevels.has(p.level)) {
        throw new BadRequestException(`Invalid permission level: ${p.level}`);
      }
      if (seen.has(p.featureGroup)) {
        throw new BadRequestException(
          `Duplicate feature group: ${p.featureGroup}`,
        );
      }
      seen.add(p.featureGroup);
    }
  }

  private enforceComplianceFloor(
    permissions: PermissionInput[],
  ): PermissionInput[] {
    const result = [...permissions];

    for (const [group, minLevel] of Object.entries(COMPLIANCE_FLOOR)) {
      const existing = result.find((p) => p.featureGroup === group);
      const floorNum = LEVEL_HIERARCHY[minLevel] || 0;

      if (existing) {
        const currentNum = LEVEL_HIERARCHY[existing.level] || 0;
        if (currentNum < floorNum) {
          existing.level = minLevel;
        }
      } else {
        result.push({ featureGroup: group, level: minLevel });
      }
    }

    return result;
  }
}
