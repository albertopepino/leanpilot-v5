import { Module } from '@nestjs/common';
import { KaizenService } from './kaizen.service';
import { KaizenController } from './kaizen.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [KaizenController],
  providers: [KaizenService],
})
export class KaizenModule {}
