import { Module } from '@nestjs/common';
import { WorkstationsService } from './workstations.service';
import { WorkstationsController } from './workstations.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [WorkstationsController],
  providers: [WorkstationsService],
  exports: [WorkstationsService],
})
export class WorkstationsModule {}
