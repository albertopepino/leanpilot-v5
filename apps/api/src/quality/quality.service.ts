import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const NCR_STATUSES = ['open', 'containment', 'investigation', 'corrective', 'verification', 'closed'];
const MIN_SPC_POINTS = 5;

@Injectable()
export class QualityService {
  constructor(private prisma: PrismaService) {}

  // ── Templates ────────────────────────────────────────────────────

  async getTemplates(siteId: string) {
    return this.prisma.qualityTemplate.findMany({
      where: { siteId, isActive: true },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { checkpoints: true, inspections: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTemplate(id: string, siteId: string) {
    const tpl = await this.prisma.qualityTemplate.findFirst({
      where: { id, siteId },
      include: {
        checkpoints: { orderBy: { sequence: 'asc' } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  async createTemplate(siteId: string, createdById: string, data: {
    name: string;
    productName?: string;
    phase?: string;
    checkpoints: Array<{
      sequence: number;
      description: string;
      measurementType?: string;
      unit?: string;
      lowerLimit?: number;
      upperLimit?: number;
      targetValue?: number;
      isRequired?: boolean;
    }>;
  }) {
    return this.prisma.qualityTemplate.create({
      data: {
        siteId,
        createdById,
        name: data.name,
        productName: data.productName,
        phase: data.phase,
        checkpoints: {
          create: data.checkpoints.map(cp => ({
            sequence: cp.sequence,
            description: cp.description,
            measurementType: cp.measurementType || 'pass_fail',
            unit: cp.unit,
            lowerLimit: cp.lowerLimit,
            upperLimit: cp.upperLimit,
            targetValue: cp.targetValue,
            isRequired: cp.isRequired ?? true,
          })),
        },
      },
      include: { checkpoints: { orderBy: { sequence: 'asc' } } },
    });
  }

  // ── Inspections ──────────────────────────────────────────────────

  async getInspections(siteId: string) {
    return this.prisma.qualityInspection.findMany({
      where: { siteId },
      include: {
        template: { select: { name: true } },
        inspector: { select: { firstName: true, lastName: true } },
        workstation: { select: { name: true, code: true } },
        _count: { select: { results: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInspection(id: string, siteId: string) {
    const insp = await this.prisma.qualityInspection.findFirst({
      where: { id, siteId },
      include: {
        template: { include: { checkpoints: { orderBy: { sequence: 'asc' } } } },
        inspector: { select: { firstName: true, lastName: true } },
        workstation: { select: { name: true, code: true } },
        results: {
          include: { checkpoint: true },
          orderBy: { checkpoint: { sequence: 'asc' } },
        },
      },
    });
    if (!insp) throw new NotFoundException('Inspection not found');
    return insp;
  }

  async createInspection(siteId: string, inspectorId: string, data: {
    templateId: string;
    workstationId: string;
    orderId?: string;
    phaseId?: string;
  }) {
    // Verify template belongs to site
    const tpl = await this.prisma.qualityTemplate.findFirst({ where: { id: data.templateId, siteId } });
    if (!tpl) throw new NotFoundException('Template not found');

    // Verify workstationId belongs to site
    if (data.workstationId) {
      const ws = await this.prisma.workstation.findFirst({ where: { id: data.workstationId, siteId } });
      if (!ws) throw new BadRequestException('Workstation does not belong to this site');
    }

    return this.prisma.qualityInspection.create({
      data: { siteId, inspectorId, ...data },
      include: {
        template: { include: { checkpoints: { orderBy: { sequence: 'asc' } } } },
        inspector: { select: { firstName: true, lastName: true } },
        results: { include: { checkpoint: true } },
      },
    });
  }

  async submitResults(inspectionId: string, siteId: string, results: Array<{
    checkpointId: string;
    value: string;
    passed: boolean;
    notes?: string;
    photoUrl?: string;
  }>) {
    // Verify ownership
    const insp = await this.prisma.qualityInspection.findFirst({ where: { id: inspectionId, siteId } });
    if (!insp) throw new NotFoundException('Inspection not found');
    if (insp.status === 'passed' || insp.status === 'failed') {
      throw new BadRequestException('Cannot modify results on a completed inspection');
    }

    // Validate all checkpoint IDs belong to this inspection's template
    const validCheckpoints = await this.prisma.qualityCheckpoint.findMany({
      where: { templateId: insp.templateId },
      select: { id: true },
    });
    const validIds = new Set(validCheckpoints.map(c => c.id));
    for (const r of results) {
      if (!validIds.has(r.checkpointId)) {
        throw new BadRequestException(`Checkpoint ${r.checkpointId} does not belong to this inspection's template`);
      }
    }

    // Upsert results
    for (const r of results) {
      await this.prisma.qualityResult.upsert({
        where: { inspectionId_checkpointId: { inspectionId, checkpointId: r.checkpointId } },
        create: { inspectionId, ...r },
        update: { value: r.value, passed: r.passed, notes: r.notes, photoUrl: r.photoUrl },
      });
    }

    // Calculate overall status
    const allResults = await this.prisma.qualityResult.findMany({ where: { inspectionId } });
    const totalCheckpoints = await this.prisma.qualityCheckpoint.count({ where: { templateId: insp.templateId } });
    const allPassed = allResults.length >= totalCheckpoints && allResults.every(r => r.passed);
    const anyFailed = allResults.some(r => !r.passed);
    // conditional = partial results submitted (not all checkpoints filled) with no failures yet
    const status = allPassed ? 'passed' : anyFailed ? 'failed' : 'conditional';

    return this.prisma.qualityInspection.update({
      where: { id: inspectionId },
      data: { status, completedAt: allPassed || anyFailed ? new Date() : null },
      include: { results: true },
    });
  }

  // ── NCR ──────────────────────────────────────────────────────────

  async getNcrs(siteId: string) {
    return this.prisma.nonConformanceReport.findMany({
      where: { siteId },
      include: {
        reporter: { select: { firstName: true, lastName: true } },
        workstation: { select: { name: true, code: true } },
        order: { select: { poNumber: true, productName: true } },
        _count: { select: { attachments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNcr(id: string, siteId: string) {
    const ncr = await this.prisma.nonConformanceReport.findFirst({
      where: { id, siteId },
      include: {
        reporter: { select: { firstName: true, lastName: true } },
        verifiedBy: { select: { firstName: true, lastName: true } },
        workstation: { select: { name: true, code: true } },
        order: { select: { id: true, poNumber: true, productName: true } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!ncr) throw new NotFoundException('NCR not found');
    return ncr;
  }

  async createNcr(siteId: string, reporterId: string, data: {
    title?: string;
    severity: string;
    description: string;
    defectQuantity?: number;
    workstationId?: string;
    orderId?: string;
  }) {
    const validSeverities = ['minor', 'major', 'critical'];
    if (!validSeverities.includes(data.severity)) {
      throw new BadRequestException('Invalid severity');
    }
    // Verify optional workstationId belongs to site
    if (data.workstationId) {
      const ws = await this.prisma.workstation.findFirst({ where: { id: data.workstationId, siteId } });
      if (!ws) throw new BadRequestException('Workstation does not belong to this site');
    }
    // Verify optional orderId belongs to site
    if (data.orderId) {
      const order = await this.prisma.productionOrder.findFirst({ where: { id: data.orderId, siteId } });
      if (!order) throw new BadRequestException('Order does not belong to this site');
    }
    return this.prisma.nonConformanceReport.create({
      data: { siteId, reporterId, ...data },
      include: {
        reporter: { select: { firstName: true, lastName: true } },
        order: { select: { poNumber: true, productName: true } },
      },
    });
  }

  async updateNcr(id: string, siteId: string, data: {
    rootCause?: string;
    containmentAction?: string;
    correctiveAction?: string;
    preventiveAction?: string;
    status?: string;
    verifiedById?: string;
  }) {
    const ncr = await this.prisma.nonConformanceReport.findFirst({ where: { id, siteId } });
    if (!ncr) throw new NotFoundException('NCR not found');

    if (data.status && !NCR_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${NCR_STATUSES.join(', ')}`);
    }

    const updateData: any = { ...data };
    if (data.status === 'closed') updateData.closedAt = new Date();

    return this.prisma.nonConformanceReport.update({
      where: { id },
      data: updateData,
      include: {
        reporter: { select: { firstName: true, lastName: true } },
        verifiedBy: { select: { firstName: true, lastName: true } },
        attachments: true,
      },
    });
  }

  async addAttachment(ncrId: string, siteId: string, uploadedById: string, fileName: string, fileUrl: string) {
    // Verify NCR belongs to site
    const ncr = await this.prisma.nonConformanceReport.findFirst({ where: { id: ncrId, siteId } });
    if (!ncr) throw new NotFoundException('NCR not found');

    // Validate fileUrl belongs to our S3 bucket (prevent arbitrary URL injection)
    const allowedPrefix = 'https://nbg1.your-objectstorage.com/leanos/';
    if (!fileUrl.startsWith(allowedPrefix)) {
      throw new BadRequestException('File URL must be from the LeanPilot storage service');
    }

    return this.prisma.ncrAttachment.create({
      data: { ncrId, uploadedById, fileName, fileUrl },
    });
  }

  // ── SPC ──────────────────────────────────────────────────────────

  async getSpcData(checkpointId: string, siteId: string, limit = 50) {
    limit = Math.min(Math.max(1, limit), 500); // Cap between 1-500
    const results = await this.prisma.qualityResult.findMany({
      where: {
        checkpointId,
        checkpoint: { measurementType: 'measurement', template: { siteId } },
      },
      include: {
        inspection: { select: { createdAt: true, workstation: { select: { name: true } } } },
      },
      orderBy: { inspection: { createdAt: 'asc' } },
      take: limit,
    });

    const values = results
      .map(r => parseFloat(r.value))
      .filter(v => !isNaN(v));

    if (values.length < 2) {
      return { values: [], mean: 0, ucl: 0, lcl: 0, cp: 0, cpk: 0, count: 0, points: [], warning: 'insufficient_data' };
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1));
    const ucl = mean + 3 * stdDev;
    const lcl = mean - 3 * stdDev;

    const checkpoint = await this.prisma.qualityCheckpoint.findUnique({ where: { id: checkpointId } });
    let cp = 0, cpk = 0;
    if (checkpoint?.upperLimit != null && checkpoint?.lowerLimit != null && stdDev > 0) {
      const usl = checkpoint.upperLimit;
      const lsl = checkpoint.lowerLimit;
      cp = (usl - lsl) / (6 * stdDev);
      cpk = Math.min((usl - mean) / (3 * stdDev), (mean - lsl) / (3 * stdDev));
    }

    const points = results
      .map((r, i) => ({
        index: i,
        value: parseFloat(r.value),
        date: r.inspection.createdAt,
        workstation: r.inspection.workstation?.name,
      }))
      .filter(p => !isNaN(p.value));

    return {
      mean: Math.round(mean * 1000) / 1000,
      ucl: Math.round(ucl * 1000) / 1000,
      lcl: Math.round(lcl * 1000) / 1000,
      cp: Math.round(cp * 100) / 100,
      cpk: Math.round(cpk * 100) / 100,
      stdDev: Math.round(stdDev * 1000) / 1000,
      count: values.length,
      points,
      ...(values.length < 20 ? { warning: 'low_sample_size' } : {}),
    };
  }
}
