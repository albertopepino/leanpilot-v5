import { Module } from '@nestjs/common';
import { CorporateService } from './corporate.service';
import { CorporateController } from './corporate.controller';
import { AuthModule } from '../auth/auth.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [AuthModule, DashboardModule],
  controllers: [CorporateController],
  providers: [CorporateService],
})
export class CorporateModule {}
