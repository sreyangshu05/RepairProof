import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CasePriority, CaseStatus } from '@repairproof/shared';

export class CreateCaseDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsNotEmpty()
  problemDescription!: string;

  @IsEnum(CasePriority)
  @IsOptional()
  priority?: CasePriority;

  @IsString()
  @IsOptional()
  technicianId?: string;
}

export class UpdateCaseStatusDto {
  @IsEnum(CaseStatus)
  status!: CaseStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AssignTechnicianDto {
  @IsString()
  @IsNotEmpty()
  technicianId!: string;
}
