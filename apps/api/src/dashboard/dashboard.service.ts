import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  /** Overview: Losses + Attention signals */
  async getOverview(siteId: string) {
    const cacheKey = `dashboard:overview:${siteId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

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

    const result = {
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
    await this.cache.set(cacheKey, result, 30000);
    return result;
  }

  /** Shift Handover: summary of last N hours across all workstations */
  async getShiftHandover(siteId: string, hours = 8) {
    const cacheKey = `dashboard:handover:${siteId}:${hours}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // All active workstations
    const workstations = await this.prisma.workstation.findMany({
      where: { siteId, isActive: true },
      orderBy: { name: 'asc' },
    });

    // Build per-workstation summary
    const workstationSummaries = await Promise.all(
      workstations.map(async (ws) => {
        // Current status (last status_change event)
        const lastStatusEvent = await this.prisma.workstationEvent.findFirst({
          where: { workstationId: ws.id, eventType: 'status_change' },
          orderBy: { timestamp: 'desc' },
        });

        // Active production run
        const activeRun = await this.prisma.productionRun.findFirst({
          where: { workstationId: ws.id, status: 'active' },
          include: {
            phase: {
              include: { order: { select: { poNumber: true, productName: true } } },
            },
          },
        });

        // Runs this shift
        const shiftRuns = await this.prisma.productionRun.findMany({
          where: {
            workstationId: ws.id,
            startedAt: { gte: since },
          },
          include: {
            phase: {
              include: { order: { select: { poNumber: true, productName: true } } },
            },
          },
        });

        const produced = shiftRuns.reduce((s, r) => s + r.producedQuantity, 0);
        const scrap = shiftRuns.reduce((s, r) => s + r.scrapQuantity, 0);

        // Status changes this shift (breakdowns, changeovers, etc.)
        const statusChanges = await this.prisma.workstationEvent.findMany({
          where: {
            workstationId: ws.id,
            eventType: 'status_change',
            timestamp: { gte: since },
            status: { in: ['breakdown', 'changeover', 'quality_hold', 'maintenance'] },
          },
          orderBy: { timestamp: 'desc' },
          include: { operator: { select: { firstName: true, lastName: true } } },
        });

        // Handover notes from completed runs
        const completedRuns = shiftRuns.filter(r => r.status === 'completed' && r.phase?.order);
        const handoverNotes = await Promise.all(
          completedRuns.map(async (r) => {
            // Get last event with notes for this run (po_end or status_change)
            const lastNote = await this.prisma.workstationEvent.findFirst({
              where: { productionRunId: r.id, notes: { not: null } },
              orderBy: { timestamp: 'desc' },
              select: { notes: true },
            });
            return {
              poNumber: r.phase.order.poNumber,
              productName: r.phase.order.productName,
              produced: r.producedQuantity,
              scrap: r.scrapQuantity,
              notes: lastNote?.notes || null,
            };
          }),
        );

        return {
          workstationId: ws.id,
          workstationName: ws.name,
          workstationCode: ws.code,
          area: ws.area,
          equipmentStatus: ws.equipmentStatus,
          currentStatus: lastStatusEvent?.status || 'idle',
          currentPO: activeRun?.phase?.order
            ? { poNumber: activeRun.phase.order.poNumber, productName: activeRun.phase.order.productName }
            : null,
          produced,
          scrap,
          statusChanges: statusChanges.map(e => ({
            status: e.status,
            reasonCode: e.reasonCode,
            notes: e.notes,
            timestamp: e.timestamp,
            operator: e.operator ? `${e.operator.firstName} ${e.operator.lastName}` : null,
          })),
          handoverNotes,
        };
      }),
    );

    // Open NCRs from this shift
    const ncrs = await this.prisma.nonConformanceReport.findMany({
      where: {
        siteId,
        createdAt: { gte: since },
        status: { not: 'closed' },
      },
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        description: true,
        defectQuantity: true,
        createdAt: true,
        workstation: { select: { name: true, code: true } },
        reporter: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Safety incidents from this shift
    const safetyIncidents = await this.prisma.safetyIncident.findMany({
      where: {
        siteId,
        createdAt: { gte: since },
      },
      select: {
        id: true,
        title: true,
        type: true,
        severity: true,
        outcome: true,
        status: true,
        location: true,
        createdAt: true,
        reporter: { select: { firstName: true, lastName: true } },
        workstation: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Breakdowns this shift
    const breakdowns = workstationSummaries.flatMap(ws =>
      ws.statusChanges
        .filter(e => e.status === 'breakdown')
        .map(e => ({ ...e, workstationName: ws.workstationName, workstationCode: ws.workstationCode })),
    );

    const result = {
      period: { since: since.toISOString(), hours },
      workstations: workstationSummaries,
      attentionItems: {
        breakdowns,
        ncrs,
        safetyIncidents,
      },
      totals: {
        totalProduced: workstationSummaries.reduce((s, w) => s + w.produced, 0),
        totalScrap: workstationSummaries.reduce((s, w) => s + w.scrap, 0),
        workstationsRunning: workstationSummaries.filter(w => w.currentStatus === 'running').length,
        workstationsDown: workstationSummaries.filter(w => w.currentStatus === 'breakdown').length,
        totalWorkstations: workstations.length,
      },
    };
    await this.cache.set(cacheKey, result, 15000);
    return result;
  }

  /** OEE: Availability × Performance × Quality per workstation */
  async getOee(siteId: string, workstationId?: string, period = 'week') {
    const cacheKey = `dashboard:oee:${siteId}:${workstationId || 'all'}:${period}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

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
      totalProduced: number; totalScrap: number; plannedMinutes: number; operatingMinutes: number; downtimeMinutes: number;
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

      // Planned production time from workstation's plannedHoursPerDay
      const days = periodMs / (24 * 60 * 60 * 1000);
      const plannedMinutes = (ws.plannedHoursPerDay ?? 8) * 60 * days;

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
        plannedMinutes: Math.round(plannedMinutes),
        operatingMinutes: Math.round(operatingMinutes),
        downtimeMinutes: Math.round(downtimeMinutes),
      });
    }

    const result = {
      period,
      since: since.toISOString(),
      workstations: results,
      siteOee: results.length > 0
        ? {
            availability: Math.round(results.reduce((s, r) => s + r.availability, 0) / results.length * 10) / 10,
            performance: Math.round(results.reduce((s, r) => s + r.performance, 0) / results.length * 10) / 10,
            quality: Math.round(results.reduce((s, r) => s + r.quality, 0) / results.length * 10) / 10,
            oee: Math.round(results.reduce((s, r) => s + r.oee, 0) / results.length * 10) / 10,
          }
        : { availability: 0, performance: 0, quality: 0, oee: 0 },
    };
    await this.cache.set(cacheKey, result, 60000);
    return result;
  }

  /** OEE Trend: daily/weekly data points over a period */
  async getOeeTrend(siteId: string, workstationId?: string, period = '30d', granularity: 'day' | 'week' = 'day') {
    const cacheKey = `dashboard:oee-trend:${siteId}:${workstationId || 'all'}:${period}:${granularity}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Parse period string (7d, 30d, 90d)
    const periodMatch = period.match(/^(\d+)d$/);
    const days = periodMatch ? parseInt(periodMatch[1], 10) : 30;
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const wsFilter = workstationId
      ? { id: workstationId, siteId }
      : { siteId, isActive: true };

    const workstations = await this.prisma.workstation.findMany({ where: wsFilter });

    // Build time buckets
    const buckets: Array<{ start: Date; end: Date; label: string }> = [];
    if (granularity === 'week') {
      const current = new Date(startDate);
      while (current < now) {
        const bucketEnd = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
        buckets.push({
          start: new Date(current),
          end: bucketEnd > now ? now : bucketEnd,
          label: current.toISOString().split('T')[0],
        });
        current.setTime(current.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    } else {
      const current = new Date(startDate);
      while (current < now) {
        const bucketEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000);
        buckets.push({
          start: new Date(current),
          end: bucketEnd > now ? now : bucketEnd,
          label: current.toISOString().split('T')[0],
        });
        current.setTime(current.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    // Pre-fetch all runs and events for the entire period for efficiency
    const allRuns = await this.prisma.productionRun.findMany({
      where: {
        workstationId: { in: workstations.map((w) => w.id) },
        startedAt: { gte: startDate },
        status: 'completed',
      },
      include: { phase: { select: { cycleTimeSeconds: true } } },
    });

    const allEvents = await this.prisma.workstationEvent.findMany({
      where: {
        workstationId: { in: workstations.map((w) => w.id) },
        eventType: 'status_change',
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    const points: Array<{
      date: string;
      availability: number;
      performance: number;
      quality: number;
      oee: number;
    }> = [];

    for (const bucket of buckets) {
      const bucketStartMs = bucket.start.getTime();
      const bucketEndMs = bucket.end.getTime();
      const bucketDays = (bucketEndMs - bucketStartMs) / (24 * 60 * 60 * 1000);

      let totalPlannedMinutes = 0;
      let totalDowntimeMinutes = 0;
      let totalProduced = 0;
      let totalScrap = 0;
      let totalIdealRunMinutes = 0;

      for (const ws of workstations) {
        const plannedMinutes = (ws.plannedHoursPerDay ?? 8) * 60 * bucketDays;
        totalPlannedMinutes += plannedMinutes;

        // Filter events for this workstation and bucket
        const wsEvents = allEvents.filter(
          (e) => e.workstationId === ws.id &&
            new Date(e.timestamp).getTime() >= bucketStartMs &&
            new Date(e.timestamp).getTime() < bucketEndMs,
        );

        // Calculate downtime
        let downtimeMinutes = 0;
        for (let i = 0; i < wsEvents.length - 1; i++) {
          const e = wsEvents[i];
          if (e.status && e.status !== 'running' && e.status !== 'idle' && e.status !== 'planned_stop') {
            const duration = (new Date(wsEvents[i + 1].timestamp).getTime() - new Date(e.timestamp).getTime()) / 60000;
            downtimeMinutes += duration;
          }
        }
        if (wsEvents.length > 0) {
          const last = wsEvents[wsEvents.length - 1];
          if (last.status && last.status !== 'running' && last.status !== 'idle' && last.status !== 'planned_stop') {
            downtimeMinutes += (bucketEndMs - new Date(last.timestamp).getTime()) / 60000;
          }
        }
        totalDowntimeMinutes += downtimeMinutes;

        // Filter runs for this workstation and bucket
        const wsRuns = allRuns.filter(
          (r) => r.workstationId === ws.id &&
            new Date(r.startedAt).getTime() >= bucketStartMs &&
            new Date(r.startedAt).getTime() < bucketEndMs,
        );

        totalProduced += wsRuns.reduce((s, r) => s + r.producedQuantity, 0);
        totalScrap += wsRuns.reduce((s, r) => s + r.scrapQuantity, 0);
        totalIdealRunMinutes += wsRuns.reduce(
          (s, r) => s + ((r.phase.cycleTimeSeconds || 60) * r.producedQuantity), 0,
        ) / 60;
      }

      const operatingMinutes = Math.max(0, totalPlannedMinutes - totalDowntimeMinutes);
      const availability = totalPlannedMinutes > 0 ? operatingMinutes / totalPlannedMinutes : 0;
      const performance = operatingMinutes > 0 ? Math.min(1, totalIdealRunMinutes / operatingMinutes) : 0;
      const goodCount = totalProduced - totalScrap;
      const quality = totalProduced > 0 ? goodCount / totalProduced : 1;
      const oee = availability * performance * quality;

      points.push({
        date: bucket.label,
        availability: Math.round(availability * 1000) / 10,
        performance: Math.round(performance * 1000) / 10,
        quality: Math.round(quality * 1000) / 10,
        oee: Math.round(oee * 1000) / 10,
      });
    }

    const result = {
      points,
      insufficientData: points.length < 5,
    };
    await this.cache.set(cacheKey, result, 60000);
    return result;
  }

  /** Pareto / Loss waterfall: 6 big losses ranked by hours */
  async getPareto(siteId: string, period = 'week') {
    const cacheKey = `dashboard:pareto:${siteId}:${period}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const periodMs = period === 'day' ? 24 * 60 * 60 * 1000
      : period === 'month' ? 30 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;
    const since = new Date(now.getTime() - periodMs);
    const days = periodMs / (24 * 60 * 60 * 1000);

    const workstations = await this.prisma.workstation.findMany({
      where: { siteId, isActive: true },
    });

    // Accumulate the 6 big losses across all workstations
    let breakdownHours = 0;
    let changeoverHours = 0;
    let plannedStopHours = 0;
    let idleHours = 0;         // minor stops / idle
    let speedLossHours = 0;    // performance gap
    let qualityHoldHours = 0;  // time spent in quality hold (availability loss)
    let defectLossHours = 0;   // scrap × cycle time (quality loss)

    let totalPlannedHours = 0;

    for (const ws of workstations) {
      const plannedMinutes = (ws.plannedHoursPerDay ?? 8) * 60 * days;
      totalPlannedHours += plannedMinutes / 60;

      // Status events for time-based losses
      const events = await this.prisma.workstationEvent.findMany({
        where: {
          workstationId: ws.id,
          eventType: 'status_change',
          timestamp: { gte: since },
        },
        orderBy: { timestamp: 'asc' },
      });

      const nowMs = Date.now();
      const addDuration = (status: string, hours: number) => {
        switch (status) {
          case 'breakdown': breakdownHours += hours; break;
          case 'changeover': changeoverHours += hours; break;
          case 'planned_stop': plannedStopHours += hours; break;
          case 'idle': idleHours += hours; break;
          case 'maintenance': breakdownHours += hours; break; // maintenance downtime = breakdown category
          case 'quality_hold': qualityHoldHours += hours; break;
        }
      };

      for (let i = 0; i < events.length - 1; i++) {
        const e = events[i];
        if (e.status && e.status !== 'running') {
          const durationMs = new Date(events[i + 1].timestamp).getTime() - new Date(e.timestamp).getTime();
          addDuration(e.status, durationMs / (1000 * 60 * 60));
        }
      }
      if (events.length > 0) {
        const last = events[events.length - 1];
        if (last.status && last.status !== 'running') {
          const durationMs = nowMs - new Date(last.timestamp).getTime();
          addDuration(last.status, durationMs / (1000 * 60 * 60));
        }
      }

      // Production runs for speed loss and scrap loss
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

      // Speed loss = operating_time - ideal_run_time (performance gap)
      const downtimeMinutes = events.reduce((acc, e, i) => {
        if (e.status && e.status !== 'running' && e.status !== 'idle' && e.status !== 'planned_stop') {
          const endMs = i < events.length - 1
            ? new Date(events[i + 1].timestamp).getTime()
            : nowMs;
          return acc + (endMs - new Date(e.timestamp).getTime()) / 60000;
        }
        return acc;
      }, 0);
      const operatingMinutes = Math.max(0, plannedMinutes - downtimeMinutes);

      const idealRunMinutes = runs.reduce(
        (s, r) => s + ((r.phase.cycleTimeSeconds || 60) * r.producedQuantity), 0,
      ) / 60;

      if (operatingMinutes > idealRunMinutes) {
        speedLossHours += (operatingMinutes - idealRunMinutes) / 60;
      }

      // Scrap loss: scrap × ideal cycle time
      const scrapMinutes = runs.reduce(
        (s, r) => s + ((r.phase.cycleTimeSeconds || 60) * r.scrapQuantity), 0,
      ) / 60;
      defectLossHours += scrapMinutes / 60;
    }

    // Cap idle + speed loss so total losses cannot exceed planned hours
    const accountedLosses = breakdownHours + changeoverHours + plannedStopHours + qualityHoldHours + defectLossHours;
    const remainingPlanned = Math.max(0, totalPlannedHours - accountedLosses);
    const cappedIdleHours = Math.min(idleHours, remainingPlanned);
    const cappedSpeedLoss = Math.min(speedLossHours, Math.max(0, remainingPlanned - cappedIdleHours));

    // Build ranked array
    const losses = [
      { category: 'breakdown', label: 'Breakdown', hours: Math.round(breakdownHours * 10) / 10 },
      { category: 'changeover', label: 'Changeover', hours: Math.round(changeoverHours * 10) / 10 },
      { category: 'planned_stop', label: 'Planned stops', hours: Math.round(plannedStopHours * 10) / 10 },
      { category: 'idle', label: 'Minor stops / Idle', hours: Math.round(cappedIdleHours * 10) / 10 },
      { category: 'speed_loss', label: 'Speed loss', hours: Math.round(cappedSpeedLoss * 10) / 10 },
      { category: 'quality_hold', label: 'Quality hold', hours: Math.round(qualityHoldHours * 10) / 10 },
      { category: 'defect_loss', label: 'Defect / Scrap loss', hours: Math.round(defectLossHours * 10) / 10 },
    ].sort((a, b) => b.hours - a.hours);

    const totalLossHours = losses.reduce((s, l) => s + l.hours, 0);

    // Add cumulative percentage for Pareto chart
    let cumulative = 0;
    const ranked = losses.map((l) => {
      cumulative += l.hours;
      return {
        ...l,
        percentage: totalLossHours > 0 ? Math.round((l.hours / totalLossHours) * 1000) / 10 : 0,
        cumulativePercentage: totalLossHours > 0 ? Math.round((cumulative / totalLossHours) * 1000) / 10 : 0,
      };
    });

    const result = {
      period,
      since: since.toISOString(),
      totalPlannedHours: Math.round(totalPlannedHours * 10) / 10,
      totalLossHours: Math.round(totalLossHours * 10) / 10,
      losses: ranked,
    };
    await this.cache.set(cacheKey, result, 60000);
    return result;
  }
}
