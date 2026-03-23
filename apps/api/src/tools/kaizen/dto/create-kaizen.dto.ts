import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KAIZEN_IMPACTS } from '../../../common/constants';

export class CreateKaizenDto {
  @ApiProperty({ example: 'Reduce tool changeover time on Line 3' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Changeover takes 45 minutes due to manual adjustments' })
  @IsString()
  problem: string;

  @ApiProperty({ example: 'Pre-stage tools on a shadow board near the machine' })
  @IsString()
  suggestion: string;

  @ApiPropertyOptional({ enum: KAIZEN_IMPACTS, default: 'medium' })
  @IsOptional()
  @IsIn(KAIZEN_IMPACTS)
  expectedImpact?: string;

  @ApiProperty({ example: 'Assembly Line 3' })
  @IsString()
  area: string;
}
