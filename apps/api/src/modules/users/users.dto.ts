import { IsIn, IsOptional, IsPhoneNumber, IsString, MaxLength, MinLength } from 'class-validator';
export class UpdateUserProfileDto {
  @IsString() @MinLength(1) @MaxLength(120) @IsOptional() displayName?: string;
  @IsPhoneNumber(undefined) @IsOptional() phone?: string;
  @IsIn(['en-IN', 'bn-BD', 'hi-IN']) @IsOptional() locale?: string;
}
