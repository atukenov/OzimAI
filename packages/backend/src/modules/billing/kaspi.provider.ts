import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChargeResult, PaymentProvider } from './payment-provider.interface';

/**
 * Real Kaspi Pay integration is out of scope for this pass (no merchant
 * account available) — this stub makes that explicit instead of silently
 * pretending to charge. Swap for a real implementation behind the same
 * interface once KASPI_MERCHANT_ID/KASPI_API_KEY are set.
 */
@Injectable()
export class KaspiProvider implements PaymentProvider {
  readonly name = 'kaspi';
  private readonly logger = new Logger(KaspiProvider.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('KASPI_MERCHANT_ID') && this.config.get<string>('KASPI_API_KEY'));
  }

  async charge(orgId: string, amountKzt: number, description: string): Promise<ChargeResult> {
    if (!this.isConfigured) {
      this.logger.warn(`Kaspi Pay not configured — cannot charge org ${orgId} ${amountKzt}₸ (${description})`);
      return { ok: false, error: 'Kaspi Pay is not configured yet' };
    }
    // Real Kaspi Pay B2B API call would go here.
    return { ok: false, error: 'Kaspi Pay integration not implemented' };
  }
}
