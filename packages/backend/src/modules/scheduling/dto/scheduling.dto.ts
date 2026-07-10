import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class HoldSlotDto {
  @IsString()
  practitionerId: string;

  @IsString()
  patientId: string;

  @IsString()
  slotStart: string; // ISO datetime

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  ttlSec?: number;
}

export class FreeSlotsQueryDto {
  @IsOptional()
  @IsString()
  practitionerId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
