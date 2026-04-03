import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 20 } }) // 20 login attempts per minute per IP
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('site_admin', 'corporate_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new user (admin-only)' })
  async register(
    @Body() dto: RegisterDto,
    @CurrentUser() caller: { siteId: string; corporateId: string; role: string },
  ) {
    return this.auth.register(dto, caller);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refreshTokens(dto.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiBody({ schema: { properties: { email: { type: 'string' } } } })
  async forgotPassword(@Body() body: { email: string }) {
    await this.auth.requestPasswordReset(body.email);
    return { message: 'If an account exists, a reset email has been sent' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({ schema: { properties: { token: { type: 'string' }, password: { type: 'string' } } } })
  async resetPassword(@Body() body: { token: string; password: string }) {
    await this.auth.resetPassword(body.token, body.password);
    return { message: 'Password reset successful' };
  }
}
