import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ROLES } from '../../common/constants';

export class RegisterDto {
  @ApiProperty({ example: 'user@factory.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Mario' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Rossi' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ enum: ROLES, default: 'viewer' })
  @IsOptional()
  @IsIn(ROLES)
  role?: string;

  @ApiProperty({ description: 'Site ID to assign user to' })
  @IsString()
  siteId: string;

  @ApiProperty({ description: 'Corporate ID' })
  @IsString()
  corporateId: string;
}
