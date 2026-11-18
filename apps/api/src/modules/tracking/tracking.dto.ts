import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { RepairStepStatus } from '@repairproof/shared';

export class CreateRepairStepDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];

  @IsArray()
  @IsOptional()
  partsUsed?: Record<string, unknown>[];
}

export class UpdateRepairStepDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(RepairStepStatus)
  @IsOptional()
  status?: RepairStepStatus;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];

  @IsArray()
  @IsOptional()
  partsUsed?: Record<string, unknown>[];
}
