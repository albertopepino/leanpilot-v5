import { Module } from '@nestjs/common';
import { RetentionScheduler } from './retention.scheduler';

@Module({
  providers: [RetentionScheduler],
})
export class CleanupModule {}
