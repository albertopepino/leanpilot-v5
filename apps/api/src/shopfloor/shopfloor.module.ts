import { Module } from '@nestjs/common';
import { ShopfloorService } from './shopfloor.service';
import { ShopfloorController } from './shopfloor.controller';
import { ShopfloorGateway } from './shopfloor.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ShopfloorController],
  providers: [ShopfloorService, ShopfloorGateway],
  exports: [ShopfloorGateway],
})
export class ShopfloorModule {}
