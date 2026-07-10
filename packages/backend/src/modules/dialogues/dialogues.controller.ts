import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { DialoguesService } from './dialogues.service';
import { ReplyDto } from './dto/reply.dto';

@Controller('conversations')
export class DialoguesController {
  constructor(private readonly service: DialoguesService) {}

  @Get()
  list(@Query('filter') filter?: 'attention' | 'all') {
    return this.service.list(filter === 'all' ? 'all' : 'attention');
  }

  @Get(':id')
  thread(@Param('id') id: string) {
    return this.service.getThread(id);
  }

  @Post(':id/takeover')
  takeover(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.takeover(id, user.displayName);
  }

  @Post(':id/return')
  returnToAi(@Param('id') id: string) {
    return this.service.returnToAi(id);
  }

  @Post(':id/reply')
  reply(@Param('id') id: string, @Body() dto: ReplyDto) {
    return this.service.adminReply(id, dto.text);
  }
}
