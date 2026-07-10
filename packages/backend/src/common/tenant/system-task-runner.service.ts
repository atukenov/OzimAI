import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserRole } from '@ozimai/shared';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { TenantContextService } from './tenant-context.service';

/**
 * Lets cron jobs and other non-HTTP background work reuse the exact same
 * RLS-scoping guarantee as TenantScopeInterceptor: one transaction, one
 * `SET LOCAL app.current_org_id`, one TenantContextService.run() per org —
 * there is no other sanctioned way for a service to touch tenant tables.
 */
@Injectable()
export class SystemTaskRunner {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  async runAsOrg<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT set_config($1, $2, true)', ['app.current_org_id', orgId]);
      return new Promise<T>((resolve, reject) => {
        this.tenantContext.run({ orgId, userId: 'system', role: UserRole.Owner, manager }, () => {
          fn().then(resolve, reject);
        });
      });
    });
  }

  async forEachOrg(fn: (orgId: string) => Promise<void>): Promise<void> {
    const orgs = await this.dataSource.getRepository(OrganizationEntity).find();
    for (const org of orgs) {
      await this.runAsOrg(org.id, () => fn(org.id));
    }
  }
}
