import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantScopeInterceptor } from './tenant-scope.interceptor';
import { SystemTaskRunner } from './system-task-runner.service';

@Global()
@Module({
  providers: [TenantContextService, TenantScopeInterceptor, SystemTaskRunner],
  exports: [TenantContextService, TenantScopeInterceptor, SystemTaskRunner],
})
export class TenantModule {}
