import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsNotEmpty } from 'class-validator';
export class CreateDisputeDto {
  @IsString() @IsNotEmpty() @MaxLength(120) reason!: string;
  @IsString() @IsNotEmpty() @MaxLength(3000) description!: string;
}
export class UpdateDisputeDto {
  @IsIn(['REVIEWING', 'RESOLVED', 'REJECTED']) status!: 'REVIEWING' | 'RESOLVED' | 'REJECTED';
  @IsString() @IsOptional() @MaxLength(2000) resolution?: string;
}
