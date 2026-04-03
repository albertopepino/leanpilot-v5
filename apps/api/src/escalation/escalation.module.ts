import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EscalationService } from './escalation.service';
import { EscalationController } from './escalation.controller';
import { EscalationScheduler } from './escalation.scheduler';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, ScheduleModule.forRoot()],
  controllers: [EscalationController],
  providers: [EscalationService, EscalationScheduler],
  exports: [EscalationService],
})
export class EscalationModule {}
