import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { EvidenceCategory, EvidenceType } from '@repairproof/shared';

export class CreateEvidenceDto {
  @IsEnum(EvidenceCategory)
  category!: EvidenceCategory;

  @IsEnum(EvidenceType)
  @IsOptional()
  type?: EvidenceType;

  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsNumber()
  fileSize!: number;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class AddAnnotationDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  y!: number;

  @IsString()
  @IsNotEmpty()
  note!: string;

  @IsString()
  @IsOptional()
  authorName?: string;
}
