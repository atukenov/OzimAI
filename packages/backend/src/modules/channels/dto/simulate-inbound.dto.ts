import { IsOptional, IsString } from 'class-validator';

export class SimulateInboundDto {
  @IsString()
  phone: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  nameGuess?: string;
}
