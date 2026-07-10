import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { AppUserEntity } from '../../database/entities/app-user.entity';
import { AuthService } from './auth.service';
import { RequestMagicLinkDto } from './dto/request-magic-link.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenant: TenantContextService,
  ) {}

  @Public()
  @Post('magic-link')
  requestMagicLink(@Body() dto: RequestMagicLinkDto) {
    return this.auth.requestMagicLink(dto.email, dto.orgName);
  }

  @Public()
  @Post('verify')
  async verify(@Body() dto: VerifyMagicLinkDto) {
    const { accessToken, user, org } = await this.auth.verifyMagicLink(dto.token);
    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName },
      org: { id: org.id, name: org.name, plan: org.plan, locale: org.locale, billingStatus: org.billingStatus },
    };
  }

  @Get('me')
  async me(@CurrentUser() current: JwtPayload) {
    const user = await this.tenant.manager.getRepository(AppUserEntity).findOneByOrFail({ id: current.sub });
    const org = await this.tenant.manager.getRepository(OrganizationEntity).findOneByOrFail({ id: current.orgId });
    return {
      user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName },
      org: { id: org.id, name: org.name, plan: org.plan, locale: org.locale, billingStatus: org.billingStatus },
    };
  }
}
