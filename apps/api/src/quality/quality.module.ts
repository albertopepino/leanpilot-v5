import { Module } from '@nestjs/common';
import { QualityService } from './quality.service';
import { QualityController } from './quality.controller';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [QualityController],
  providers: [QualityService],
})
export class QualityModule {}
