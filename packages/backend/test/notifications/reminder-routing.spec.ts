import { Channel } from '@ozimai/shared';
import { RemindersService } from '../../src/modules/scheduling/reminders.service';
import { normalizePhone } from '../../src/modules/webchat/phone';

/** Pure routing tests: which transport a reminder takes for each patient type. */
function build(opts: { whatsappConfigured?: boolean; push?: 'sent' | 'gone' | 'failed' | 'not_configured' } = {}) {
  const calls = { chat: [] as string[], sms: [] as string[], push: 0, cleared: 0 };
  const service = new RemindersService(
    {} as any,
    {
      orgId: 'org-1',
      repo: () => ({ update: async () => void calls.cleared++ }),
    } as any,
    { send: async (_c: Channel, phone: string, text: string) => void calls.chat.push(`${phone}:${text}`) } as any,
    { isConfigured: Boolean(opts.whatsappConfigured) } as any,
    { send: async (phone: string, text: string) => (calls.sms.push(`${phone}:${text}`), true) } as any,
    { send: async () => (calls.push++, opts.push ?? 'not_configured') } as any,
    { get: (k: string) => ({ PUBLIC_APP_URL: 'https://app.ozimai.kz/' })[k] } as any,
  );
  const org = { id: 'org-1', name: 'Айгуль', publicSlug: 'aigul' } as any;
  const deliver = (patient: any) =>
    (service as any).deliver(org, { id: 'p1', phone: '77015551234', pushSubscription: null, ...patient }, { label: 'завтра', when: '27 нояб., 14:00', doctor: 'Серикова' });
  return { calls, deliver };
}

describe('Reminder routing', () => {
  it('web chat patient without push gets a short SMS with the chat link', async () => {
    const { calls, deliver } = build();
    expect(await deliver({ sourceChannel: Channel.Web })).toBe('sms');
    expect(calls.sms[0]).toContain('https://app.ozimai.kz/c/aigul');
    expect(calls.chat).toHaveLength(0);
  });

  it('web chat patient with a live push subscription gets push only', async () => {
    const { calls, deliver } = build({ push: 'sent' });
    expect(await deliver({ sourceChannel: Channel.Web, pushSubscription: { endpoint: 'https://x', keys: {} } })).toBe('push');
    expect(calls.sms).toHaveLength(0);
  });

  it('expired push subscription is cleared and falls back to SMS', async () => {
    const { calls, deliver } = build({ push: 'gone' });
    expect(await deliver({ sourceChannel: Channel.Web, pushSubscription: { endpoint: 'https://x', keys: {} } })).toBe('sms');
    expect(calls.cleared).toBe(1);
    expect(calls.sms).toHaveLength(1);
  });

  it('WhatsApp patient stays on WhatsApp when the Cloud API is configured', async () => {
    const { calls, deliver } = build({ whatsappConfigured: true });
    expect(await deliver({ sourceChannel: Channel.WhatsApp })).toBe('chat');
    expect(calls.sms).toHaveLength(0);
  });

  it('WhatsApp patient falls back to SMS when WhatsApp is not configured', async () => {
    const { deliver } = build({ whatsappConfigured: false });
    expect(await deliver({ sourceChannel: Channel.WhatsApp })).toBe('sms');
  });
});

describe('normalizePhone', () => {
  it.each([
    ['+7 (701) 555-12-34', '77015551234'],
    ['8 701 555 12 34', '77015551234'],
    ['7015551234', '77015551234'],
    ['77015551234', '77015551234'],
  ])('%s -> %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it('rejects junk', () => {
    expect(normalizePhone('12345')).toBeNull();
  });
});
