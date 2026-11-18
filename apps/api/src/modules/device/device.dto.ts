import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DeviceCategory } from '@repairproof/shared';

export class CreateDeviceDto {
  @IsEnum(DeviceCategory)
  category!: DeviceCategory;

  @IsString()
  @IsNotEmpty()
  make!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsString()
  @IsOptional()
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
  @IsNotEmpty()
  intakeCondition!: string;
}

export class UpdateDeviceDto {
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsString()
  @IsOptional()
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
