import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CorporateService {
  constructor(private prisma: PrismaService) {}

  async getOverview(corporateId: string) {
    const corporate = await this.prisma.corporate.findUnique({
      where: { id: corporateId },
      include: {
        sites: {
          where: { isActive: true },
          include: {
            _count: { select: { users: true, workstations: true } },
          },
        },
      },
    });

    if (!corporate) throw new NotFoundException('Corporate not found');

    const totalUsers = await this.prisma.user.count({ where: { corporateId } });

    return {
      id: corporate.id,
      name: corporate.name,
      totalUsers,
      totalSites: corporate.sites.length,
      sites: corporate.sites.map(site => ({
        id: site.id,
        name: site.name,
        location: site.location,
        userCount: site._count.users,
        workstationCount: site._count.workstations,
        isActive: site.isActive,
      })),
    };
  }
}
