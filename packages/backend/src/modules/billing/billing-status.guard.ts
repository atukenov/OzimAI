import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { BillingStatus } from '@ozimai/shared';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OrganizationEntity } from '../../database/entities/organization.entity';

/** Blocks mutating actions once an org is read-only for non-payment (FR "read-only при неуплате"). */
@Injectable()
export class BillingStatusGuard implements CanActivate {
  constructor(private readonly tenant: TenantContextService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const org = await this.tenant.manager.getRepository(OrganizationEntity).findOneByOrFail({ id: this.tenant.orgId });
    if (org.billingStatus === BillingStatus.ReadOnly) {
      throw new ForbiddenException('Organization is read-only: subscription payment is overdue');
    }
    return true;
  }
}
