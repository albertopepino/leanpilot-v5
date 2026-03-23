import { Module } from '@nestjs/common';
import { FiveSService } from './five-s.service';
import { FiveSController } from './five-s.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FiveSController],
  providers: [FiveSService],
})
export class FiveSModule {}
