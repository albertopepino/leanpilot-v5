import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
