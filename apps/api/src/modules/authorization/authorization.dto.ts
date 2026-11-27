import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CustomerAuthorizationResponseDto {
  @IsBoolean()
  @IsOptional()
  approved?: boolean;

  @IsString()
  @IsIn(['APPROVE', 'REJECT', 'REQUEST_CHANGES'])
  @IsOptional()
  decision?: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  customerSignatureName!: string;
}

export class CreateCustomerDisputeDto {
  @IsString() @IsNotEmpty() @MaxLength(120) reason!: string;
  @IsString() @IsNotEmpty() @MaxLength(3000) description!: string;
}

export class UpdateCustomerLocaleDto {
  @IsString()
  @IsIn(['en-IN', 'bn-BD', 'hi-IN'])
  locale!: string;
}
