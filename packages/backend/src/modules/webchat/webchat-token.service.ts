import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface WebChatTokenPayload {
  kind: 'webchat';
  orgId: string;
  patientId: string;
  /** Browser session id; scopes which conversation this visitor can read. */
  sid: string;
}

/**
 * Visitor tokens are signed with a DIFFERENT secret than panel JWTs, so a
 * web chat token can never be replayed against the admin API (and vice
 * versa) even though both are plain HS256 JWTs.
 */
@Injectable()
export class WebChatTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get secret(): string {
    return this.config.get<string>('WEBCHAT_JWT_SECRET') || `${this.config.get<string>('JWT_SECRET') || 'dev-only-change-me'}::webchat`;
  }

  sign(payload: Omit<WebChatTokenPayload, 'kind'>): string {
    return this.jwt.sign({ ...payload, kind: 'webchat' }, { secret: this.secret, expiresIn: '90d' });
  }

  verify(authHeader: string | undefined, expectedOrgId: string): WebChatTokenPayload {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Missing chat token');
    let payload: WebChatTokenPayload;
    try {
      payload = this.jwt.verify<WebChatTokenPayload>(token, { secret: this.secret });
    } catch {
      throw new UnauthorizedException('Invalid chat token');
    }
    if (payload.kind !== 'webchat' || payload.orgId !== expectedOrgId) throw new UnauthorizedException('Invalid chat token');
    return payload;
  }
}
