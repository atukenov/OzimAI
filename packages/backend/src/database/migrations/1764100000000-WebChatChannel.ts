import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Web chat channel + non-WhatsApp reminders.
 *
 * `ALTER TYPE ... ADD VALUE` is allowed inside a transaction on Postgres 12+
 * as long as the new value isn't *used* in that same transaction — nothing
 * here writes 'web'. Statements are idempotent so a re-run is harmless.
 */
export class WebChatChannel1764100000000 implements MigrationInterface {
  name = 'WebChatChannel1764100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TYPE channel_enum ADD VALUE IF NOT EXISTS 'web'`);

    await q.query(`ALTER TABLE organization ADD COLUMN IF NOT EXISTS public_slug text`);
    await q.query(`UPDATE organization SET public_slug = substr(md5(id::text || random()::text), 1, 10) WHERE public_slug IS NULL`);
    await q.query(`ALTER TABLE organization ALTER COLUMN public_slug SET DEFAULT substr(md5(gen_random_uuid()::text), 1, 10)`);
    await q.query(`ALTER TABLE organization ALTER COLUMN public_slug SET NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS organization_public_slug_key ON organization (public_slug)`);

    await q.query(`ALTER TABLE patient ADD COLUMN IF NOT EXISTS push_subscription jsonb`);

    await q.query(`ALTER TABLE conversation ADD COLUMN IF NOT EXISTS web_session_id uuid`);
    await q.query(`CREATE INDEX IF NOT EXISTS conversation_org_web_session_idx ON conversation (org_id, web_session_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS conversation_org_web_session_idx`);
    await q.query(`ALTER TABLE conversation DROP COLUMN IF EXISTS web_session_id`);
    await q.query(`ALTER TABLE patient DROP COLUMN IF EXISTS push_subscription`);
    await q.query(`DROP INDEX IF EXISTS organization_public_slug_key`);
    await q.query(`ALTER TABLE organization DROP COLUMN IF EXISTS public_slug`);
    // Postgres cannot drop an enum value; 'web' stays in channel_enum (harmless).
  }
}
