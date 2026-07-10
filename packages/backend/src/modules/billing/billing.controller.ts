import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { UserRole } from '@ozimai/shared';
import { BillingService } from './billing.service';
import { SubscribeDto } from './dto/subscribe.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('me')
  getStatus() {
    return this.service.getStatus();
  }

  @Roles(UserRole.Owner)
  @Post('subscribe')
  subscribe(@Body() dto: SubscribeDto) {
    return this.service.subscribe(dto.plan);
  }
}
