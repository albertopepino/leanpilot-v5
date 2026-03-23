import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SitesModule } from './sites/sites.module';
import { CorporateModule } from './corporate/corporate.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FiveSModule } from './tools/five-s/five-s.module';
import { KaizenModule } from './tools/kaizen/kaizen.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SitesModule,
    CorporateModule,
    DashboardModule,
    // Lean tools — Phase 1
    FiveSModule,
    KaizenModule,
  ],
})
export class AppModule {}
