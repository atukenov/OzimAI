import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { SuperAdminGuard } from '../../common/auth/super-admin';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { AuditService } from '../audit/audit.service';
import { UpdateBrandingDto } from './dto';

/**
 * Platform-level screen for the OzimAI owner: every company's name and logo.
 * `organization` is outside RLS, so listing all companies works from any
 * tenant context.
 */
@UseGuards(SuperAdminGuard)
@Controller('super-admin/organizations')
export class SuperAdminController {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list() {
    const orgs = await this.tenant.manager.getRepository(OrganizationEntity).find({ order: { createdAt: 'DESC' } });
    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      logo: o.logo,
      publicSlug: o.publicSlug,
      billingStatus: o.billingStatus,
      plan: o.plan,
      createdAt: o.createdAt,
    }));
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBrandingDto, @CurrentUser() user: JwtPayload) {
    const repo = this.tenant.manager.getRepository(OrganizationEntity);
    const org = await repo.findOneBy({ id });
    if (!org) throw new NotFoundException('Компания не найдена');
    const before = { name: org.name, hasLogo: Boolean(org.logo) };
    if (dto.name !== undefined) org.name = dto.name.trim();
    if (dto.logo !== undefined) org.logo = dto.logo;
    const saved = await repo.save(org);
    await this.audit.record({
      actor: user.email,
      action: 'organization.branding',
      entity: 'organization',
      entityId: org.id,
      before,
      after: { name: saved.name, hasLogo: Boolean(saved.logo) },
    });
    return { id: saved.id, name: saved.name, logo: saved.logo };
  }
}
