import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrganizationVerificationDto {
  @IsIn(['VERIFIED', 'REJECTED', 'PENDING']) status!: 'VERIFIED' | 'REJECTED' | 'PENDING';
  @IsString() @IsOptional() @MaxLength(2000) notes?: string;
}

export class UpdatePlatformUserAccessDto {
  @IsBoolean() active!: boolean;
}
