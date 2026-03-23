import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KAIZEN_STATUSES } from '../../../common/constants';

export class ReviewKaizenDto {
  @ApiProperty({ enum: KAIZEN_STATUSES })
  @IsIn(KAIZEN_STATUSES)
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
