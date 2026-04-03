import { Module } from '@nestjs/common';
import { CapaService } from './capa.service';
import { CapaController } from './capa.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CapaController],
  providers: [CapaService],
  exports: [CapaService],
})
export class CapaModule {}
