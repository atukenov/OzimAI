import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { TestAppDataSource as AppDataSource } from '../support/app-data-source';
import { OrganizationEntity } from '../../src/database/entities/organization.entity';
import { PatientEntity } from '../../src/database/entities/patient.entity';

/**
 * Integration test against the real Postgres RLS policies from the InitSchema
 * migration (not mocked) — requires `docker compose up -d` + `npm run migrate`
 * first, per the plan's verification section.
 */
describe('Row-Level Security tenant isolation', () => {
  let ds: DataSource;
  let orgA: OrganizationEntity;
  let orgB: OrganizationEntity;

  beforeAll(async () => {
    ds = AppDataSource.isInitialized ? AppDataSource : await AppDataSource.initialize();
    orgA = await ds.getRepository(OrganizationEntity).save({ name: `RLS Test A ${Date.now()}` });
    orgB = await ds.getRepository(OrganizationEntity).save({ name: `RLS Test B ${Date.now()}` });

    await ds.transaction(async (m) => {
      await m.query('SELECT set_config($1, $2, true)', ['app.current_org_id', orgA.id]);
      await m.getRepository(PatientEntity).save({ orgId: orgA.id, phone: '+7 700 000 0001', name: 'Patient A' });
    });
    await ds.transaction(async (m) => {
      await m.query('SELECT set_config($1, $2, true)', ['app.current_org_id', orgB.id]);
      await m.getRepository(PatientEntity).save({ orgId: orgB.id, phone: '+7 700 000 0002', name: 'Patient B' });
    });
  });

  afterAll(async () => {
    // Explicit tenant-scoped cleanup rather than relying on FK CASCADE, whose
    // interaction with FORCE RLS deletes issued outside any org context is
    // not something to depend on in a test.
    for (const org of [orgA, orgB]) {
      await ds.transaction(async (m) => {
        await m.query('SELECT set_config($1, $2, true)', ['app.current_org_id', org.id]);
        await m.getRepository(PatientEntity).delete({ orgId: org.id });
      });
    }
    await ds.getRepository(OrganizationEntity).delete({ id: orgA.id });
    await ds.getRepository(OrganizationEntity).delete({ id: orgB.id });
    await ds.destroy();
  });

  it('a connection scoped to org A cannot see org B patients, even by direct id lookup', async () => {
    await ds.transaction(async (m) => {
      await m.query('SELECT set_config($1, $2, true)', ['app.current_org_id', orgA.id]);
      const visible = await m.getRepository(PatientEntity).find();
      expect(visible.every((p) => p.orgId === orgA.id)).toBe(true);
      expect(visible.some((p) => p.orgId === orgB.id)).toBe(false);
    });
  });

  it('a connection with no org context set sees zero rows (deny by default)', async () => {
    await ds.transaction(async (m) => {
      // no set_config call at all this time
      const visible = await m.getRepository(PatientEntity).find({ where: { phone: '+7 700 000 0001' } });
      expect(visible).toHaveLength(0);
    });
  });
});
