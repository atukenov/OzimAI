import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditLogEntity } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(private readonly tenant: TenantContextService) {}

  async record(params: {
    actor: 'ai' | string;
    action: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
  }): Promise<void> {
    const repo = this.tenant.repo(AuditLogEntity);
    await repo.save(
      repo.create({
        orgId: this.tenant.orgId,
        actor: params.actor,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before ?? null,
        after: params.after ?? null,
      }),
    );
  }
}
