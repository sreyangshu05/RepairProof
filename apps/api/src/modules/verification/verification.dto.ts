import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsBoolean()
  passed!: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SubmitVerificationDto {
  @IsBoolean()
  passed!: boolean;

  @IsArray()
  checklist!: ChecklistItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}
