import { Module } from '@nestjs/common';
import { ShopfloorService } from './shopfloor.service';
import { ShopfloorController } from './shopfloor.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ShopfloorController],
  providers: [ShopfloorService],
})
export class ShopfloorModule {}
