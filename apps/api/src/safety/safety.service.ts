import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_TYPES = ['injury', 'near_miss', 'property_damage', 'environmental', 'first_aid'];
const VALID_SEVERITIES = ['minor', 'moderate', 'serious', 'critical'];
const VALID_OUTCOMES = ['no_injury', 'first_aid', 'medical_treatment', 'restricted_work', 'lost_time', 'fatality'];
const VALID_STATUSES = [
  'reported', 'investigating', 'root_cause_identified',
  'corrective_action', 'verification', 'closed',
];

@Injectable()
export class SafetyService {
  constructor(private prisma: PrismaService) {}

  // ===== INCIDENTS =====

  async findIncidents(siteId: string, filters?: {
    type?: string;
    severity?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = { siteId };
    if (filters?.type && VALID_TYPES.includes(filters.type)) {
      where.type = filters.type;
    }
    if (filters?.severity && VALID_SEVERITIES.includes(filters.severity)) {
      where.severity = filters.severity;
    }
    if (filters?.status && VALID_STATUSES.includes(filters.status)) {
      where.status = filters.status;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
    }

    return this.prisma.safetyIncident.findMany({
      where,
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
        workstation: { select: { id: true, name: true } },
        investigator: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { attachments: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findIncidentById(id: string, siteId: string) {
    const incident = await this.prisma.safetyIncident.findFirst({
      where: { id, siteId },
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
        workstation: { select: { id: true, name: true } },
        investigator: { select: { id: true, firstName: true, lastName: true } },
        attachments: true,
      },
    });
    if (!incident) throw new NotFoundException('Safety incident not found');
    return incident;
  }

  async createIncident(siteId: string, userId: string, data: {
    workstationId?: string;
    type: string;
    severity?: string;
    outcome?: string;
    date: string;
    time?: string;
    location: string;
    title: string;
    description: string;
    injuredPerson?: string;
    injuryType?: string;
    bodyPart?: string;
    treatmentGiven?: string;
    daysLost?: number;
    potentialSeverity?: string;
    isOshaRecordable?: boolean;
    immediateAction?: string;
    witnessNames?: string;
    photoUrl?: string;
  }) {
    if (!VALID_TYPES.includes(data.type)) {
      throw new BadRequestException(`Invalid type. Must be: ${VALID_TYPES.join(', ')}`);
    }
    if (data.severity && !VALID_SEVERITIES.includes(data.severity)) {
      throw new BadRequestException(`Invalid severity. Must be: ${VALID_SEVERITIES.join(', ')}`);
    }
    if (data.outcome && !VALID_OUTCOMES.includes(data.outcome)) {
      throw new BadRequestException(`Invalid outcome. Must be: ${VALID_OUTCOMES.join(', ')}`);
    }

    return this.prisma.safetyIncident.create({
      data: {
        siteId,
        reporterId: userId,
        workstationId: data.workstationId,
        type: data.type,
        severity: data.severity || 'minor',
        outcome: data.outcome || 'no_injury',
        date: new Date(data.date),
        time: data.time,
        location: data.location,
        title: data.title,
        description: data.description,
        injuredPerson: data.injuredPerson,
        injuryType: data.injuryType,
        bodyPart: data.bodyPart,
        treatmentGiven: data.treatmentGiven,
        daysLost: data.daysLost ?? 0,
        potentialSeverity: data.potentialSeverity,
        isOshaRecordable: data.isOshaRecordable ?? false,
        immediateAction: data.immediateAction,
        witnessNames: data.witnessNames,
        photoUrl: data.photoUrl,
      },
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
        workstation: { select: { id: true, name: true } },
      },
    });
  }

  async updateIncident(id: string, siteId: string, data: {
    type?: string;
    severity?: string;
    outcome?: string;
    title?: string;
    description?: string;
    injuredPerson?: string;
    injuryType?: string;
    bodyPart?: string;
    treatmentGiven?: string;
    daysLost?: number;
    potentialSeverity?: string;
    isOshaRecordable?: boolean;
    immediateAction?: string;
    witnessNames?: string;
    status?: string;
    investigatorId?: string;
    investigationDate?: string;
    investigationNotes?: string;
    fiveWhyId?: string;
    ishikawaId?: string;
    eightDReportId?: string;
    photoUrl?: string;
  }) {
    const incident = await this.prisma.safetyIncident.findFirst({ where: { id, siteId } });
    if (!incident) throw new NotFoundException('Safety incident not found');

    if (data.type && !VALID_TYPES.includes(data.type)) {
      throw new BadRequestException(`Invalid type. Must be: ${VALID_TYPES.join(', ')}`);
    }
    if (data.severity && !VALID_SEVERITIES.includes(data.severity)) {
      throw new BadRequestException(`Invalid severity. Must be: ${VALID_SEVERITIES.join(', ')}`);
    }
    if (data.status && !VALID_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status. Must be: ${VALID_STATUSES.join(', ')}`);
    }

    const updateData: any = { ...data };
    if (data.investigationDate) {
      updateData.investigationDate = new Date(data.investigationDate);
    }
    if (data.status === 'closed' && !incident.closedAt) {
      updateData.closedAt = new Date();
    }

    return this.prisma.safetyIncident.update({
      where: { id },
      data: updateData,
      include: {
        reporter: { select: { id: true, firstName: true, lastName: true } },
        workstation: { select: { id: true, name: true } },
        investigator: { select: { id: true, firstName: true, lastName: true } },
        attachments: true,
      },
    });
  }

  // ===== METRICS =====

  async getMetrics(siteId: string) {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Get all incidents from the past year for rate calculations
    const incidents = await this.prisma.safetyIncident.findMany({
      where: { siteId, date: { gte: oneYearAgo } },
      select: {
        type: true,
        outcome: true,
        daysLost: true,
        isOshaRecordable: true,
        date: true,
      },
    });

    const totalIncidents = incidents.length;
    const nearMisses = incidents.filter(i => i.type === 'near_miss').length;
    const recordable = incidents.filter(i => i.isOshaRecordable).length;
    const lostTimeIncidents = incidents.filter(i => i.outcome === 'lost_time' || i.outcome === 'fatality').length;
    const totalDaysLost = incidents.reduce((sum, i) => sum + (i.daysLost || 0), 0);

    // TRIR: (recordable incidents * 200,000) / total hours worked
    // Using 200,000 as standard (100 full-time employees * 2,000 hours/year)
    // Since we don't track hours worked, we report raw counts and let frontend compute with actual hours
    const trir = recordable; // raw count — frontend divides by (hours worked / 200000)
    const ltir = lostTimeIncidents; // raw count

    // Days since last incident
    let daysSinceLastIncident: number | null = null;
    if (incidents.length > 0) {
      const sorted = [...incidents].sort((a, b) => b.date.getTime() - a.date.getTime());
      const lastIncidentDate = sorted[0].date;
      daysSinceLastIncident = Math.floor((now.getTime() - lastIncidentDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Near-miss ratio
    const nearMissRatio = totalIncidents > 0
      ? Math.round((nearMisses / totalIncidents) * 10000) / 100
      : 0;

    return {
      totalIncidents,
      recordableIncidents: recordable,
      lostTimeIncidents,
      nearMisses,
      totalDaysLost,
      daysSinceLastIncident,
      nearMissRatioPercent: nearMissRatio,
      trirRawCount: trir,
      ltirRawCount: ltir,
    };
  }

  // ===== ATTACHMENTS =====

  async addAttachment(incidentId: string, siteId: string, userId: string, data: {
    fileName: string;
    fileUrl: string;
  }) {
    const incident = await this.prisma.safetyIncident.findFirst({ where: { id: incidentId, siteId } });
    if (!incident) throw new NotFoundException('Safety incident not found');

    return this.prisma.safetyAttachment.create({
      data: {
        incidentId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        uploadedById: userId,
      },
    });
  }
}
