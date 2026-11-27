import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
export class CreateTestResultDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsBoolean() passed!: boolean;
  @IsObject() @IsOptional() details?: Record<string, unknown>;
  @IsString() @IsOptional() @MaxLength(2000) notes?: string;
  @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true }) @IsOptional() evidenceIds?: string[];
}
