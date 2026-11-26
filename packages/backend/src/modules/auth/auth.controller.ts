import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { AppUserEntity } from '../../database/entities/app-user.entity';
import { ConfigService } from '@nestjs/config';
import { isSuperAdminEmail } from '../../common/auth/super-admin';
import { AuthService } from './auth.service';
import { RequestCodeDto, VerifyCodeDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenant: TenantContextService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('request-code')
  requestCode(@Body() dto: RequestCodeDto, @Ip() ip: string) {
    return this.auth.requestLoginCode(dto.email, dto.orgName, ip || 'unknown');
  }

  @Public()
  @Post('verify')
  async verify(@Body() dto: VerifyCodeDto) {
    const { accessToken, user, org } = await this.auth.verifyLoginCode(dto.email, dto.code);
    return {
      accessToken,
      user: this.userView(user),
      org: orgView(org),
    };
  }

  @Get('me')
  async me(@CurrentUser() current: JwtPayload) {
    const user = await this.tenant.manager.getRepository(AppUserEntity).findOneByOrFail({ id: current.sub });
    const org = await this.tenant.manager.getRepository(OrganizationEntity).findOneByOrFail({ id: current.orgId });
    return { user: this.userView(user), org: orgView(org) };
  }

  private userView(user: AppUserEntity) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      isSuperAdmin: isSuperAdminEmail(user.email, this.config),
    };
  }
}

function orgView(org: OrganizationEntity) {
  return { id: org.id, name: org.name, logo: org.logo, plan: org.plan, locale: org.locale, billingStatus: org.billingStatus };
}
