import { AuthService, MAX_ATTEMPTS_PER_CODE, MAX_FAILS_PER_DAY } from '../../src/modules/auth/auth.service';

/** Minimal in-memory stand-in for the ioredis calls AuthService makes. */
class FakeRedis {
  store = new Map<string, string>();
  async get(k: string) { return this.store.get(k) ?? null; }
  async set(k: string, v: string) { this.store.set(k, v); return 'OK'; }
  async del(k: string) { this.store.delete(k); return 1; }
  async exists(k: string) { return this.store.has(k) ? 1 : 0; }
  async incr(k: string) { const n = Number(this.store.get(k) ?? 0) + 1; this.store.set(k, String(n)); return n; }
  async expire() { return 1; }
  async ttl() { return 300; }
}

function build(opts: { mailerLive?: boolean; existingUser?: boolean } = {}) {
  const redis = new FakeRedis();
  const sent: string[] = [];
  const user = { id: 'u1', orgId: 'o1', email: 'owner@clinic.kz', role: 'owner', displayName: 'owner' };
  const service = new AuthService(
    { findOneByOrFail: async () => ({ id: 'o1', name: 'Clinic' }), save: async (o: any) => ({ id: 'o-new', ...o }), create: (o: any) => o } as any,
    {
      findOne: async () => (opts.existingUser === false ? null : user),
      save: async (u: any) => ({ id: 'u-new', ...u }),
      create: (u: any) => u,
    } as any,
    { sign: () => 'jwt' } as any,
    { get: (k: string) => ({ JWT_SECRET: 'test-secret' })[k] } as any,
    { isLive: Boolean(opts.mailerLive), sendLoginCode: async (_e: string, code: string) => void sent.push(code) } as any,
    redis as any,
  );
  return { service, redis, sent };
}

describe('Email login code', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => (process.env.NODE_ENV = env));

  it('emails a 4-digit code and logs in with it once', async () => {
    const { service, sent } = build();
    await service.requestLoginCode('Owner@Clinic.kz ', undefined, '1.1.1.1');
    expect(sent[0]).toMatch(/^\d{4}$/);
    const res = await service.verifyLoginCode('owner@clinic.kz', sent[0]);
    expect(res.accessToken).toBe('jwt');
    await expect(service.verifyLoginCode('owner@clinic.kz', sent[0])).rejects.toThrow(/устарел/);
  });

  it('never returns the code when real email is configured', async () => {
    const { service } = build({ mailerLive: true });
    expect(await service.requestLoginCode('owner@clinic.kz', undefined, '1.1.1.1')).toEqual({ sent: true });
  });

  it('refuses to issue codes in production without a mail provider', async () => {
    process.env.NODE_ENV = 'production';
    const { service } = build({ mailerLive: false });
    await expect(service.requestLoginCode('owner@clinic.kz', undefined, '1.1.1.1')).rejects.toThrow(/RESEND_API_KEY/);
  });

  it('requires a clinic name for a new email', async () => {
    const { service } = build({ existingUser: false });
    await expect(service.requestLoginCode('new@clinic.kz', undefined, '1.1.1.1')).rejects.toThrow(/orgName/);
  });

  it('burns the code after too many wrong guesses', async () => {
    const { service, sent } = build();
    await service.requestLoginCode('owner@clinic.kz', undefined, '1.1.1.1');
    const wrong = sent[0] === '0000' ? '1111' : '0000';
    for (let i = 0; i < MAX_ATTEMPTS_PER_CODE; i++) {
      await expect(service.verifyLoginCode('owner@clinic.kz', wrong)).rejects.toThrow(/Неверный код/);
    }
    await expect(service.verifyLoginCode('owner@clinic.kz', sent[0])).rejects.toThrow(/устарел/);
  });

  it('enforces a resend cooldown', async () => {
    const { service } = build();
    await service.requestLoginCode('owner@clinic.kz', undefined, '1.1.1.1');
    await expect(service.requestLoginCode('owner@clinic.kz', undefined, '1.1.1.1')).rejects.toThrow(/через минуту/);
  });

  it('locks the email for a day after too many failures', async () => {
    const { service, redis } = build();
    await redis.set('auth:fails:owner@clinic.kz', String(MAX_FAILS_PER_DAY));
    await expect(service.requestLoginCode('owner@clinic.kz', undefined, '1.1.1.1')).rejects.toThrow(/завтра/);
  });
});
