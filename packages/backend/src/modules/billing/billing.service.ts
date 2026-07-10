import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingStatus } from '@ozimai/shared';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { SystemTaskRunner } from '../../common/tenant/system-task-runner.service';
import { AuditService } from '../audit/audit.service';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider.interface';
import { KaspiProvider } from './kaspi.provider';
import { MockPaymentProvider } from './mock-payment.provider';

const PLAN_PRICE_KZT: Record<string, number> = { start: 39_000, growth: 89_000, business: 189_000 };
const READ_ONLY_AFTER_DAYS = 7;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
    private readonly runner: SystemTaskRunner,
    @Inject(PAYMENT_PROVIDER) private readonly primaryProvider: KaspiProvider,
    private readonly mockProvider: MockPaymentProvider,
  ) {}

  async getStatus(): Promise<OrganizationEntity> {
    return this.tenant.manager.getRepository(OrganizationEntity).findOneByOrFail({ id: this.tenant.orgId });
  }

  async subscribe(plan: 'start' | 'growth' | 'business'): Promise<OrganizationEntity> {
    const price = PLAN_PRICE_KZT[plan];
    if (!price) throw new BadRequestException('Unknown plan');

    const provider: PaymentProvider = this.primaryProvider.isConfigured ? this.primaryProvider : this.mockProvider;
    const result = await provider.charge(this.tenant.orgId, price, `OzimAI подписка — ${plan}`);
    if (!result.ok) {
      throw new BadRequestException(result.error ?? 'Payment failed');
    }

    const repo = this.tenant.manager.getRepository(OrganizationEntity);
    const org = await repo.findOneByOrFail({ id: this.tenant.orgId });
    org.plan = plan;
    org.billingStatus = BillingStatus.Active;
    const saved = await repo.save(org);
    await this.audit.record({
      actor: this.tenant.userId,
      action: 'billing.subscribe',
      entity: 'organization',
      entityId: org.id,
      after: { plan, provider: provider.name, reference: result.reference },
    });
    return saved;
  }

  /** Trial expiry -> past_due -> read_only, per the "07 days read-only, no data deleted" flow in 03 UX. */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepExpirations() {
    await this.runner.forEachOrg(async () => {
      const repo = this.tenant.manager.getRepository(OrganizationEntity);
      const org = await repo.findOneByOrFail({ id: this.tenant.orgId });
      const now = new Date();

      if (org.billingStatus === BillingStatus.Trial && org.trialEndsAt && org.trialEndsAt < now) {
        org.billingStatus = BillingStatus.PastDue;
        await repo.save(org);
        this.logger.log(`Org ${org.id} trial expired -> past_due`);
      } else if (org.billingStatus === BillingStatus.PastDue && org.trialEndsAt) {
        const readOnlyAt = new Date(org.trialEndsAt.getTime() + READ_ONLY_AFTER_DAYS * 24 * 60 * 60 * 1000);
        if (now > readOnlyAt) {
          org.billingStatus = BillingStatus.ReadOnly;
          await repo.save(org);
          this.logger.log(`Org ${org.id} past_due grace period ended -> read_only`);
        }
      }
    });
  }
}
