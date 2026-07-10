import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(['ru', 'kk'])
  locale?: 'ru' | 'kk';

  @IsOptional()
  @IsString()
  aiName?: string;

  @IsOptional()
  @IsString()
  aiTone?: string;
}

export class CreateBranchDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class WorkingHoursDayDto {
  open?: string;
  close?: string;
}

export class CreatePractitionerDto {
  @IsString()
  branchId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  workingHours?: Record<number, [string, string] | null>;
}

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name: string;

  price: number;

  @IsOptional()
  durationMin?: number;
}
