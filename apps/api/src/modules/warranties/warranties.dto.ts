import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { WarrantyClaimStatus } from '@prisma/client';
export class CreateWarrantyClaimDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) description!: string;
}

export class CreateWarrantyDto {
  @IsInt()
  @Min(1)
  @Max(60)
  durationMonths!: number;

  @IsDateString()
  startsAt!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  terms!: string;
}

export class UpdateWarrantyClaimDto {
  @IsIn(['REVIEWING', 'APPROVED', 'REJECTED', 'RESOLVED']) status!: Exclude<
    WarrantyClaimStatus,
    'OPEN'
  >;
  @IsString() @IsOptional() @MaxLength(2000) resolution?: string;
}
