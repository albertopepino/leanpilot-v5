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
            _count: {
              select: {
                users: true,
                fiveSAudits: true,
                kaizenItems: true,
              },
            },
          },
        },
        _count: { select: { users: true } },
      },
    });

    if (!corporate) throw new NotFoundException('Corporate not found');

    return {
      id: corporate.id,
      name: corporate.name,
      totalUsers: corporate._count.users,
      totalSites: corporate.sites.length,
      sites: corporate.sites.map(site => ({
        id: site.id,
        name: site.name,
        location: site.location,
        userCount: site._count.users,
        auditCount: site._count.fiveSAudits,
        kaizenCount: site._count.kaizenItems,
        isActive: site.isActive,
      })),
    };
  }
}
