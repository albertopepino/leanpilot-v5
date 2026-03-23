import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAuditDto {
  @ApiProperty({ example: 'Assembly Line 1' })
  @IsString()
  area: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
