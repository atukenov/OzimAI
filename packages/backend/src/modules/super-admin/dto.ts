import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

/** ~110 KB image once base64-encoded; enough for a crisp 256×256 logo. */
export const LOGO_MAX_CHARS = 150_000;

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  /** data: URL (PNG, JPEG or WebP), or null to remove. SVG is refused: it can carry scripts. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(LOGO_MAX_CHARS, { message: 'Логотип слишком большой (до ~100 КБ)' })
  @Matches(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, { message: 'Логотип: PNG, JPEG или WebP' })
  logo?: string | null;
}
