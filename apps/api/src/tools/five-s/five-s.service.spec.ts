import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FiveSService } from './five-s.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FiveSService', () => {
  let service: FiveSService;

  const mockPrisma = {
    fiveSAudit: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    fiveSScore: { createMany: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiveSService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(FiveSService);
    jest.clearAllMocks();
  });

  // ── Completed Audit Immutability ───────────────────────────────

  describe('updateScores — completed audit immutability', () => {
    it('should reject score updates on a completed audit', async () => {
      mockPrisma.fiveSAudit.findFirst.mockResolvedValue({
        id: 'audit-1', siteId: 'site-1', status: 'completed',
      });

      await expect(
        service.updateScores('audit-1', 'site-1', [
          { category: 'sort', score: 4 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow score updates on a draft audit', async () => {
      mockPrisma.fiveSAudit.findFirst
        .mockResolvedValueOnce({ id: 'audit-1', siteId: 'site-1', status: 'draft' })
        .mockResolvedValueOnce({
          id: 'audit-1', siteId: 'site-1', status: 'draft',
          auditor: { firstName: 'John', lastName: 'Doe' },
          scores: [{ category: 'sort', score: 4 }],
        });
      mockPrisma.fiveSScore.update.mockResolvedValue({});
      mockPrisma.fiveSScore.findMany.mockResolvedValue([{ score: 4 }]);
      mockPrisma.fiveSAudit.update.mockResolvedValue({});

      await service.updateScores('audit-1', 'site-1', [
        { category: 'sort', score: 4 },
      ]);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should clamp scores between 0 and 5', async () => {
      mockPrisma.fiveSAudit.findFirst
        .mockResolvedValueOnce({ id: 'audit-1', siteId: 'site-1', status: 'draft' })
        .mockResolvedValueOnce({
          id: 'audit-1', status: 'draft',
          auditor: { firstName: 'J', lastName: 'D' },
          scores: [],
        });
      mockPrisma.fiveSScore.update.mockResolvedValue({});
      mockPrisma.fiveSScore.findMany.mockResolvedValue([{ score: 5 }]);
      mockPrisma.fiveSAudit.update.mockResolvedValue({});

      await service.updateScores('audit-1', 'site-1', [
        { category: 'sort', score: 10 }, // should be clamped to 5
      ]);

      // The update should have been called with score clamped to 5
      const updateArgs = mockPrisma.fiveSScore.update.mock.calls[0][0];
      expect(updateArgs.data.score).toBe(5);
    });

    it('should reject invalid categories', async () => {
      mockPrisma.fiveSAudit.findFirst.mockResolvedValue({
        id: 'audit-1', siteId: 'site-1', status: 'draft',
      });

      await expect(
        service.updateScores('audit-1', 'site-1', [
          { category: 'invalid_category', score: 3 },
        ]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Create Audit ───────────────────────────────────────────────

  describe('create', () => {
    it('should create audit with 6 score categories', async () => {
      mockPrisma.fiveSAudit.create.mockResolvedValue({ id: 'new-audit', siteId: 'site-1' });
      mockPrisma.fiveSScore.createMany.mockResolvedValue({ count: 6 });
      mockPrisma.fiveSAudit.findFirst.mockResolvedValue({
        id: 'new-audit', scores: [], auditor: { firstName: 'J', lastName: 'D' },
      });

      await service.create('site-1', 'user-1', 'Assembly');

      const createManyArgs = mockPrisma.fiveSScore.createMany.mock.calls[0][0];
      expect(createManyArgs.data).toHaveLength(6);
      expect(createManyArgs.data.map((d: any) => d.category)).toEqual([
        'sort', 'set_in_order', 'shine', 'standardize', 'sustain', 'safety',
      ]);
    });
  });
});
