import {
  IsArray,
  ArrayMaxSize,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { DeviceCategory } from '@repairproof/shared';

export class CreateDeviceDto {
  @IsEnum(DeviceCategory)
  category!: DeviceCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  make!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  model!: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  serialNumber?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{15}$/)
  imei?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  storageCapacity?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsOptional()
  intakePhotos?: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  intakeCondition!: string;
}

export class UpdateDeviceDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  serialNumber?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{15}$/)
  imei?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  storageCapacity?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  intakePhotos?: string[];

  @IsString()
  @IsOptional()
  intakeCondition?: string;
}
