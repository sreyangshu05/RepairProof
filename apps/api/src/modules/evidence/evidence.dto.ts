import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { EvidenceCategory, EvidencePurpose } from '@repairproof/shared';

export class CreateEvidenceUploadDto {
  @IsEnum(EvidenceCategory)
  category!: EvidenceCategory;

  @IsEnum(EvidencePurpose)
  @IsOptional()
  purpose?: EvidencePurpose;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsInt()
  @Min(1)
  @Max(104857600)
  fileSize!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(image\/(jpeg|png|webp|heic)|video\/(mp4|quicktime)|application\/pdf)$/)
  mimeType!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
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
  @MaxLength(1000)
  note!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  authorName?: string;
}

export class EvidenceDeletionRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class EvidenceDeletionReviewDto {
  @IsString()
  @Matches(/^(APPROVED|REJECTED)$/)
  status!: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reviewNotes?: string;
}
