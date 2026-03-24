import { Module } from '@nestjs/common';
import { RootCauseService } from './root-cause.service';
import { RootCauseController } from './root-cause.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RootCauseController],
  providers: [RootCauseService],
})
export class RootCauseModule {}
