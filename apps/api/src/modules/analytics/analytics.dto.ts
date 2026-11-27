import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class UpdateAnalyticsConsentDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @MaxLength(40)
  noticeVersion!: string;
}
