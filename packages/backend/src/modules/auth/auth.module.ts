import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { AppUserEntity } from '../../database/entities/app-user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MAILER } from './mailer/mailer.interface';
import { ConsoleMailerService } from './mailer/console-mailer.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationEntity, AppUserEntity])],
  controllers: [AuthController],
  providers: [AuthService, { provide: MAILER, useClass: ConsoleMailerService }],
  exports: [AuthService],
})
export class AuthModule {}
