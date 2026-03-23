import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FIVE_S_CATEGORIES } from '../../../common/constants';

class ScoreItemDto {
  @ApiProperty({ enum: FIVE_S_CATEGORIES })
  @IsIn(FIVE_S_CATEGORIES)
  category: string;

  @ApiProperty({ minimum: 0, maximum: 5 })
  @IsInt()
  @Min(0)
  @Max(5)
  score: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitScoresDto {
  @ApiProperty({ type: [ScoreItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScoreItemDto)
  scores: ScoreItemDto[];

  @ApiPropertyOptional({ description: 'Mark audit as completed' })
  @IsOptional()
  @IsBoolean()
  complete?: boolean;
}
