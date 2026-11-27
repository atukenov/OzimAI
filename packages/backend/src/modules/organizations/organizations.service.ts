import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Not } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { BranchEntity } from '../../database/entities/branch.entity';
import { PractitionerEntity } from '../../database/entities/practitioner.entity';
import { ServiceEntity } from '../../database/entities/service.entity';
import { smsPeriod, usedThisMonth } from '../notifications/sms/sms-quota';
import { CreateBranchDto, CreatePractitionerDto, CreateServiceDto, UpdateOrganizationDto, UpdatePractitionerDto, UpdateServiceDto } from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly config: ConfigService,
  ) {}

  async getMyOrg(): Promise<OrganizationEntity & { smsUsedThisMonth: number }> {
    const org = await this.tenant.manager.getRepository(OrganizationEntity).findOneByOrFail({ id: this.tenant.orgId });
    const period = smsPeriod(new Date(), org.timeZone || this.config.get<string>('CLINIC_TIMEZONE') || 'Asia/Almaty');
    return Object.assign(org, { smsUsedThisMonth: usedThisMonth(org, period) });
  }

  async updateMyOrg(dto: UpdateOrganizationDto): Promise<OrganizationEntity> {
    const repo = this.tenant.manager.getRepository(OrganizationEntity);
    const org = await repo.findOneByOrFail({ id: this.tenant.orgId });
    if (dto.publicSlug && (await repo.existsBy({ publicSlug: dto.publicSlug, id: Not(org.id) }))) {
      throw new ConflictException('Этот адрес чата уже занят');
    }
    if (dto.timeZone !== undefined && !isValidTimeZone(dto.timeZone)) {
      throw new BadRequestException('Неизвестный часовой пояс');
    }
    // Explicit fields only: name and logo belong to the super admin.
    const { publicSlug, locale, aiName, aiTone, timeZone } = dto;
    Object.assign(org, stripUndefined({ publicSlug, locale, aiName, aiTone, timeZone }));
    return repo.save(org);
  }

  listBranches() {
    return this.tenant.repo(BranchEntity).find({ where: { orgId: this.tenant.orgId } });
  }

  createBranch(dto: CreateBranchDto) {
    const repo = this.tenant.repo(BranchEntity);
    return repo.save(repo.create({ orgId: this.tenant.orgId, name: dto.name, address: dto.address ?? '' }));
  }

  listPractitioners() {
    return this.tenant.repo(PractitionerEntity).find({ where: { orgId: this.tenant.orgId } });
  }

  async createPractitioner(dto: CreatePractitionerDto) {
    const branch = await this.tenant.repo(BranchEntity).findOneBy({ id: dto.branchId, orgId: this.tenant.orgId });
    if (!branch) throw new NotFoundException('Branch not found');
    const repo = this.tenant.repo(PractitionerEntity);
    return repo.save(
      repo.create({
        orgId: this.tenant.orgId,
        branchId: dto.branchId,
        name: dto.name,
        specialty: dto.specialty?.trim() || null,
        workingHours: dto.workingHours ?? defaultWorkingHours(),
      }),
    );
  }

  async updatePractitionerHours(id: string, workingHours: Record<number, [string, string] | null>) {
    const repo = this.tenant.repo(PractitionerEntity);
    const p = await repo.findOneBy({ id, orgId: this.tenant.orgId });
    if (!p) throw new NotFoundException('Practitioner not found');
    p.workingHours = workingHours;
    return repo.save(p);
  }

  async updatePractitioner(id: string, dto: UpdatePractitionerDto) {
    const repo = this.tenant.repo(PractitionerEntity);
    const p = await repo.findOneBy({ id, orgId: this.tenant.orgId });
    if (!p) throw new NotFoundException('Practitioner not found');
    if (dto.name !== undefined) p.name = dto.name.trim();
    if (dto.specialty !== undefined) p.specialty = dto.specialty.trim() || null;
    if (dto.breakTime !== undefined) {
      if (dto.breakTime && dto.breakTime[0] >= dto.breakTime[1]) throw new BadRequestException('Перерыв: начало должно быть раньше конца');
      p.breakTime = dto.breakTime;
    }
    if (dto.daysOff !== undefined) p.daysOff = [...new Set(dto.daysOff)].sort();
    return repo.save(p);
  }

  listServices() {
    return this.tenant.repo(ServiceEntity).find({ where: { orgId: this.tenant.orgId } });
  }

  async updateService(id: string, dto: UpdateServiceDto) {
    const repo = this.tenant.repo(ServiceEntity);
    const svc = await repo.findOneBy({ id, orgId: this.tenant.orgId });
    if (!svc) throw new NotFoundException('Service not found');
    Object.assign(svc, stripUndefined({ name: dto.name?.trim(), price: dto.price, durationMin: dto.durationMin }));
    svc.version += 1;
    return repo.save(svc);
  }

  createService(dto: CreateServiceDto) {
    const repo = this.tenant.repo(ServiceEntity);
    return repo.save(
      repo.create({ orgId: this.tenant.orgId, name: dto.name, price: dto.price, durationMin: dto.durationMin ?? 30 }),
    );
  }
}

function defaultWorkingHours(): Record<number, [string, string] | null> {
  // Every day 09:00-20:00 — matches the seeded demo clinic's knowledge base ("ежедневно, включая выходные").
  const hours: [string, string] = ['09:00', '20:00'];
  return { 0: hours, 1: hours, 2: hours, 3: hours, 4: hours, 5: hours, 6: hours };
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
