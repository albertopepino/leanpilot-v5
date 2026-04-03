import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LEVEL_HIERARCHY } from '../roles/permission.constants';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(private prisma: PrismaService) {}

  // ── CRUD ────────────────────────────────────────────────

  async findAllBySite(siteId: string) {
    return this.prisma.escalationRule.findMany({
      where: { siteId },
      orderBy: [{ triggerType: 'asc' }, { escalationTier: 'asc' }],
    });
  }

  async findById(id: string) {
    const rule = await this.prisma.escalationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Escalation rule not found');
    return rule;
  }

  async create(siteId: string, data: {
    name: string;
    triggerType: string;
    conditionMinutes: number;
    notifyGroup: string;
    notifyLevel: string;
    escalationTier?: number;
  }) {
    return this.prisma.escalationRule.create({
      data: {
        siteId,
        name: data.name,
        triggerType: data.triggerType,
        conditionMinutes: data.conditionMinutes,
        notifyGroup: data.notifyGroup,
        notifyLevel: data.notifyLevel,
        escalationTier: data.escalationTier ?? 1,
      },
    });
  }

  async update(id: string, siteId: string, data: {
    name?: string;
    triggerType?: string;
    conditionMinutes?: number;
    notifyGroup?: string;
    notifyLevel?: string;
    escalationTier?: number;
    isActive?: boolean;
  }) {
    const rule = await this.findById(id);
    if (rule.siteId !== siteId) throw new NotFoundException('Escalation rule not found');

    return this.prisma.escalationRule.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, siteId: string) {
    const rule = await this.findById(id);
    if (rule.siteId !== siteId) throw new NotFoundException('Escalation rule not found');

    await this.prisma.escalationRule.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Escalation Check: Breakdowns ──────────────────────

  async checkBreakdowns(siteId: string) {
    const rules = await this.prisma.escalationRule.findMany({
      where: { siteId, triggerType: 'breakdown', isActive: true },
    });
    if (rules.length === 0) return;

    // Find all workstations in this site
    const workstations = await this.prisma.workstation.findMany({
      where: { siteId, isActive: true },
      select: { id: true, name: true },
    });

    for (const ws of workstations) {
      // Get the latest event for this workstation
      const lastEvent = await this.prisma.workstationEvent.findFirst({
        where: { workstationId: ws.id, eventType: 'status_change', status: { not: null } },
        orderBy: { timestamp: 'desc' },
      });

      if (!lastEvent || lastEvent.status !== 'breakdown') continue;

      const breakdownMinutes = Math.floor(
        (Date.now() - lastEvent.timestamp.getTime()) / 60000,
      );

      for (const rule of rules) {
        if (breakdownMinutes < rule.conditionMinutes) continue;

        // Check if already escalated for this rule+workstation
        const existing = await this.prisma.escalationLog.findUnique({
          where: { ruleId_sourceId: { ruleId: rule.id, sourceId: ws.id } },
        });
        if (existing) continue;

        // Find users to notify
        const users = await this.findUsersWithPermission(
          siteId,
          rule.notifyGroup,
          rule.notifyLevel,
        );

        // Create notifications
        for (const user of users) {
          await this.prisma.notification.create({
            data: {
              siteId,
              userId: user.id,
              type: 'escalation',
              title: `Breakdown Alert L${rule.escalationTier}`,
              message: `${ws.name} has been down for ${breakdownMinutes} min`,
              sourceType: 'workstation',
              sourceId: ws.id,
            },
          });
        }

        // Log escalation
        await this.prisma.escalationLog.create({
          data: { ruleId: rule.id, sourceType: 'workstation', sourceId: ws.id },
        });

        this.logger.log(
          `Escalation L${rule.escalationTier}: ${ws.name} down ${breakdownMinutes}m — notified ${users.length} users`,
        );
      }
    }
  }

  // ── Escalation Check: Safety Incidents ────────────────

  async checkSafetyIncidents(siteId: string) {
    const rules = await this.prisma.escalationRule.findMany({
      where: { siteId, triggerType: 'safety_incident', isActive: true },
    });
    if (rules.length === 0) return;

    // Find serious/critical safety incidents that are still open
    const incidents = await this.prisma.safetyIncident.findMany({
      where: {
        siteId,
        severity: { in: ['serious', 'critical'] },
        status: { notIn: ['closed'] },
      },
      select: { id: true, title: true, severity: true, date: true },
    });

    for (const incident of incidents) {
      const minutesSince = Math.floor(
        (Date.now() - incident.date.getTime()) / 60000,
      );

      for (const rule of rules) {
        if (minutesSince < rule.conditionMinutes) continue;

        const existing = await this.prisma.escalationLog.findUnique({
          where: { ruleId_sourceId: { ruleId: rule.id, sourceId: incident.id } },
        });
        if (existing) continue;

        const users = await this.findUsersWithPermission(
          siteId,
          rule.notifyGroup,
          rule.notifyLevel,
        );

        for (const user of users) {
          await this.prisma.notification.create({
            data: {
              siteId,
              userId: user.id,
              type: 'escalation',
              title: `Safety Alert L${rule.escalationTier}: ${incident.severity.toUpperCase()}`,
              message: `${incident.title} — requires immediate attention`,
              sourceType: 'safety_incident',
              sourceId: incident.id,
            },
          });
        }

        await this.prisma.escalationLog.create({
          data: { ruleId: rule.id, sourceType: 'safety_incident', sourceId: incident.id },
        });

        this.logger.log(
          `Escalation L${rule.escalationTier}: Safety "${incident.title}" (${incident.severity}) — notified ${users.length} users`,
        );
      }
    }
  }

  // ── Escalation Check: Overdue Actions ─────────────────

  async checkOverdueActions(siteId: string) {
    const rules = await this.prisma.escalationRule.findMany({
      where: { siteId, triggerType: 'action_overdue', isActive: true },
    });
    if (rules.length === 0) return;

    // Find actions that are past due and not completed/cancelled
    const actions = await this.prisma.action.findMany({
      where: {
        siteId,
        status: { in: ['open', 'in_progress', 'overdue'] },
        dueDate: { lt: new Date() },
      },
      select: { id: true, title: true, dueDate: true },
    });

    for (const action of actions) {
      const overdueMinutes = Math.floor(
        (Date.now() - action.dueDate.getTime()) / 60000,
      );

      for (const rule of rules) {
        if (overdueMinutes < rule.conditionMinutes) continue;

        const existing = await this.prisma.escalationLog.findUnique({
          where: { ruleId_sourceId: { ruleId: rule.id, sourceId: action.id } },
        });
        if (existing) continue;

        const users = await this.findUsersWithPermission(
          siteId,
          rule.notifyGroup,
          rule.notifyLevel,
        );

        for (const user of users) {
          await this.prisma.notification.create({
            data: {
              siteId,
              userId: user.id,
              type: 'escalation',
              title: `Overdue Action L${rule.escalationTier}`,
              message: `"${action.title}" is overdue by ${Math.floor(overdueMinutes / 60)}h`,
              sourceType: 'action',
              sourceId: action.id,
            },
          });
        }

        await this.prisma.escalationLog.create({
          data: { ruleId: rule.id, sourceType: 'action', sourceId: action.id },
        });

        this.logger.log(
          `Escalation L${rule.escalationTier}: Action "${action.title}" overdue ${Math.floor(overdueMinutes / 60)}h — notified ${users.length} users`,
        );
      }
    }
  }

  // ── Clear escalation logs (when breakdown resolved) ───

  async clearEscalationLog(sourceType: string, sourceId: string) {
    await this.prisma.escalationLog.deleteMany({
      where: { sourceType, sourceId },
    });
  }

  // ── Helper: find users with a permission level or higher ──

  private async findUsersWithPermission(
    siteId: string,
    featureGroup: string,
    minLevel: string,
  ): Promise<{ id: string }[]> {
    const minLevelNum = LEVEL_HIERARCHY[minLevel] || 0;

    // System admins (corporate_admin, site_admin) always have manage-level access
    const systemAdmins = await this.prisma.user.findMany({
      where: {
        siteId,
        isActive: true,
        role: { in: ['corporate_admin', 'site_admin'] },
      },
      select: { id: true },
    });

    // Users with custom roles that have the required permission level
    const customRoleUsers = await this.prisma.user.findMany({
      where: {
        siteId,
        isActive: true,
        customRoleId: { not: null },
        customRole: {
          permissions: {
            some: {
              featureGroup,
              level: { in: this.levelsAtOrAbove(minLevelNum) },
            },
          },
        },
      },
      select: { id: true },
    });

    // Deduplicate
    const seen = new Set<string>();
    const result: { id: string }[] = [];
    for (const u of [...systemAdmins, ...customRoleUsers]) {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        result.push(u);
      }
    }

    return result;
  }

  private levelsAtOrAbove(minNum: number): string[] {
    return Object.entries(LEVEL_HIERARCHY)
      .filter(([, num]) => num >= minNum)
      .map(([level]) => level);
  }
}
