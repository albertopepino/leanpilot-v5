import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ToolConfigItemDto {
  @IsString()
  toolSlug: string;

  @IsBoolean()
  isEnabled: boolean;

  @IsString()
  minRole: string;
}

export class UpdateToolConfigsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolConfigItemDto)
  tools: ToolConfigItemDto[];
}
