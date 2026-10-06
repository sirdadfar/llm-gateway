import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateApiKeyDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ default: 60, minimum: 1, maximum: 100000 })
  @IsInt()
  @Min(1)
  @Max(100000)
  requestsPerMinute = 60;

  @ApiProperty({ default: 0, minimum: 0 })
  @IsInt()
  @Min(0)
  monthlyTokenQuota = 0;

  @ApiPropertyOptional({ type: [String], description: 'Empty means all models' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  allowedModels?: string[];
}