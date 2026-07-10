import { Module } from '@nestjs/common';
import { DialoguesController } from './dialogues.controller';
import { DialoguesService } from './dialogues.service';
import { DialoguesGateway } from './dialogues.gateway';

@Module({
  controllers: [DialoguesController],
  providers: [DialoguesService, DialoguesGateway],
  exports: [DialoguesService, DialoguesGateway],
})
export class DialoguesModule {}
