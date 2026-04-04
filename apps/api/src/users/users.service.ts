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
  async findAll(currentUser: { id: string; role: string; siteId: string; corporateId: string }, limit = 50, offset = 0) {
    const take = Math.min(Math.max(1, limit), 200);
    const skip = Math.max(0, offset);
    const where: any = {};

    if (currentUser.role === 'corporate_admin') {
      where.corporateId = currentUser.corporateId;
    } else if (currentUser.role === 'site_admin') {
      where.siteId = currentUser.siteId;
    } else {
      // Managers and below only see users at their site
      where.siteId = currentUser.siteId;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          customRoleId: true,
          customRole: { select: { name: true } },
          siteId: true,
          corporateId: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          site: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);

    // Flatten customRole.name to customRoleName for frontend convenience
    const mappedData = data.map(u => ({
      ...u,
      customRoleName: u.customRole?.name ?? null,
    }));

    return { data: mappedData, total, limit: take, offset: skip };
  }

  async findById(id: string, callerCorporateId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, corporateId: callerCorporateId },
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

  async update(id: string, dto: UpdateUserDto, currentUser: { role: string; corporateId: string }) {
    const target = await this.prisma.user.findFirst({ where: { id, corporateId: currentUser.corporateId } });
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

  async deactivate(id: string, callerCorporateId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, corporateId: callerCorporateId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** GDPR Art. 20 — Export all user data in machine-readable format */
  async exportUserData(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        siteId: true, corporateId: true, isActive: true, lastLogin: true, createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [
      productionRuns, fiveSAudits, kaizenIdeas, gembaWalks,
      gembaObservations, qualityInspections, safetyIncidents,
      maintenanceLogs, ciltChecks, auditLogs,
    ] = await Promise.all([
      this.prisma.productionRun.findMany({ where: { operatorId: userId }, select: { id: true, startedAt: true, endedAt: true, producedQuantity: true, scrapQuantity: true } }),
      this.prisma.fiveSAudit.findMany({ where: { auditorId: userId }, select: { id: true, area: true, status: true, percentage: true, createdAt: true } }),
      this.prisma.kaizenIdea.findMany({ where: { submittedById: userId }, select: { id: true, title: true, status: true, createdAt: true } }),
      this.prisma.gembaWalk.findMany({ where: { walkerId: userId }, select: { id: true, date: true, status: true } }),
      this.prisma.gembaObservation.findMany({ where: { observerId: userId }, select: { id: true, wasteCategory: true, description: true, status: true } }),
      this.prisma.qualityInspection.findMany({ where: { inspectorId: userId }, select: { id: true, status: true, createdAt: true } }),
      this.prisma.safetyIncident.findMany({ where: { reporterId: userId }, select: { id: true, title: true, type: true, severity: true, date: true } }),
      this.prisma.maintenanceLog.findMany({ where: { performedById: userId }, select: { id: true, type: true, description: true, performedAt: true } }),
      this.prisma.ciltCheck.findMany({ where: { operatorId: userId }, select: { id: true, date: true, shift: true } }),
      this.prisma.auditLog.findMany({ where: { userId }, select: { action: true, entityType: true, timestamp: true }, take: 100, orderBy: { timestamp: 'desc' } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      personalData: user,
      activityData: {
        productionRuns,
        fiveSAudits,
        kaizenIdeas,
        gembaWalks,
        gembaObservations,
        qualityInspections,
        safetyIncidents,
        maintenanceLogs,
        ciltChecks,
      },
      auditLog: auditLogs,
    };
  }

  /** GDPR Art. 17 — Anonymize user and delete non-essential data */
  async gdprDelete(userId: string, callerCorporateId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, corporateId: callerCorporateId } });
    if (!user) throw new NotFoundException('User not found');

    // 1. Delete non-essential data
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.prisma.passwordResetToken.deleteMany({ where: { email: user.email } });
    await this.prisma.notification.deleteMany({ where: { userId } });
    await this.prisma.userSkill.deleteMany({ where: { userId } });

    // 2. Anonymize the user record (keep for foreign key integrity on compliance records)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@leanpilot.local`,
        firstName: '[Deleted]',
        lastName: '[User]',
        password: 'DELETED',
        isActive: false,
        customRoleId: null,
      },
    });

    return { anonymized: true, userId };
  }
}
