import { IsArray, IsIn, IsString } from 'class-validator';
import { KnowledgeSourceType } from '@ozimai/shared';

export class ImportKnowledgeDto {
  @IsString()
  raw: string;

  @IsIn([KnowledgeSourceType.Text, KnowledgeSourceType.Csv])
  sourceType: KnowledgeSourceType;
}

export class PublishKnowledgeDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

export class UpsertKnowledgeDto {
  @IsString()
  question: string;

  @IsString()
  answer: string;
}
