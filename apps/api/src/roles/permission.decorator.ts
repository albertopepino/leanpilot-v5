import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

export interface RequiredPermission {
  group: string;
  level: string;
}

export const RequirePermission = (group: string, level: string) =>
  SetMetadata(PERMISSION_KEY, { group, level });
