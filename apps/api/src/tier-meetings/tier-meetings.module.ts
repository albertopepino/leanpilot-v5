import { Module } from '@nestjs/common';
import { TierMeetingsService } from './tier-meetings.service';
import { TierMeetingsController } from './tier-meetings.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TierMeetingsController],
  providers: [TierMeetingsService],
})
export class TierMeetingsModule {}
