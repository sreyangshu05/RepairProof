import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CustomerAuthorizationResponseDto {
  @IsBoolean()
  approved!: boolean;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsNotEmpty()
  customerSignatureName!: string;
}
