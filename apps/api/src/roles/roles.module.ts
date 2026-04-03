import { Module, Global } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { PermissionGuard } from './permission.guard';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [RolesController],
  providers: [RolesService, PermissionGuard],
  exports: [RolesService, PermissionGuard],
})
export class RolesModule {}
