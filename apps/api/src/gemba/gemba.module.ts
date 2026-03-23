import { Module } from '@nestjs/common';
import { GembaService } from './gemba.service';
import { GembaController } from './gemba.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GembaController],
  providers: [GembaService],
})
export class GembaModule {}
