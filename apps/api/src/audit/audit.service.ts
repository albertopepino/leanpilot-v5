import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  userId?: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  result?: 'success' | 'failure';
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** Append an immutable audit log entry */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId || null,
          userEmail: entry.userEmail || null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId || null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          ipAddress: entry.ipAddress || null,
          userAgent: entry.userAgent || null,
          result: entry.result || 'success',
        },
      });
    } catch {
      // Audit logging must never crash the main operation
      // In production, send to a dead-letter queue or stderr
      console.error('[AuditLog] Failed to write audit entry:', entry.action, entry.entityType);
    }
  }

  /** Query audit logs (corporate_admin only) */
  async query(filters: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.timestamp = {};
      if (filters.from) where.timestamp.gte = filters.from;
      if (filters.to) where.timestamp.lte = filters.to;
    }

    const limit = Math.min(Math.max(1, filters.limit || 50), 500);
    const offset = Math.max(0, filters.offset || 0);

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, limit, offset };
  }
}
