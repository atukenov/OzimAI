export interface SmsProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  /** `toPhone` is digits only, international format without "+", e.g. 77011234567. */
  send(toPhone: string, text: string): Promise<boolean>;
}
