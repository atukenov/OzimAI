import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RequestCodeDto {
  @IsEmail()
  email: string;

  /** Required only when bootstrapping a brand-new organization on first sign-in. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  orgName?: string;
}

export class VerifyCodeDto {
  @IsEmail()
  email: string;

  @Matches(/^\d{4}$/, { message: 'Код — 4 цифры' })
  code: string;
}
