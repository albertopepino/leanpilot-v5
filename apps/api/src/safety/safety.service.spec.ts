import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SafetyService } from './safety.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SafetyService', () => {
  let service: SafetyService;

  const mockPrisma = {
    safetyIncident: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    safetyAttachment: { create: jest.fn() },
    workstation: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(SafetyService);
    jest.clearAllMocks();
  });

  // ── Closed Incident Immutability (ISO 45001) ──────────────────

  describe('updateIncident — closed incident immutability', () => {
    it('should reject modification of a closed incident', async () => {
      mockPrisma.safetyIncident.findFirst.mockResolvedValue({
        id: 'inc-1', siteId: 'site-1', status: 'closed', closedAt: new Date(),
      });

      await expect(
        service.updateIncident('inc-1', 'site-1', { description: 'updated' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.safetyIncident.update).not.toHaveBeenCalled();
    });

    it('should allow modification of a reported incident', async () => {
      mockPrisma.safetyIncident.findFirst.mockResolvedValue({
        id: 'inc-1', siteId: 'site-1', status: 'reported',
      });
      mockPrisma.safetyIncident.update.mockResolvedValue({
        id: 'inc-1', status: 'investigating',
      });

      await service.updateIncident('inc-1', 'site-1', { status: 'investigating' });
      expect(mockPrisma.safetyIncident.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing incident', async () => {
      mockPrisma.safetyIncident.findFirst.mockResolvedValue(null);

      await expect(
        service.updateIncident('nonexistent', 'site-1', { title: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Incident Creation Validation ───────────────────────────────

  describe('createIncident — input validation', () => {
    it('should reject invalid incident type', async () => {
      await expect(
        service.createIncident('site-1', 'user-1', {
          type: 'invalid_type',
          location: 'Area A',
          title: 'Test',
          description: 'Test incident',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid severity', async () => {
      await expect(
        service.createIncident('site-1', 'user-1', {
          type: 'near_miss',
          severity: 'extreme',
          location: 'Area A',
          title: 'Test',
          description: 'Test incident',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid outcome', async () => {
      await expect(
        service.createIncident('site-1', 'user-1', {
          type: 'injury',
          outcome: 'invalid_outcome',
          location: 'Area A',
          title: 'Test',
          description: 'Test incident',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject workstation from different site', async () => {
      mockPrisma.workstation.findFirst.mockResolvedValue(null);

      await expect(
        service.createIncident('site-1', 'user-1', {
          type: 'near_miss',
          workstationId: 'ws-other-site',
          location: 'Area A',
          title: 'Test',
          description: 'Test incident',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create incident with valid data', async () => {
      mockPrisma.safetyIncident.create.mockResolvedValue({
        id: 'inc-1', type: 'near_miss', status: 'reported',
      });

      const result = await service.createIncident('site-1', 'user-1', {
        type: 'near_miss',
        location: 'Area A',
        title: 'Wet floor',
        description: 'Water leaking near machine',
      });

      expect(mockPrisma.safetyIncident.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            siteId: 'site-1',
            reporterId: 'user-1',
            type: 'near_miss',
          }),
        }),
      );
    });
  });

  // ── Pagination ─────────────────────────────────────────────────

  describe('findIncidents — pagination', () => {
    it('should return paginated results', async () => {
      mockPrisma.safetyIncident.findMany.mockResolvedValue([]);
      mockPrisma.safetyIncident.count.mockResolvedValue(0);

      const result = await service.findIncidents('site-1');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result.limit).toBe(50);
    });

    it('should filter by type', async () => {
      mockPrisma.safetyIncident.findMany.mockResolvedValue([]);
      mockPrisma.safetyIncident.count.mockResolvedValue(0);

      await service.findIncidents('site-1', { type: 'near_miss' });
      const whereArg = mockPrisma.safetyIncident.findMany.mock.calls[0][0].where;
      expect(whereArg.type).toBe('near_miss');
    });

    it('should ignore invalid filter values', async () => {
      mockPrisma.safetyIncident.findMany.mockResolvedValue([]);
      mockPrisma.safetyIncident.count.mockResolvedValue(0);

      await service.findIncidents('site-1', { type: 'invalid_type' });
      const whereArg = mockPrisma.safetyIncident.findMany.mock.calls[0][0].where;
      expect(whereArg.type).toBeUndefined();
    });
  });

  // ── Metrics ────────────────────────────────────────────────────

  describe('getMetrics', () => {
    it('should calculate metrics correctly', async () => {
      const now = new Date();
      mockPrisma.safetyIncident.findMany.mockResolvedValue([
        { type: 'injury', outcome: 'lost_time', daysLost: 5, isOshaRecordable: true, date: now },
        { type: 'near_miss', outcome: 'no_injury', daysLost: 0, isOshaRecordable: false, date: now },
        { type: 'near_miss', outcome: 'no_injury', daysLost: 0, isOshaRecordable: false, date: now },
      ]);

      const metrics = await service.getMetrics('site-1');
      expect(metrics.totalIncidents).toBe(3);
      expect(metrics.nearMisses).toBe(2);
      expect(metrics.recordableIncidents).toBe(1);
      expect(metrics.lostTimeIncidents).toBe(1);
      expect(metrics.totalDaysLost).toBe(5);
      expect(metrics.daysSinceLastIncident).toBe(0);
      expect(metrics.nearMissRatioPercent).toBeCloseTo(66.67, 0);
    });

    it('should handle no incidents', async () => {
      mockPrisma.safetyIncident.findMany.mockResolvedValue([]);

      const metrics = await service.getMetrics('site-1');
      expect(metrics.totalIncidents).toBe(0);
      expect(metrics.daysSinceLastIncident).toBeNull();
    });
  });
});
