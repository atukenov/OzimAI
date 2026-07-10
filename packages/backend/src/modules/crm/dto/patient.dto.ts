import { IsIn, IsOptional, IsString } from 'class-validator';
import { LeadStatus } from '@ozimai/shared';

export class CreatePatientDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class UpdateLeadStatusDto {
  @IsIn(Object.values(LeadStatus))
  status: LeadStatus;
}

export class UpdateNoteDto {
  @IsString()
  note: string;
}
