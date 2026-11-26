import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './jwt-payload.interface';

/**
 * The platform owner (not a clinic role). Listed by email in
 * SUPER_ADMIN_EMAILS (comma-separated); they sign in with the normal email
 * code and get the extra "Компании" screen.
 */
export function isSuperAdminEmail(email: string | undefined | null, config: ConfigService): boolean {
  if (!email) return false;
  const list = (config.get<string>('SUPER_ADMIN_EMAILS') || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const user: JwtPayload | undefined = context.switchToHttp().getRequest().user;
    if (!isSuperAdminEmail(user?.email, this.config)) {
      throw new ForbiddenException('Только для администратора платформы');
    }
    return true;
  }
}
