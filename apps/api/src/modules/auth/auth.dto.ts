import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { UserRole } from '@repairproof/shared';

export class SignUpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  shopName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  phone?: string;

  @IsBoolean()
  @IsOptional()
  analyticsConsent?: boolean;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}

export class RequestEmailOtpDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyEmailOtpDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Matches(/^\d{6,10}$/)
  token!: string;
}

export class SyncProfileDto {
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsOptional()
  phone?: string;
}
