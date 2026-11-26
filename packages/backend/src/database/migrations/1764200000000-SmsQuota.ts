import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Monthly SMS allowance per clinic (default 500 segments). `sms_period` is
 * the 'YYYY-MM' the `sms_used` counter belongs to; a new month starts the
 * counter from 0 on the first send. Change a clinic's allowance with:
 *   UPDATE organization SET sms_monthly_limit = 1000 WHERE public_slug = '...';
 */
export class SmsQuota1764200000000 implements MigrationInterface {
  name = 'SmsQuota1764200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS sms_monthly_limit integer NOT NULL DEFAULT 500`);
    await q.query(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS sms_used integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS sms_period text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE organization DROP COLUMN IF EXISTS sms_period`);
    await q.query(`ALTER TABLE organization DROP COLUMN IF EXISTS sms_used`);
    await q.query(`ALTER TABLE organization DROP COLUMN IF EXISTS sms_monthly_limit`);
  }
}
