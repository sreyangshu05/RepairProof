import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  IsString,
  Min,
  Max,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
  IsInt,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartSource, QuotationItemType } from '@repairproof/shared';

export class CreateQuotationItemDto {
  @IsEnum(QuotationItemType)
  type!: QuotationItemType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  description!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  partName?: string;

  @IsEnum(PartSource)
  @IsOptional()
  partSource?: PartSource;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  unitPrice!: number;
}

export class CreateQuotationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  diagnosedIssue!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  proposedRepair!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items!: CreateQuotationItemDto[];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  laborCost!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000000)
  @IsOptional()
  additionalCharges?: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  @IsOptional()
  taxRate?: number; // e.g. 0.08 for 8%

  @IsInt()
  @Min(1)
  @Max(8760)
  estimatedCompletionHours!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  warrantyTerms!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  supportingEvidenceIds!: string[];

  @IsString()
  @IsOptional()
  @Matches(/^[A-Za-z]{3}$/)
  currency?: string;

  @IsNumber()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  validDays?: number; // defaults to 7 days
}
