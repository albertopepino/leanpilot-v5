import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /** Overview: Losses + Attention signals */
  async getOverview(siteId: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Workstation count and status
    const workstations = await this.prisma.workstation.findMany({
      where: { siteId, isActive: true },
    });

    // Get current status per workstation
    let machinesDown = 0;
    for (const ws of workstations) {
      const lastEvent = await this.prisma.workstationEvent.findFirst({
        where: { workstationId: ws.id, eventType: 'status_change' },
        orderBy: { timestamp: 'desc' },
      });
      if (lastEvent && lastEvent.status && lastEvent.status !== 'running' && lastEvent.status !== 'idle') {
        machinesDown++;
      }
    }

    // Losses this week: calculate from status_change events
    const events = await this.prisma.workstationEvent.findMany({
      where: {
        workstation: { siteId },
        eventType: 'status_change',
        timestamp: { gte: weekAgo },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Calculate time spent in each status
    const losses: Record<string, number> = {
      breakdown: 0,
      changeover: 0,
      planned_stop: 0,
      idle: 0,
      maintenance: 0,
      quality_hold: 0,
    };

    // Group events by workstation, calculate durations
    const byWorkstation: Record<string, typeof events> = {};
    for (const e of events) {
      if (!byWorkstation[e.workstationId]) byWorkstation[e.workstationId] = [];
      byWorkstation[e.workstationId].push(e);
    }

    for (const wsEvents of Object.values(byWorkstation)) {
      for (let i = 0; i < wsEvents.length - 1; i++) {
        const current = wsEvents[i];
        const next = wsEvents[i + 1];
        if (current.status && current.status !== 'running') {
          const durationMs = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
          const hours = durationMs / (1000 * 60 * 60);
          if (losses[current.status] !== undefined) {
            losses[current.status] += hours;
          }
        }
      }
    }

    // Round losses
    for (const key of Object.keys(losses)) {
      losses[key] = Math.round(losses[key] * 10) / 10;
    }
    const totalLossHours = Object.values(losses).reduce((a, b) => a + b, 0);

    // Production runs this week
    const runs = await this.prisma.productionRun.findMany({
      where: {
        workstation: { siteId },
        startedAt: { gte: weekAgo },
        status: 'completed',
      },
    });
    const totalProduced = runs.reduce((sum, r) => sum + r.producedQuantity, 0);
    const totalScrap = runs.reduce((sum, r) => sum + r.scrapQuantity, 0);
    const scrapRate = totalProduced > 0 ? Math.round((totalScrap / totalProduced) * 1000) / 10 : 0;

    // Open muda signals
    const mudaCount = await this.prisma.gembaObservation.count({
      where: {
        walk: { siteId },
        status: { in: ['open', 'investigating'] },
      },
    });

    // POs behind schedule
    const posBehind = await this.prisma.productionOrder.count({
      where: {
        siteId,
        status: { in: ['released', 'in_progress'] },
        dueDate: { lt: now },
      },
    });

    // Active POs
    const activePOs = await this.prisma.productionOrder.count({
      where: { siteId, status: 'in_progress' },
    });

    return {
      losses: {
        ...losses,
        totalHours: Math.round(totalLossHours * 10) / 10,
      },
      production: {
        totalProduced,
        totalScrap,
        scrapRate,
      },
      attention: {
        machinesDown,
        mudaSignals: mudaCount,
        posBehind,
        activePOs,
        totalWorkstations: workstations.length,
      },
    };
  }
}
