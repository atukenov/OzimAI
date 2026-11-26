import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { AppUserEntity } from '../../database/entities/app-user.entity';
import { AuthService } from './auth.service';
import { RequestCodeDto, VerifyCodeDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tenant: TenantContextService,
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
