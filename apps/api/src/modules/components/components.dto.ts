import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PartSource } from '@repairproof/shared';
export class CreateComponentDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsString() @IsOptional() @MaxLength(64) sku?: string;
  @IsString() @IsOptional() @MaxLength(120) manufacturer?: string;
  @IsEnum(PartSource) source!: PartSource;
  @IsInt() @Min(0) @Max(100000) quantityOnHand!: number;
  @IsInt() @Min(0) @Max(100000) reorderThreshold!: number;
  @IsNumber() @Min(0) unitCost!: number;
}
export class ReplaceComponentDto {
  @IsString() @IsNotEmpty() componentId!: string;
  @IsInt() @Min(1) @Max(1000) quantity!: number;
  @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true }) @IsOptional() evidenceIds?: string[];
}
