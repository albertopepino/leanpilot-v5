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

    const nowMs = Date.now();
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
      // Account for the last event's duration up to now
      const lastEvent = wsEvents[wsEvents.length - 1];
      if (lastEvent?.status && lastEvent.status !== 'running') {
        const durationMs = nowMs - new Date(lastEvent.timestamp).getTime();
        const hours = durationMs / (1000 * 60 * 60);
        if (losses[lastEvent.status] !== undefined) {
          losses[lastEvent.status] += hours;
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

  /** OEE: Availability × Performance × Quality per workstation */
  async getOee(siteId: string, workstationId?: string, period = 'week') {
    const now = new Date();
    const periodMs = period === 'day' ? 24 * 60 * 60 * 1000
      : period === 'month' ? 30 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;
    const since = new Date(now.getTime() - periodMs);

    const wsFilter = workstationId
      ? { id: workstationId, siteId }
      : { siteId, isActive: true };

    const workstations = await this.prisma.workstation.findMany({ where: wsFilter });
    const results: Array<{
      workstationId: string; workstationName: string; workstationCode: string;
      availability: number; performance: number; quality: number; oee: number;
      totalProduced: number; totalScrap: number; operatingMinutes: number; downtimeMinutes: number;
    }> = [];

    for (const ws of workstations) {
      // Get completed runs for this workstation in the period
      const runs = await this.prisma.productionRun.findMany({
        where: {
          workstationId: ws.id,
          startedAt: { gte: since },
          status: 'completed',
        },
        include: {
          phase: { select: { cycleTimeSeconds: true } },
        },
      });

      // Get status events for availability calculation
      const events = await this.prisma.workstationEvent.findMany({
        where: {
          workstationId: ws.id,
          eventType: 'status_change',
          timestamp: { gte: since },
        },
        orderBy: { timestamp: 'asc' },
      });

      // Calculate planned time (assume shifts cover the period, simplified)
      const shifts = await this.prisma.shiftDefinition.findMany({
        where: { siteId, isActive: true },
      });
      // Sum shift hours per day × days in period
      let dailyShiftHours = 0;
      for (const s of shifts) {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        let shiftDuration = (eh + em / 60) - (sh + sm / 60);
        if (shiftDuration < 0) shiftDuration += 24; // crosses midnight (night shift)
        dailyShiftHours += shiftDuration;
      }
      const days = periodMs / (24 * 60 * 60 * 1000);
      const plannedMinutes = dailyShiftHours * 60 * days;

      // Calculate downtime from events (non-running, non-idle, non-planned_stop)
      let downtimeMinutes = 0;
      for (let i = 0; i < events.length - 1; i++) {
        const e = events[i];
        if (e.status && e.status !== 'running' && e.status !== 'idle' && e.status !== 'planned_stop') {
          const duration = (new Date(events[i + 1].timestamp).getTime() - new Date(e.timestamp).getTime()) / 60000;
          downtimeMinutes += duration;
        }
      }
      // Account for last event duration up to now
      if (events.length > 0) {
        const last = events[events.length - 1];
        if (last.status && last.status !== 'running' && last.status !== 'idle' && last.status !== 'planned_stop') {
          downtimeMinutes += (Date.now() - new Date(last.timestamp).getTime()) / 60000;
        }
      }

      const operatingMinutes = Math.max(0, plannedMinutes - downtimeMinutes);

      // Availability
      const availability = plannedMinutes > 0 ? operatingMinutes / plannedMinutes : 0;

      // Performance: (ideal cycle time × produced per run, summed) / operating time
      const totalProduced = runs.reduce((s, r) => s + r.producedQuantity, 0);
      const totalScrap = runs.reduce((s, r) => s + r.scrapQuantity, 0);
      // Quantity-weighted ideal time: sum of (cycleTime × produced) per run
      const idealRunMinutes = runs.reduce(
        (s, r) => s + ((r.phase.cycleTimeSeconds || 60) * r.producedQuantity), 0,
      ) / 60;
      const performance = operatingMinutes > 0 ? Math.min(1, idealRunMinutes / operatingMinutes) : 0;

      // Quality
      const goodCount = totalProduced - totalScrap;
      const quality = totalProduced > 0 ? goodCount / totalProduced : 1;

      // OEE
      const oee = availability * performance * quality;

      results.push({
        workstationId: ws.id,
        workstationName: ws.name,
        workstationCode: ws.code,
        availability: Math.round(availability * 1000) / 10,
        performance: Math.round(performance * 1000) / 10,
        quality: Math.round(quality * 1000) / 10,
        oee: Math.round(oee * 1000) / 10,
        totalProduced,
        totalScrap,
        operatingMinutes: Math.round(operatingMinutes),
        downtimeMinutes: Math.round(downtimeMinutes),
      });
    }

    return {
      period,
      since: since.toISOString(),
      workstations: results,
      siteOee: results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.oee, 0) / results.length * 10) / 10
        : 0,
    };
  }
}
