import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RequestMagicLinkDto {
  @IsEmail()
  email: string;

  /** Required only when bootstrapping a brand-new organization on first sign-in. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  orgName?: string;
}
