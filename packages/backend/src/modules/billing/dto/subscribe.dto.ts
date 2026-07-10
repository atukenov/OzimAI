import { IsIn } from 'class-validator';

export class SubscribeDto {
  @IsIn(['start', 'growth', 'business'])
  plan: 'start' | 'growth' | 'business';
}
