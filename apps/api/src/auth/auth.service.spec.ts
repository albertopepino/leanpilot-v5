import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    refreshToken: { create: jest.fn(), deleteMany: jest.fn() },
    passwordResetToken: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    site: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };

  const mockJwt = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue('7d'),
  };

  const mockAudit = {
    log: jest.fn(),
  };

  const mockEmail = {
    sendPasswordReset: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuditService, useValue: mockAudit },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  // ── Login ──────────────────────────────────────────────────────

  describe('login', () => {
    it('should reject invalid email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login_failed', result: 'failure' }),
      );
    });

    it('should reject inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1', email: 'test@test.com', isActive: false, password: 'hash',
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1', email: 'test@test.com', isActive: true, password: 'hash',
        site: { name: 'Site A' }, corporate: { name: 'Corp' },
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login_failed', metadata: { reason: 'wrong_password' } }),
      );
    });

    it('should return tokens on valid credentials', async () => {
      const user = {
        id: 'u-1', email: 'test@test.com', firstName: 'Test', lastName: 'User',
        isActive: true, password: 'hash', role: 'operator',
        siteId: 's-1', corporateId: 'c-1',
        site: { name: 'Site A' }, corporate: { name: 'Corp' },
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.refreshToken.create.mockResolvedValue({ token: 'refresh-token' });

      const result = await service.login({ email: 'test@test.com', password: 'correct' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@test.com');
      expect(result.user.role).toBe('operator');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login' }),
      );
    });
  });

  // ── Register ───────────────────────────────────────────────────

  describe('register', () => {
    it('should reject duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          email: 'existing@test.com', password: 'password1', firstName: 'A', lastName: 'B',
          siteId: 's-1', corporateId: 'c-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent site_admin from creating elevated roles', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.register(
          { email: 'new@test.com', password: 'password1', firstName: 'A', lastName: 'B', role: 'corporate_admin', siteId: 's-1', corporateId: 'c-1' },
          { siteId: 's-1', corporateId: 'c-1', role: 'site_admin' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent site_admin from creating users in other sites', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.register(
          { email: 'new@test.com', password: 'password1', firstName: 'A', lastName: 'B', siteId: 's-other', corporateId: 'c-1' },
          { siteId: 's-1', corporateId: 'c-1', role: 'site_admin' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create user with hashed password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({ id: 'new-user', email: 'new@test.com' });

      const result = await service.register({
        email: 'new@test.com', password: 'secure123', firstName: 'New', lastName: 'User',
        siteId: 's-1', corporateId: 'c-1',
      });

      expect(result.email).toBe('new@test.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('secure123', 12);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ password: 'hashed-password' }),
        }),
      );
    });
  });

  // ── Refresh Token ──────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('should reject expired/used refresh token', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.refreshTokens('expired-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject invalid JWT in refresh token', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });

      await expect(
        service.refreshTokens('invalid-jwt'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should issue new tokens on valid refresh', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      mockJwt.verify.mockReturnValue({ sub: 'u-1' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1', email: 'test@test.com', isActive: true,
        role: 'operator', siteId: 's-1', corporateId: 'c-1',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ token: 'new-refresh' });

      const result = await service.refreshTokens('valid-refresh-token');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });
});
