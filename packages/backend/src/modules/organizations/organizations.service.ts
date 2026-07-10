import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { BranchEntity } from '../../database/entities/branch.entity';
import { PractitionerEntity } from '../../database/entities/practitioner.entity';
import { ServiceEntity } from '../../database/entities/service.entity';
import { CreateBranchDto, CreatePractitionerDto, CreateServiceDto, UpdateOrganizationDto } from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly tenant: TenantContextService) {}

  async getMyOrg(): Promise<OrganizationEntity> {
    return this.tenant.manager.getRepository(OrganizationEntity).findOneByOrFail({ id: this.tenant.orgId });
  }

  async updateMyOrg(dto: UpdateOrganizationDto): Promise<OrganizationEntity> {
    const repo = this.tenant.manager.getRepository(OrganizationEntity);
    const org = await repo.findOneByOrFail({ id: this.tenant.orgId });
    Object.assign(org, dto);
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

  listServices() {
    return this.tenant.repo(ServiceEntity).find({ where: { orgId: this.tenant.orgId } });
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
