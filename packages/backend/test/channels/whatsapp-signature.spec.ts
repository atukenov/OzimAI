import { createHmac } from 'node:crypto';
import { WhatsAppWebhookSignature } from '../../src/modules/channels/channels.controller';

describe('WhatsApp webhook signature', () => {
  const body = Buffer.from('{"entry":[]}');
  const sig = 'sha256=' + createHmac('sha256', 'app-secret').update(body).digest('hex');

  it('accepts a correctly signed body', () => {
    expect(WhatsAppWebhookSignature.isValid('app-secret', body, sig)).toBe(true);
  });

  it('rejects a wrong secret, a tampered body or a missing header', () => {
    expect(WhatsAppWebhookSignature.isValid('other', body, sig)).toBe(false);
    expect(WhatsAppWebhookSignature.isValid('app-secret', Buffer.from('{}'), sig)).toBe(false);
    expect(WhatsAppWebhookSignature.isValid('app-secret', body, undefined)).toBe(false);
  });
});
