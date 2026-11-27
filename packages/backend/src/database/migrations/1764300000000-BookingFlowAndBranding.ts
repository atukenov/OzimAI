import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Booking-flow and branding columns:
 * - organization.time_zone: the clinic's wall clock for slots, AI replies and reminders.
 * - organization.logo: a small data: URL image, set only by the platform super admin.
 * - practitioner.specialty / break_time / days_off: so the AI can match "ортодонт",
 *   skip lunch and skip vacation days.
 * - appointment.duration_min: real visit length, so a 90-minute implant blocks 90 minutes.
 */
export class BookingFlowAndBranding1764300000000 implements MigrationInterface {
  name = 'BookingFlowAndBranding1764300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'Asia/Almaty'`);
    await q.query(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS logo text`);
    await q.query(`ALTER TABLE practitioner ADD COLUMN IF NOT EXISTS specialty text`);
    await q.query(`ALTER TABLE practitioner ADD COLUMN IF NOT EXISTS break_time jsonb`);
    await q.query(`ALTER TABLE practitioner ADD COLUMN IF NOT EXISTS days_off jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await q.query(`ALTER TABLE appointment ADD COLUMN IF NOT EXISTS duration_min integer NOT NULL DEFAULT 30`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE appointment DROP COLUMN IF EXISTS duration_min`);
    await q.query(`ALTER TABLE practitioner DROP COLUMN IF EXISTS days_off`);
    await q.query(`ALTER TABLE practitioner DROP COLUMN IF EXISTS break_time`);
    await q.query(`ALTER TABLE practitioner DROP COLUMN IF EXISTS specialty`);
    await q.query(`ALTER TABLE organization DROP COLUMN IF EXISTS logo`);
    await q.query(`ALTER TABLE organization DROP COLUMN IF EXISTS time_zone`);
  }
}
