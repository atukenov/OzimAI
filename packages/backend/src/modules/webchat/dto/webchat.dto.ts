import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class StartWebChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  /** Any common KZ/RU format: +7 701 123 45 67, 87011234567, 7011234567 ... */
  @IsString()
  @Matches(/^[\d\s()+-]{10,20}$/, { message: 'Неверный номер телефона' })
  phone: string;
}

export class SendWebChatMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;
}

class PushKeysDto {
  @IsString()
  @MaxLength(200)
  p256dh: string;

  @IsString()
  @MaxLength(100)
  auth: string;
}

export class PushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_tld: true })
  @MaxLength(1000)
  endpoint: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;

  @IsOptional()
  expirationTime?: number | null;
}
