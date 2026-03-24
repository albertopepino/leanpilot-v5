import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';

@Injectable()
export class CorporateService {
  constructor(
    private prisma: PrismaService,
    private dashboard: DashboardService,
  ) {}

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

  async getSiteDetail(siteId: string, corporateId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: {
        _count: { select: { users: true, workstations: true } },
      },
    });

    if (!site || site.corporateId !== corporateId) {
      throw new ForbiddenException('Site not found or not in your corporate group');
    }

    const users = await this.prisma.user.findMany({
      where: { siteId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const workstations = await this.prisma.workstation.findMany({
      where: { siteId },
      select: { id: true, name: true, code: true, type: true, area: true, isActive: true },
      orderBy: { name: 'asc' },
    });

    const recentAudits = await this.prisma.fiveSAudit.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { auditor: { select: { firstName: true, lastName: true } } },
    });

    const recentKaizen = await this.prisma.kaizenIdea.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { submittedBy: { select: { firstName: true, lastName: true } } },
    });

    return {
      id: site.id,
      name: site.name,
      location: site.location,
      isActive: site.isActive,
      userCount: site._count.users,
      workstationCount: site._count.workstations,
      users,
      workstations,
      recentAudits: recentAudits.map(a => ({
        id: a.id,
        area: a.area,
        status: a.status,
        percentage: a.percentage,
        createdAt: a.createdAt,
        auditor: a.auditor,
      })),
      recentKaizen: recentKaizen.map(k => ({
        id: k.id,
        title: k.title,
        status: k.status,
        expectedImpact: k.expectedImpact,
        createdAt: k.createdAt,
        submittedBy: k.submittedBy,
      })),
    };
  }

  async getConsolidatedOee(corporateId: string, period = 'week') {
    const sites = await this.prisma.site.findMany({
      where: { corporateId, isActive: true },
      select: { id: true, name: true, location: true },
    });

    const siteOees: Array<{
      siteId: string;
      siteName: string;
      location: string | null;
      oee: number;
      availability: number;
      performance: number;
      quality: number;
      totalProduced: number;
      totalScrap: number;
    }> = [];

    for (const site of sites) {
      try {
        const oeeResult = await this.dashboard.getOee(site.id, undefined, period) as any;
        // getOee returns { period, since, workstations: [...], siteOee }
        const arr = Array.isArray(oeeResult?.workstations) ? oeeResult.workstations : [];
        if (arr.length === 0) {
          siteOees.push({
            siteId: site.id, siteName: site.name, location: site.location,
            oee: 0, availability: 0, performance: 0, quality: 0,
            totalProduced: 0, totalScrap: 0,
          });
          continue;
        }

        // Values from dashboard are already percentages (e.g. 85.0 = 85%)
        // Weighted average by operating minutes
        let totalOp = 0, sumA = 0, sumP = 0, sumQ = 0, totalProd = 0, totalScrap = 0;
        for (const ws of arr) {
          const op = ws.operatingMinutes || 1;
          totalOp += op;
          sumA += ws.availability * op;
          sumP += ws.performance * op;
          sumQ += ws.quality * op;
          totalProd += ws.totalProduced;
          totalScrap += ws.totalScrap;
        }

        siteOees.push({
          siteId: site.id,
          siteName: site.name,
          location: site.location,
          // Values are already percentages, just compute weighted average
          oee: oeeResult?.siteOee ?? 0,
          availability: totalOp > 0 ? Math.round((sumA / totalOp) * 10) / 10 : 0,
          performance: totalOp > 0 ? Math.round((sumP / totalOp) * 10) / 10 : 0,
          quality: totalOp > 0 ? Math.round((sumQ / totalOp) * 10) / 10 : 0,
          totalProduced: totalProd,
          totalScrap: totalScrap,
        });
      } catch (e) {
        console.error(`OEE calculation failed for site ${site.id}:`, e);
        siteOees.push({
          siteId: site.id, siteName: site.name, location: site.location,
          oee: 0, availability: 0, performance: 0, quality: 0,
          totalProduced: 0, totalScrap: 0,
        });
      }
    }

    // Overall weighted average
    const totalProd = siteOees.reduce((s, o) => s + o.totalProduced, 0);
    const totalScrap = siteOees.reduce((s, o) => s + o.totalScrap, 0);
    // Only include sites with actual production data in the average
    const activeSites = siteOees.filter(s => s.totalProduced > 0 || s.oee > 0);
    const avgOee = activeSites.length > 0
      ? Math.round(activeSites.reduce((s, o) => s + o.oee, 0) / activeSites.length * 100) / 100
      : 0;

    return {
      overallOee: avgOee,
      totalProduced: totalProd,
      totalScrap: totalScrap,
      sites: siteOees,
    };
  }
}
