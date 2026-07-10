import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AppointmentStatus, CreatedBy } from '@ozimai/shared';
import { TestAppDataSource as AppDataSource } from '../support/app-data-source';
import { OrganizationEntity } from '../../src/database/entities/organization.entity';
import { BranchEntity } from '../../src/database/entities/branch.entity';
import { PractitionerEntity } from '../../src/database/entities/practitioner.entity';
import { PatientEntity } from '../../src/database/entities/patient.entity';
import { AppointmentEntity } from '../../src/database/entities/appointment.entity';

/**
 * Exercises the Postgres partial unique index
 * (practitioner_id, slot_start) WHERE status IN (held,booked,confirmed) —
 * the atomicity backstop behind SchedulingService.bookDirect's Redis lock
 * (see 06 Engineering's "double booking" edge case). Requires a running
 * Postgres with migrations applied.
 */
describe('appointment slot atomicity', () => {
  let ds: DataSource;
  let org: OrganizationEntity;
  let practitionerId: string;
  let patientAId: string;
  let patientBId: string;
  const slotStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // a week out, deterministic and collision-free with seed data

  beforeAll(async () => {
    ds = AppDataSource.isInitialized ? AppDataSource : await AppDataSource.initialize();
    org = await ds.getRepository(OrganizationEntity).save({ name: `Atomicity Test ${Date.now()}` });

    await ds.transaction(async (m) => {
      await m.query('SELECT set_config($1, $2, true)', ['app.current_org_id', org.id]);
      const branch = await m.getRepository(BranchEntity).save({ orgId: org.id, name: 'Test branch' });
      const practitioner = await m
        .getRepository(PractitionerEntity)
        .save({ orgId: org.id, branchId: branch.id, name: 'Dr Test', workingHours: {} });
      practitionerId = practitioner.id;
      const [a, b] = await m
        .getRepository(PatientEntity)
        .save([
          { orgId: org.id, phone: '+7 700 111 0001', name: 'A' },
          { orgId: org.id, phone: '+7 700 111 0002', name: 'B' },
        ]);
      patientAId = a.id;
      patientBId = b.id;
    });
  });

  afterAll(async () => {
    await ds.transaction(async (m) => {
      await m.query('SELECT set_config($1, $2, true)', ['app.current_org_id', org.id]);
      await m.getRepository(AppointmentEntity).delete({ orgId: org.id });
      await m.getRepository(PatientEntity).delete({ orgId: org.id });
      await m.getRepository(PractitionerEntity).delete({ orgId: org.id });
      await m.getRepository(BranchEntity).delete({ orgId: org.id });
    });
    await ds.getRepository(OrganizationEntity).delete({ id: org.id });
    await ds.destroy();
  });

  it('only one of two concurrent bookings for the same practitioner+slot succeeds', async () => {
    const attempt = (patientId: string) =>
      ds.transaction(async (m) => {
        await m.query('SELECT set_config($1, $2, true)', ['app.current_org_id', org.id]);
        return m.getRepository(AppointmentEntity).save({
          orgId: org.id,
          patientId,
          practitionerId,
          slotStart,
          status: AppointmentStatus.Booked,
          createdBy: CreatedBy.Ai,
        });
      });

    const results = await Promise.allSettled([attempt(patientAId), attempt(patientBId)]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason?.code).toBe('23505');
  });
});
