export interface ChargeResult {
  ok: boolean;
  reference?: string;
  error?: string;
}

export interface PaymentProvider {
  readonly name: string;
  charge(orgId: string, amountKzt: number, description: string): Promise<ChargeResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
