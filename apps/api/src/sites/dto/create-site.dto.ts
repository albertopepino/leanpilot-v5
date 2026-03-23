import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSiteDto {
  @ApiProperty({ example: 'Milan Factory' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Milan, Italy' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'Europe/Rome' })
  @IsOptional()
  @IsString()
  timezone?: string;
}
