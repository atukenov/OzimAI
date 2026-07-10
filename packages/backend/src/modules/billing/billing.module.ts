import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { KaspiProvider } from './kaspi.provider';
import { MockPaymentProvider } from './mock-payment.provider';
import { PAYMENT_PROVIDER } from './payment-provider.interface';

@Module({
  controllers: [BillingController],
  providers: [BillingService, KaspiProvider, MockPaymentProvider, { provide: PAYMENT_PROVIDER, useExisting: KaspiProvider }],
  exports: [BillingService],
})
export class BillingModule {}
