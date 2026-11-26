import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import Redis from 'ioredis';
import { BillingStatus, UserRole } from '@ozimai/shared';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { AppUserEntity } from '../../database/entities/app-user.entity';
import { REDIS_CLIENT } from '../../common/redis/redis.module';
import { MAILER, Mailer } from './mailer/mailer.interface';

const TRIAL_DAYS = 14;

/** Login-code limits. A 4-digit code is only safe because guesses are scarce. */
export const CODE_TTL_SEC = 10 * 60;
export const MAX_ATTEMPTS_PER_CODE = 5;
export const RESEND_COOLDOWN_SEC = 60;
export const MAX_CODES_PER_HOUR = 5;
export const MAX_FAILS_PER_DAY = 10;

interface StoredCode {
  hash: string;
  orgName?: string;
  attempts: number;
}

const tooMany = (msg: string) => new HttpException(msg, HttpStatus.TOO_MANY_REQUESTS);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(OrganizationEntity) private readonly orgs: Repository<OrganizationEntity>,
    @InjectRepository(AppUserEntity) private readonly users: Repository<AppUserEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashCode(email: string, code: string): string {
    const secret = this.config.get<string>('JWT_SECRET') || 'dev-only-change-me';
    return createHmac('sha256', secret).update(`login-code:${email}:${code}`).digest('hex');
  }

  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private async assertNotLocked(email: string) {
    const fails = Number(await this.redis.get(`auth:fails:${email}`)) || 0;
    if (fails >= MAX_FAILS_PER_DAY) throw tooMany('Слишком много неверных попыток. Попробуйте завтра.');
  }

  /** Bumps a counter with a TTL set on first use; returns the new value. */
  private async bump(key: string, ttlSec: number): Promise<number> {
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, ttlSec);
    return n;
  }

  /**
   * Emails a fresh 4-digit code. `devCode` is echoed back only outside
   * production when no mail provider is configured (local dev).
   */
  async requestLoginCode(rawEmail: string, orgName: string | undefined, ip: string): Promise<{ sent: true; devCode?: string }> {
    const email = AuthService.normalizeEmail(rawEmail);
    if (this.isProduction && !this.mailer.isLive) {
      throw new ServiceUnavailableException('Отправка писем не настроена (RESEND_API_KEY)');
    }
    await this.assertNotLocked(email);

    const existing = await this.users.findOne({ where: { email } });
    if (!existing && !orgName) {
      throw new BadRequestException('orgName is required for a first-time sign-in');
    }

    if (await this.redis.exists(`auth:cooldown:${email}`)) {
      throw tooMany('Код уже отправлен. Повторно можно запросить через минуту.');
    }
    if ((await this.bump(`auth:ip:${ip}`, 3600)) > 20) throw tooMany('Слишком много запросов. Попробуйте позже.');
    if ((await this.bump(`auth:sent:${email}`, 3600)) > MAX_CODES_PER_HOUR) {
      throw tooMany('Слишком много кодов за час. Попробуйте позже.');
    }

    const code = String(randomInt(0, 10_000)).padStart(4, '0');
    const stored: StoredCode = { hash: this.hashCode(email, code), orgName: existing ? undefined : orgName, attempts: 0 };
    await this.redis.set(`auth:code:${email}`, JSON.stringify(stored), 'EX', CODE_TTL_SEC);
    await this.redis.set(`auth:cooldown:${email}`, '1', 'EX', RESEND_COOLDOWN_SEC);

    await this.mailer.sendLoginCode(email, code);
    return !this.mailer.isLive && !this.isProduction ? { sent: true, devCode: code } : { sent: true };
  }

  async verifyLoginCode(rawEmail: string, code: string): Promise<{ accessToken: string; user: AppUserEntity; org: OrganizationEntity }> {
    const email = AuthService.normalizeEmail(rawEmail);
    await this.assertNotLocked(email);

    const key = `auth:code:${email}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new UnauthorizedException('Код устарел — запросите новый');
    const stored = JSON.parse(raw) as StoredCode;

    const expected = Buffer.from(stored.hash, 'hex');
    const actual = Buffer.from(this.hashCode(email, code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await this.bump(`auth:fails:${email}`, 24 * 3600);
      stored.attempts += 1;
      if (stored.attempts >= MAX_ATTEMPTS_PER_CODE) {
        await this.redis.del(key);
        throw new UnauthorizedException('Неверный код. Попытки закончились — запросите новый код');
      }
      const ttl = await this.redis.ttl(key);
      await this.redis.set(key, JSON.stringify(stored), 'EX', Math.max(ttl, 1));
      throw new UnauthorizedException(`Неверный код. Осталось попыток: ${MAX_ATTEMPTS_PER_CODE - stored.attempts}`);
    }
    await this.redis.del(key);
    await this.redis.del(`auth:fails:${email}`);

    const payload = { email, orgName: stored.orgName };
    let org: OrganizationEntity;

    let user = await this.users.findOne({ where: { email: payload.email } });

    if (!user) {
      org = await this.orgs.save(
        this.orgs.create({
          name: payload.orgName!,
          plan: 'start',
          locale: 'ru',
          billingStatus: BillingStatus.Trial,
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
        }),
      );
      user = await this.users.save(
        this.users.create({
          orgId: org.id,
          email: payload.email,
          displayName: payload.email.split('@')[0],
          role: UserRole.Owner,
        }),
      );
    } else {
      org = await this.orgs.findOneByOrFail({ id: user.orgId });
    }

    const accessToken = this.jwt.sign({
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
      email: user.email,
      displayName: user.displayName ?? user.email.split('@')[0],
    });

    return { accessToken, user, org };
  }
}
