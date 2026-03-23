import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

const ROLE_HIERARCHY: Record<string, number> = {
  corporate_admin: 50,
  site_admin: 40,
  manager: 30,
  operator: 20,
  viewer: 10,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** List users visible to the requester based on role/scope */
  async findAll(currentUser: { id: string; role: string; siteId: string; corporateId: string }) {
    const where: any = {};

    if (currentUser.role === 'corporate_admin') {
      where.corporateId = currentUser.corporateId;
    } else if (currentUser.role === 'site_admin') {
      where.siteId = currentUser.siteId;
    } else {
      // Managers and below only see users at their site
      where.siteId = currentUser.siteId;
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        siteId: true,
        corporateId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        site: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        siteId: true,
        corporateId: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        site: { select: { name: true } },
        corporate: { select: { name: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto, currentUser: { role: string }) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');

    // Cannot promote someone to a role higher than your own
    if (dto.role && ROLE_HIERARCHY[dto.role] >= ROLE_HIERARCHY[currentUser.role]) {
      throw new ForbiddenException('Cannot assign a role equal to or higher than your own');
    }

    const data: any = { ...dto };

    // Hash password if being changed
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 12);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        siteId: true,
        isActive: true,
      },
    });
  }

  async deactivate(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
