import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;

  const mockPrisma = {
    auditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(AuditService);
    jest.clearAllMocks();
  });

  // ── Immutable Append-Only Logging ──────────────────────────────

  describe('log', () => {
    it('should create an immutable audit entry', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.log({
        userId: 'u-1',
        userEmail: 'test@test.com',
        action: 'create',
        entityType: 'ncr',
        entityId: 'ncr-1',
        result: 'success',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u-1',
          userEmail: 'test@test.com',
          action: 'create',
          entityType: 'ncr',
          entityId: 'ncr-1',
          result: 'success',
        }),
      });
    });

    it('should not crash when audit logging fails', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB connection lost'));

      // Should not throw — audit logging must never crash the main operation
      await expect(
        service.log({ action: 'create', entityType: 'test' }),
      ).resolves.not.toThrow();
    });

    it('should handle null optional fields', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.log({ action: 'login', entityType: 'auth' });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          userEmail: null,
          entityId: null,
          ipAddress: null,
          userAgent: null,
          metadata: null,
        }),
      });
    });
  });

  // ── Query ──────────────────────────────────────────────────────

  describe('query', () => {
    it('should return paginated audit logs', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const result = await service.query({});
      expect(result).toEqual({ logs: [], total: 0, limit: 50, offset: 0 });
    });

    it('should cap limit at 500', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const result = await service.query({ limit: 1000 });
      expect(result.limit).toBe(500);
    });

    it('should filter by entityType', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.query({ entityType: 'ncr' });
      const where = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.entityType).toBe('ncr');
    });

    it('should filter by date range', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const from = new Date('2026-01-01');
      const to = new Date('2026-12-31');
      await service.query({ from, to });

      const where = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.timestamp.gte).toEqual(from);
      expect(where.timestamp.lte).toEqual(to);
    });
  });
});
