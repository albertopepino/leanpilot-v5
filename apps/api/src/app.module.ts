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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SitesModule,
    CorporateModule,
    DashboardModule,
    WorkstationsModule,
    OrdersModule,
    ShopfloorModule,
    GembaModule,
    // Phase 2: FiveSModule, KaizenModule
  ],
})
export class AppModule {}
