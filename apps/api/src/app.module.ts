import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SitesModule } from './sites/sites.module';
import { CorporateModule } from './corporate/corporate.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WorkstationsModule } from './workstations/workstations.module';
import { OrdersModule } from './orders/orders.module';
import { ShopfloorModule } from './shopfloor/shopfloor.module';
import { GembaModule } from './gemba/gemba.module';
import { UploadsModule } from './uploads/uploads.module';
import { FiveSModule } from './tools/five-s/five-s.module';
import { KaizenModule } from './tools/kaizen/kaizen.module';
import { QualityModule } from './quality/quality.module';
import { AuditModule } from './audit/audit.module';
import { ReportsModule } from './reports/reports.module';
import { DocumentsModule } from './documents/documents.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { RootCauseModule } from './root-cause/root-cause.module';
import { SafetyModule } from './safety/safety.module';
import { ActionsModule } from './actions/actions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TierMeetingsModule } from './tier-meetings/tier-meetings.module';
import { A3Module } from './a3/a3.module';
import { SkillsModule } from './skills/skills.module';
import { SmedModule } from './smed/smed.module';
import { SiteConfigModule } from './site-config/site-config.module';
import { RolesModule } from './roles/roles.module';
import { PermissionGuard } from './roles/permission.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true, ttl: 30000, max: 100 }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },   // 10 req/sec per IP
      { name: 'medium', ttl: 60000, limit: 100 }, // 100 req/min per IP
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    SitesModule,
    CorporateModule,
    DashboardModule,
    WorkstationsModule,
    OrdersModule,
    ShopfloorModule,
    GembaModule,
    UploadsModule,
    FiveSModule,
    KaizenModule,
    QualityModule,
    ReportsModule,
    DocumentsModule,
    MaintenanceModule,
    RootCauseModule,
    SafetyModule,
    ActionsModule,
    NotificationsModule,
    TierMeetingsModule,
    A3Module,
    SkillsModule,
    SmedModule,
    SiteConfigModule,
    RolesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
