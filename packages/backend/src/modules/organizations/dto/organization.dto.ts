import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';

/**
 * What a clinic's owner/admin may change. Name and logo are deliberately not
 * here: only the platform super admin sets them (see SuperAdminController).
 */
export class UpdateOrganizationDto {
  @IsOptional()
  @IsIn(['ru', 'kk'])
  locale?: 'ru' | 'kk';

  @IsOptional()
  @IsString()
  aiName?: string;

  @IsOptional()
  @IsString()
  aiTone?: string;

  /** IANA zone, e.g. 'Asia/Almaty' (validated in the service). */
  @IsOptional()
  @IsString()
  timeZone?: string;

  /** Web chat address: /c/<publicSlug>. Lowercase latin, digits and dashes. */
  @IsOptional()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, { message: 'Адрес: 3–40 символов, латиница, цифры и дефис' })
  publicSlug?: string;
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

  @IsOptional()
  @IsString()
  specialty?: string;
}

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdatePractitionerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** Empty string clears it. */
  @IsOptional()
  @IsString()
  specialty?: string;

  /** ["13:00","14:00"], or null for no break. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @Matches(HM, { each: true, message: 'Перерыв: время в формате ЧЧ:ММ' })
  breakTime?: [string, string] | null;

  /** Local dates 'YYYY-MM-DD'. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(366)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true, message: 'Выходные: даты в формате ГГГГ-ММ-ДД' })
  daysOff?: string[];
}

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @Min(0)
  price: number;

  /** Visit length; the calendar blocks this many minutes. */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  durationMin?: number;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  durationMin?: number;
}
