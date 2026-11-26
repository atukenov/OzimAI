import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SuperAdminGuard } from '../../common/auth/super-admin';
import { SuperAdminController } from './super-admin.controller';

@Module({
  imports: [AuditModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminGuard],
})
export class SuperAdminModule {}
