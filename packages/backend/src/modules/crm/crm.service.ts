import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus, Channel } from '@ozimai/shared';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PatientEntity } from '../../database/entities/patient.entity';

@Injectable()
export class CrmService {
  constructor(private readonly tenant: TenantContextService) {}

  list() {
    return this.tenant.repo(PatientEntity).find({ where: { orgId: this.tenant.orgId }, order: { updatedAt: 'DESC' } });
  }

  async get(id: string) {
    const patient = await this.tenant.repo(PatientEntity).findOneBy({ id, orgId: this.tenant.orgId });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  /**
   * Called by the Orchestrator on every inbound message (auto-creates the
   * CRM contact) and by the panel's manual booking flow (find-or-create a
   * patient by phone before creating a walk-in appointment) — idempotent on
   * phone, so it's safe to call from both without risking duplicates.
   */
  async upsertByPhone(phone: string, name: string | null, channel: Channel): Promise<PatientEntity> {
    const repo = this.tenant.repo(PatientEntity);
    let patient = await repo.findOneBy({ orgId: this.tenant.orgId, phone });
    if (!patient) {
      patient = await repo.save(
        repo.create({ orgId: this.tenant.orgId, phone, name, sourceChannel: channel, leadStatus: LeadStatus.Lead }),
      );
    } else if (name && !patient.name) {
      patient.name = name;
      patient = await repo.save(patient);
    }
    return patient;
  }

  async setLeadStatus(id: string, status: LeadStatus) {
    const patient = await this.get(id);
    patient.leadStatus = status;
    return this.tenant.repo(PatientEntity).save(patient);
  }

  async setNote(id: string, note: string) {
    const patient = await this.get(id);
    patient.lastNote = note;
    return this.tenant.repo(PatientEntity).save(patient);
  }
}
