import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PartSource, RepairComplexity } from '@prisma/client';

export class PriceTransactionItemDto {
  @ApiProperty({
    description: 'Invoice component description; normalized by Unicode, case, and punctuation.',
  })
  @IsString()
  @Length(2, 160)
  componentName!: string;
  @ApiProperty({ minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
  @ApiProperty({
    minimum: 0,
    description:
      'Invoice unit amount in the transaction currency; zero is allowed for a no-charge or customer-provided item.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  unitAmount!: number;
  @ApiProperty({ enum: PartSource })
  @IsEnum(PartSource)
  source!: PartSource;
}

export class CreatePriceTransactionDto {
  @ApiProperty({
    description: 'Human-entered fault label; the reviewer checks it against repair diagnostics.',
  })
  @IsString()
  @Length(2, 120)
  faultType!: string;
  @ApiProperty({ enum: RepairComplexity })
  @IsEnum(RepairComplexity)
  complexity!: RepairComplexity;
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  transactionAt!: string;
  @ApiProperty({ example: 'US' })
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;
  @ApiProperty({
    example: 'US-CA',
    description: 'Upper-case administrative region code, confirmed during review.',
  })
  @IsString()
  @Length(2, 80)
  regionCode!: string;
  @ApiProperty({ example: 'USD' })
  @Matches(/^[A-Z]{3}$/)
  currency!: string;
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  labourAmount!: number;
  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  additionalAmount = 0;
  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999.99)
  taxAmount = 0;
  @ApiProperty({
    minimum: 0.01,
    description: 'Invoice grand total, including the separately entered tax.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9_999_999_999.99)
  totalAmount!: number;
  @ApiProperty({ description: 'Clean original INVOICE evidence ID attached to the same case.' })
  @IsString()
  @Length(1, 120)
  invoiceEvidenceId!: string;
  @ApiProperty({ type: [PriceTransactionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PriceTransactionItemDto)
  items!: PriceTransactionItemDto[];
}

export class PriceBenchmarkQueryDto {
  @ApiPropertyOptional({
    enum: ['TOTAL', 'LABOUR', 'COMPONENT'],
    default: 'TOTAL',
    description: 'TOTAL is labour + parts + additional charges before tax.',
  })
  @IsOptional()
  @IsIn(['TOTAL', 'LABOUR', 'COMPONENT'])
  priceComponent: 'TOTAL' | 'LABOUR' | 'COMPONENT' = 'TOTAL';
  @ApiProperty({ description: 'Device manufacturer; exact normalized match.' })
  @IsString()
  @Length(2, 120)
  manufacturer!: string;
  @ApiProperty({ description: 'Device model; exact normalized match.' })
  @IsString()
  @Length(1, 160)
  model!: string;
  @ApiProperty({ description: 'Normalized diagnosed fault label; exact match.' })
  @IsString()
  @Length(2, 120)
  faultType!: string;
  @ApiProperty({ description: 'Normalized component label; exact match.' })
  @IsString()
  @Length(2, 160)
  component!: string;
  @ApiProperty({ enum: PartSource }) @IsEnum(PartSource) partSource!: PartSource;
  @ApiProperty({ enum: RepairComplexity }) @IsEnum(RepairComplexity) complexity!: RepairComplexity;
  @ApiProperty({ example: 'US' }) @Matches(/^[A-Z]{2}$/) countryCode!: string;
  @ApiProperty({ example: 'US-CA', description: 'Administrative region code, upper-case.' })
  @IsString()
  @Length(2, 80)
  regionCode!: string;
  @ApiProperty({ example: 'USD' }) @Matches(/^[A-Z]{3}$/) currency!: string;
  @ApiPropertyOptional({
    minimum: 0,
    description: 'The quote amount in the requested basis and currency. TOTAL is pre-tax.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000)
  quoteAmount?: number;
}

export class PriceObservationReviewChecklistDto {
  @ApiProperty({ description: 'Reviewer checked all invoice totals and tax.' })
  @IsBoolean()
  invoiceTotalsMatch!: boolean;
  @ApiProperty({
    description:
      'Reviewer checked component names, quantities, unit prices, and sourcing against the invoice.',
  })
  @IsBoolean()
  lineItemsAndSourcesMatch!: boolean;
  @ApiProperty({
    description: 'Reviewer checked the transaction date and reported region for plausibility.',
  })
  @IsBoolean()
  transactionDateAndRegionPlausible!: boolean;
  @ApiProperty({
    description: 'Reviewer compared fault and complexity against submitted repair diagnostics.',
  })
  @IsBoolean()
  repairScopeAndComplexityReviewed!: boolean;
}

export class ReviewPriceObservationDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED'] })
  @IsIn(['ACCEPTED', 'REJECTED'])
  status!: 'ACCEPTED' | 'REJECTED';
  @ApiPropertyOptional({ minLength: 5, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(5, 1000)
  reason?: string;
  @ValidateIf((value: ReviewPriceObservationDto) => value.status === 'ACCEPTED')
  @ApiPropertyOptional({
    type: PriceObservationReviewChecklistDto,
    description: 'All fields must be true to accept the report.',
  })
  @ValidateNested()
  @Type(() => PriceObservationReviewChecklistDto)
  reviewChecklist?: PriceObservationReviewChecklistDto;
}

export class UpsertRepairPriceIndexDto {
  @Matches(/^[A-Z]{2}$/) countryCode!: string;
  @IsString() @Length(2, 80) regionCode!: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsDateString() period!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) indexValue!: number;
  @IsString() @Length(2, 160) sourceName!: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) sourceUrl?: string;
}
