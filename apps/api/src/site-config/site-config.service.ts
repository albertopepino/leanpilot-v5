import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_ROLES = ['corporate_admin', 'site_admin', 'manager', 'operator', 'viewer'];

const DEFAULT_TOOLS = [
  { toolSlug: 'dashboard', label: 'Dashboard', defaultMinRole: 'viewer', alwaysEnabled: true },
  { toolSlug: 'shift-handover', label: 'Shift Handover', defaultMinRole: 'operator' },
  { toolSlug: 'orders', label: 'Orders', defaultMinRole: 'operator' },
  { toolSlug: 'gemba', label: 'Gemba Walk', defaultMinRole: 'manager' },
  { toolSlug: 'five-s', label: '5S Audit', defaultMinRole: 'operator' },
  { toolSlug: 'kaizen', label: 'Kaizen Board', defaultMinRole: 'operator' },
  { toolSlug: 'actions', label: 'Actions', defaultMinRole: 'viewer' },
  { toolSlug: 'tier-meetings', label: 'Tier Meetings', defaultMinRole: 'manager' },
  { toolSlug: 'equipment', label: 'Equipment', defaultMinRole: 'operator' },
  { toolSlug: 'quality', label: 'Quality', defaultMinRole: 'operator' },
  { toolSlug: 'safety', label: 'Safety', defaultMinRole: 'operator' },
  { toolSlug: 'skills', label: 'Skills Matrix', defaultMinRole: 'manager' },
  { toolSlug: 'smed', label: 'SMED', defaultMinRole: 'operator' },
];

@Injectable()
export class SiteConfigService {
  constructor(private prisma: PrismaService) {}

  async getToolConfigs(siteId: string) {
    const dbConfigs = await this.prisma.siteToolConfig.findMany({
      where: { siteId },
    });

    const configMap = new Map(dbConfigs.map((c) => [c.toolSlug, c]));

    return DEFAULT_TOOLS.map((tool) => {
      const dbConfig = configMap.get(tool.toolSlug);
      return {
        toolSlug: tool.toolSlug,
        label: tool.label,
        isEnabled: dbConfig ? dbConfig.isEnabled : true,
        minRole: dbConfig ? dbConfig.minRole : tool.defaultMinRole,
        alwaysEnabled: tool.alwaysEnabled ?? false,
      };
    });
  }

  async updateToolConfigs(
    siteId: string,
    tools: Array<{ toolSlug: string; isEnabled: boolean; minRole: string }>,
  ) {
    const validSlugs = new Set(DEFAULT_TOOLS.map((t) => t.toolSlug));

    for (const tool of tools) {
      if (!validSlugs.has(tool.toolSlug)) {
        throw new BadRequestException(`Unknown tool slug: ${tool.toolSlug}`);
      }

      if (!VALID_ROLES.includes(tool.minRole)) {
        throw new BadRequestException(
          `Invalid minRole "${tool.minRole}". Must be one of: ${VALID_ROLES.join(', ')}`,
        );
      }

      const defaultTool = DEFAULT_TOOLS.find((t) => t.toolSlug === tool.toolSlug);
      if (defaultTool?.alwaysEnabled && !tool.isEnabled) {
        throw new BadRequestException(
          `Cannot disable "${tool.toolSlug}" — it is always enabled.`,
        );
      }
    }

    await Promise.all(
      tools.map((tool) =>
        this.prisma.siteToolConfig.upsert({
          where: {
            siteId_toolSlug: { siteId, toolSlug: tool.toolSlug },
          },
          create: {
            siteId,
            toolSlug: tool.toolSlug,
            isEnabled: tool.isEnabled,
            minRole: tool.minRole,
          },
          update: {
            isEnabled: tool.isEnabled,
            minRole: tool.minRole,
          },
        }),
      ),
    );

    return this.getToolConfigs(siteId);
  }
}
