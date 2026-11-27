import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CasePriority, CaseStatus, DeviceCategory } from '@repairproof/shared';

export class CreateCaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  customerPhone!: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(254)
  customerEmail?: string;

  @IsIn(['en-IN', 'bn-BD', 'hi-IN'])
  @IsOptional()
  customerLocale?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  problemDescription!: string;

  @IsEnum(CasePriority)
  @IsOptional()
  priority?: CasePriority;

  @IsString()
  @IsOptional()
  technicianId?: string;
}

export class CreateCaseIntakeDto {
  @IsEnum(DeviceCategory)
  category!: DeviceCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  make!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  model!: string;

  @IsString()
  @IsOptional()
  @MaxLength(4)
  serialLast4?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  customerPhone!: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(254)
  customerEmail?: string;

  @IsIn(['en-IN', 'bn-BD', 'hi-IN'])
  @IsOptional()
  customerLocale?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  problemDescription!: string;

  @IsEnum(CasePriority)
  @IsOptional()
  priority?: CasePriority;
}

export class UpdateCaseStatusDto {
  @IsEnum(CaseStatus)
  status!: CaseStatus;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportingEvidenceIds?: string[];
}

export class AssignTechnicianDto {
  @IsString()
  @IsNotEmpty()
  technicianId!: string;
}

export class ListCasesQueryDto {
  @IsEnum(CaseStatus)
  @IsOptional()
  status?: CaseStatus;

  @IsString()
  @IsOptional()
  technicianId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 50;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  cursor?: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  search?: string;
}
