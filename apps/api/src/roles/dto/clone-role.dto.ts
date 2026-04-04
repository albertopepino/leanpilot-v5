import { IsString } from 'class-validator';

export class CloneRoleDto {
  @IsString()
  name: string;
}
