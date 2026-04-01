import { Module } from '@nestjs/common';
import { A3Service } from './a3.service';
import { A3Controller } from './a3.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [A3Controller],
  providers: [A3Service],
})
export class A3Module {}
