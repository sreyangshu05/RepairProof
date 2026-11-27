import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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
  @MaxLength(1000)
  notes?: string;
}

export class SubmitVerificationDto {
  @IsBoolean()
  passed!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  checklist!: ChecklistItemDto[];

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
