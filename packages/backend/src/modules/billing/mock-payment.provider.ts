import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ChargeResult, PaymentProvider } from './payment-provider.interface';

/** Always succeeds — lets the trial→paid flow be demoed/tested without a real payment account. */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async charge(): Promise<ChargeResult> {
    return { ok: true, reference: randomUUID() };
  }
}
