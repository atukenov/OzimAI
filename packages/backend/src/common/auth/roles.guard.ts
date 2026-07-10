import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@ozimai/shared';
import { ROLES_KEY } from './roles.decorator';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role for this action');
    }
    return true;
  }
}
