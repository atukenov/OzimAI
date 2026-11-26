export interface Mailer {
  /** True when real email goes out (not just logged). */
  readonly isLive: boolean;
  sendLoginCode(email: string, code: string): Promise<void>;
}

export const MAILER = Symbol('MAILER');
