export interface Mailer {
  sendMagicLink(email: string, link: string): Promise<void>;
}

export const MAILER = Symbol('MAILER');
