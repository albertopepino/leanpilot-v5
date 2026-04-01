import { Module } from '@nestjs/common';
import { SmedService } from './smed.service';
import { SmedController } from './smed.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SmedController],
  providers: [SmedService],
})
export class SmedModule {}
