import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDiagnosticDto {
  @IsObject()
  findings!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  summary?: string;
}

export class CompleteDiagnosisDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
