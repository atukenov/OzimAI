import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BillingStatus, UserRole } from '@ozimai/shared';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { AppUserEntity } from '../../database/entities/app-user.entity';
import { MAILER, Mailer } from './mailer/mailer.interface';

interface MagicTokenPayload {
  type: 'magic';
  email: string;
  orgName?: string;
}

const TRIAL_DAYS = 14;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(OrganizationEntity) private readonly orgs: Repository<OrganizationEntity>,
    @InjectRepository(AppUserEntity) private readonly users: Repository<AppUserEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  async requestMagicLink(email: string, orgName?: string): Promise<{ devMagicLink: string }> {
    const existing = await this.users.findOne({ where: { email } });
    if (!existing && !orgName) {
      throw new BadRequestException('orgName is required for a first-time sign-in');
    }

    const payload: MagicTokenPayload = { type: 'magic', email, orgName };
    const token = this.jwt.sign(payload, { expiresIn: '15m' });
    const base = this.config.get<string>('MAGIC_LINK_BASE_URL') || 'http://localhost:5173/auth/verify';
    const link = `${base}?token=${encodeURIComponent(token)}`;

    await this.mailer.sendMagicLink(email, link);

    // Dev convenience: no real mail transport is configured yet, so the link
    // is echoed back for the frontend to use directly. Remove once a real
    // Mailer implementation is wired up.
    return { devMagicLink: link };
  }

  async verifyMagicLink(token: string): Promise<{ accessToken: string; user: AppUserEntity; org: OrganizationEntity }> {
    let payload: MagicTokenPayload;
    try {
      payload = this.jwt.verify<MagicTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Magic link is invalid or expired');
    }
    if (payload.type !== 'magic') {
      throw new UnauthorizedException('Invalid token type');
    }

    let user = await this.users.findOne({ where: { email: payload.email } });
    let org: OrganizationEntity;

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
