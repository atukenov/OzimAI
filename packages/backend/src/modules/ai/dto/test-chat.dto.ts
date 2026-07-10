import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TestChatTurnDto {
  @IsIn(['user', 'ai'])
  from: 'user' | 'ai';

  @IsString()
  text: string;
}

export class TestChatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestChatTurnDto)
  history: TestChatTurnDto[];

  @IsString()
  message: string;
}
