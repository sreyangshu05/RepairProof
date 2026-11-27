import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
  IsEnum,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UserRole } from '@repairproof/shared';

const rolloutScopes = ['PROFILE', 'ORGANIZATION'] as const;
const experimentStatuses = ['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED'] as const;

export class CreateFeatureFlagDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
  @MaxLength(100)
  key!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @IsOptional()
  @IsIn(rolloutScopes)
  rolloutScope?: (typeof rolloutScopes)[number];

  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  allowedRoles?: UserRole[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  organizationIds?: string[];
}

export class UpdateFeatureFlagDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emergencyDisabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @IsOptional()
  @IsIn(rolloutScopes)
  rolloutScope?: (typeof rolloutScopes)[number];

  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  allowedRoles?: UserRole[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  organizationIds?: string[];
}

export class ExperimentVariantDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{0,63}$/)
  key!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  weight!: number;

  @IsBoolean()
  enabled!: boolean;
}

export class ConfigureExperimentDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
  @MaxLength(100)
  key!: string;

  @IsIn(experimentStatuses)
  status!: (typeof experimentStatuses)[number];

  @IsInt()
  @Min(0)
  @Max(100)
  allocationPercentage!: number;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ExperimentVariantDto)
  variants!: ExperimentVariantDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9_.-]{0,79}$/, { each: true })
  metricKeys?: string[];
}
