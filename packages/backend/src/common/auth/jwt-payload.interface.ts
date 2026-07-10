import { UserRole } from '@ozimai/shared';

export interface JwtPayload {
  sub: string; // user id
  orgId: string;
  role: UserRole;
  email: string;
  displayName: string;
}
