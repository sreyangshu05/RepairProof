import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class IssueCertificateDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  warrantyPeriodMonths?: number;

  @IsString()
  @IsOptional()
  warrantyTerms?: string;
}
