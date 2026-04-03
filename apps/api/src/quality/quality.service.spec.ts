import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QualityService } from './quality.service';
import { PrismaService } from '../prisma/prisma.service';

describe('QualityService', () => {
  let service: QualityService;
  let prisma: PrismaService;

  const mockPrisma = {
    qualityTemplate: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    qualityInspection: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    qualityCheckpoint: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    qualityResult: { findMany: jest.fn(), upsert: jest.fn() },
    nonConformanceReport: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    ncrAttachment: { create: jest.fn() },
    workstation: { findFirst: jest.fn() },
    productionOrder: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QualityService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(QualityService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // ── NCR Immutability (ISO 9001) ───────────────────────────────

  describe('updateNcr — closed NCR immutability', () => {
    it('should reject modification of a closed NCR', async () => {
      mockPrisma.nonConformanceReport.findFirst.mockResolvedValue({
        id: 'ncr-1', siteId: 'site-1', status: 'closed', closedAt: new Date(),
      });

      await expect(
        service.updateNcr('ncr-1', 'site-1', { rootCause: 'updated cause' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.nonConformanceReport.update).not.toHaveBeenCalled();
    });

    it('should allow modification of an open NCR', async () => {
      mockPrisma.nonConformanceReport.findFirst.mockResolvedValue({
        id: 'ncr-1', siteId: 'site-1', status: 'open',
      });
      mockPrisma.nonConformanceReport.update.mockResolvedValue({
        id: 'ncr-1', status: 'open', rootCause: 'new cause',
      });

      const result = await service.updateNcr('ncr-1', 'site-1', { rootCause: 'new cause' });
      expect(mockPrisma.nonConformanceReport.update).toHaveBeenCalled();
    });

    it('should reject invalid status transitions', async () => {
      mockPrisma.nonConformanceReport.findFirst.mockResolvedValue({
        id: 'ncr-1', siteId: 'site-1', status: 'open',
      });

      await expect(
        service.updateNcr('ncr-1', 'site-1', { status: 'invalid_status' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set closedAt when transitioning to closed', async () => {
      mockPrisma.nonConformanceReport.findFirst.mockResolvedValue({
        id: 'ncr-1', siteId: 'site-1', status: 'verification',
      });
      mockPrisma.nonConformanceReport.update.mockResolvedValue({
        id: 'ncr-1', status: 'closed', closedAt: expect.any(Date),
      });

      await service.updateNcr('ncr-1', 'site-1', { status: 'closed' });
      const updateCall = mockPrisma.nonConformanceReport.update.mock.calls[0][0];
      expect(updateCall.data.closedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException for non-existent NCR', async () => {
      mockPrisma.nonConformanceReport.findFirst.mockResolvedValue(null);

      await expect(
        service.updateNcr('nonexistent', 'site-1', { rootCause: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Quality Inspection Immutability ────────────────────────────

  describe('submitResults — completed inspection immutability', () => {
    it('should reject results on a passed inspection', async () => {
      mockPrisma.qualityInspection.findFirst.mockResolvedValue({
        id: 'insp-1', siteId: 'site-1', status: 'passed', templateId: 't-1',
      });

      await expect(
        service.submitResults('insp-1', 'site-1', [
          { checkpointId: 'cp-1', value: '5', passed: true },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject results on a failed inspection', async () => {
      mockPrisma.qualityInspection.findFirst.mockResolvedValue({
        id: 'insp-1', siteId: 'site-1', status: 'failed', templateId: 't-1',
      });

      await expect(
        service.submitResults('insp-1', 'site-1', [
          { checkpointId: 'cp-1', value: '5', passed: true },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow results on an in-progress inspection', async () => {
      mockPrisma.qualityInspection.findFirst.mockResolvedValue({
        id: 'insp-1', siteId: 'site-1', status: 'in_progress', templateId: 't-1',
      });
      mockPrisma.qualityCheckpoint.findMany.mockResolvedValue([{ id: 'cp-1' }]);
      mockPrisma.qualityResult.upsert.mockResolvedValue({});
      mockPrisma.qualityResult.findMany.mockResolvedValue([{ passed: true }]);
      mockPrisma.qualityCheckpoint.count.mockResolvedValue(1);
      mockPrisma.qualityInspection.update.mockResolvedValue({ status: 'passed' });

      await service.submitResults('insp-1', 'site-1', [
        { checkpointId: 'cp-1', value: '5', passed: true },
      ]);
      expect(mockPrisma.qualityResult.upsert).toHaveBeenCalled();
    });
  });

  // ── Pagination ─────────────────────────────────────────────────

  describe('getTemplates — pagination', () => {
    it('should return paginated results with default limit', async () => {
      mockPrisma.qualityTemplate.findMany.mockResolvedValue([]);
      mockPrisma.qualityTemplate.count.mockResolvedValue(0);

      const result = await service.getTemplates('site-1');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('offset');
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should cap limit at 200', async () => {
      mockPrisma.qualityTemplate.findMany.mockResolvedValue([]);
      mockPrisma.qualityTemplate.count.mockResolvedValue(0);

      const result = await service.getTemplates('site-1', 500, 0);
      expect(result.limit).toBe(200);
    });

    it('should enforce minimum limit of 1', async () => {
      mockPrisma.qualityTemplate.findMany.mockResolvedValue([]);
      mockPrisma.qualityTemplate.count.mockResolvedValue(0);

      const result = await service.getTemplates('site-1', -5, 0);
      expect(result.limit).toBe(1);
    });
  });

  // ── NCR Creation Validation ────────────────────────────────────

  describe('createNcr — input validation', () => {
    it('should reject invalid severity', async () => {
      await expect(
        service.createNcr('site-1', 'user-1', {
          severity: 'extreme',
          description: 'test',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject workstation from different site', async () => {
      mockPrisma.workstation.findFirst.mockResolvedValue(null);

      await expect(
        service.createNcr('site-1', 'user-1', {
          severity: 'minor',
          description: 'test',
          workstationId: 'ws-other-site',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
