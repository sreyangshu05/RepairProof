import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartSource, QuotationItemType } from '@repairproof/shared';

export class CreateQuotationItemDto {
  @IsEnum(QuotationItemType)
  type!: QuotationItemType;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  partName?: string;

  @IsEnum(PartSource)
  @IsOptional()
  partSource?: PartSource;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateQuotationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items!: CreateQuotationItemDto[];

  @IsNumber()
  @Min(0)
  laborCost!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxRate?: number; // e.g. 0.08 for 8%

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  validDays?: number; // defaults to 7 days
}
