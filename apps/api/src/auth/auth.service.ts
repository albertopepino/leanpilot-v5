import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as qrcode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
    private email: EmailService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        site: true,
        corporate: true,
        customRole: { include: { permissions: true } },
      },
    });

    if (!user || !user.isActive) {
      this.audit.log({ userEmail: dto.email, action: 'login_failed', entityType: 'auth', result: 'failure', metadata: { reason: 'invalid_credentials' } });
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      this.audit.log({ userId: user.id, userEmail: dto.email, action: 'login_failed', entityType: 'auth', result: 'failure', metadata: { reason: 'wrong_password' } });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!dto.twoFactorToken) {
        // Issue a short-lived temp token for 2FA verification only
        const tempToken = this.jwt.sign(
          { sub: user.id, purpose: '2fa-pending' },
          { expiresIn: '5m' },
        );
        this.audit.log({ userId: user.id, userEmail: user.email, action: 'login_2fa_required', entityType: 'auth', entityId: user.id });
        return { requiresTwoFactor: true, tempToken };
      }

      const isValid = verifySync({ token: dto.twoFactorToken, secret: user.twoFactorSecret }).valid;
      if (!isValid) {
        this.audit.log({ userId: user.id, userEmail: user.email, action: 'login_2fa_failed', entityType: 'auth', result: 'failure' });
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = await this.generateTokens(user);

    this.audit.log({ userId: user.id, userEmail: user.email, action: 'login', entityType: 'auth', entityId: user.id });

    // Build permission map from custom role
    const permissions: Record<string, string> = {};
    if (user.customRole?.permissions) {
      for (const p of user.customRole.permissions) {
        permissions[p.featureGroup] = p.level;
      }
    }

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        customRoleId: user.customRoleId,
        customRoleName: user.customRole?.name ?? null,
        siteId: user.siteId,
        corporateId: user.corporateId,
        siteName: user.site?.name ?? null,
        siteLogo: user.site?.logo ?? null,
        corporateName: user.corporate?.name ?? null,
        permissions,
      },
    };
  }

  async register(dto: RegisterDto, caller?: { siteId: string; corporateId: string; role: string }) {
    // Validate caller can only create users within their own corporate/site
    if (caller) {
      if (caller.role === 'site_admin') {
        // Site admins can only create users in their own site
        if (dto.siteId && dto.siteId !== caller.siteId) {
          throw new BadRequestException('Cannot create users for a different site');
        }
        dto.siteId = dto.siteId || caller.siteId;
        dto.corporateId = dto.corporateId || caller.corporateId;
        // Site admins cannot create corporate_admin or site_admin
        const ELEVATED_ROLES = ['corporate_admin', 'site_admin'];
        if (dto.role && ELEVATED_ROLES.includes(dto.role)) {
          throw new BadRequestException('Insufficient privileges to create this role');
        }
      } else if (caller.role === 'corporate_admin') {
        // Corporate admins can create in any site within their corporate — FORCE their corporateId
        dto.corporateId = caller.corporateId;
        if (dto.siteId) {
          const site = await this.prisma.site.findFirst({
            where: { id: dto.siteId, corporateId: dto.corporateId },
          });
          if (!site) throw new BadRequestException('Site does not belong to your corporate');
        }
      }
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role || 'viewer',
        siteId: dto.siteId,
        corporateId: dto.corporateId,
      },
    });

    return { id: user.id, email: user.email };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return; // Don't reveal if email exists

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    await this.email.sendPasswordReset(user.email, user.firstName, resetUrl);

    this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: 'password_reset_requested',
      entityType: 'auth',
      entityId: user.id,
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });

    if (!resetToken) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: resetToken.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: 'password_reset',
      entityType: 'auth',
      entityId: user.id,
    });
  }

  async refreshTokens(refreshToken: string) {
    // Atomic: delete the token first (first-deleter wins, prevents replay)
    const deleted = await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken, expiresAt: { gt: new Date() } },
    });

    if (deleted.count === 0) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Token was valid and now consumed — look up the user
    // We need userId from the JWT payload since we already deleted the DB record
    let userId: string;
    try {
      const decoded = this.jwt.verify(refreshToken) as { sub: string };
      userId = decoded.sub;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return this.generateTokens(user);
  }

  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const secret = generateSecret();
    const otpauthUrl = generateURI({ secret, issuer: 'LeanPilot', label: user.email });
    const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

    // Store secret — not yet enabled until user confirms with a valid token
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    this.audit.log({ userId, userEmail: user.email, action: '2fa_setup_initiated', entityType: 'auth', entityId: userId });

    return { secret, qrCodeUrl };
  }

  async enableTwoFactor(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated. Call setup first.');
    }

    const isValid = verifySync({ token, secret: user.twoFactorSecret }).valid;
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    this.audit.log({ userId, userEmail: user.email, action: '2fa_enabled', entityType: 'auth', entityId: userId });

    return { message: 'Two-factor authentication enabled successfully' };
  }

  async disableTwoFactor(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled');
    }

    const isValid = verifySync({ token, secret: user.twoFactorSecret }).valid;
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    this.audit.log({ userId, userEmail: user.email, action: '2fa_disabled', entityType: 'auth', entityId: userId });

    return { message: 'Two-factor authentication disabled successfully' };
  }

  async verifyTwoFactorLogin(tempToken: string, token: string) {
    let payload: { sub: string; purpose?: string };
    try {
      payload = this.jwt.verify(tempToken) as { sub: string; purpose?: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    if (payload.purpose !== '2fa-pending') {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        site: true,
        corporate: true,
        customRole: { include: { permissions: true } },
      },
    });

    if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Invalid 2FA state');
    }

    const isValid = verifySync({ token, secret: user.twoFactorSecret }).valid;
    if (!isValid) {
      this.audit.log({ userId: user.id, userEmail: user.email, action: 'login_2fa_failed', entityType: 'auth', result: 'failure' });
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = await this.generateTokens(user);

    this.audit.log({ userId: user.id, userEmail: user.email, action: 'login', entityType: 'auth', entityId: user.id, metadata: { via: '2fa' } });

    const permissions: Record<string, string> = {};
    if (user.customRole?.permissions) {
      for (const p of user.customRole.permissions) {
        permissions[p.featureGroup] = p.level;
      }
    }

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        customRoleId: user.customRoleId,
        customRoleName: user.customRole?.name ?? null,
        siteId: user.siteId,
        corporateId: user.corporateId,
        siteName: user.site?.name ?? null,
        siteLogo: user.site?.logo ?? null,
        corporateName: user.corporate?.name ?? null,
        permissions,
      },
    };
  }

  private async generateTokens(user: { id: string; email: string; role: any; customRoleId?: string | null; siteId: string; corporateId: string }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      customRoleId: user.customRoleId || null,
      siteId: user.siteId,
      corporateId: user.corporateId,
    };

    const accessToken = this.jwt.sign(payload);

    // Create refresh token
    const refreshExpiration = this.config.get<string>('JWT_REFRESH_EXPIRATION', '7d');
    const expiresAt = new Date();
    // Parse duration string: "7d" → 7 days, "24h" → 1 day, "2w" → 14 days
    const match = refreshExpiration.match(/^(\d+)\s*(d|h|w|m)$/i);
    let days = 7; // safe default
    if (match) {
      const num = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      if (unit === 'h') days = Math.max(1, Math.round(num / 24));
      else if (unit === 'w') days = num * 7;
      else if (unit === 'm') days = num * 30;
      else days = num; // 'd'
    }
    expiresAt.setDate(expiresAt.getDate() + days);

    const refreshToken = await this.prisma.refreshToken.create({
      data: {
        token: this.jwt.sign(payload, { expiresIn: refreshExpiration }),
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refreshToken.token,
    };
  }
}
