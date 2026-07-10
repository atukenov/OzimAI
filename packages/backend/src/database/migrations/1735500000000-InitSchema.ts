import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema: all tables from 06 Engineering §03, plus Row-Level
 * Security policies enforcing multi-tenancy at the database layer
 * (ADR-04 / NFR "мультиарендность с изоляцией данных клиник").
 *
 * `organization` and `app_user` are intentionally NOT RLS-protected — see
 * comments on those entities. Every other table is `FORCE ROW LEVEL
 * SECURITY` with a single deny-by-default policy: rows are only visible/
 * writable when `org_id` matches `app.current_org_id`, which
 * TenantScopeInterceptor sets once per request transaction.
 */
export class InitSchema1735500000000 implements MigrationInterface {
  name = 'InitSchema1735500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // The migration/seed connection (DATABASE_URL) is a Postgres superuser in
    // local dev (docker's POSTGRES_USER), and superusers silently BYPASS RLS
    // regardless of FORCE ROW LEVEL SECURITY. The running app must connect as
    // a normal, non-superuser role instead, or every RLS policy below is a
    // no-op — this is exactly what test/tenant/rls-isolation.spec.ts checks.
    await q.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ozimai_app') THEN
          CREATE ROLE ozimai_app WITH LOGIN PASSWORD 'ozimai_app_dev' NOSUPERUSER NOBYPASSRLS;
        END IF;
      END
      $$;
    `);
    await q.query(`GRANT USAGE ON SCHEMA public TO ozimai_app`);

    await q.query(`CREATE TYPE user_role_enum AS ENUM ('owner','admin','staff')`);
    await q.query(`CREATE TYPE billing_status_enum AS ENUM ('trial','active','past_due','read_only')`);
    await q.query(`CREATE TYPE conversation_status_enum AS ENUM ('ai','attention','human')`);
    await q.query(`CREATE TYPE message_sender_type_enum AS ENUM ('patient','ai','admin','system')`);
    await q.query(`CREATE TYPE appointment_status_enum AS ENUM ('held','booked','confirmed','no_show','cancelled')`);
    await q.query(`CREATE TYPE created_by_enum AS ENUM ('ai','human')`);
    await q.query(`CREATE TYPE lead_status_enum AS ENUM ('lead','booked','visited','lost')`);
    await q.query(`CREATE TYPE channel_enum AS ENUM ('whatsapp','instagram','dev_mock')`);
    await q.query(`CREATE TYPE knowledge_source_type_enum AS ENUM ('text','csv','manual')`);

    // ---- organization (RLS-exempt: tenant bootstrap) ----
    await q.query(`
      CREATE TABLE organization (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        plan text NOT NULL DEFAULT 'start',
        locale text NOT NULL DEFAULT 'ru',
        billing_status billing_status_enum NOT NULL DEFAULT 'trial',
        trial_ends_at timestamptz,
        whatsapp_phone_number_id text UNIQUE,
        ai_name text,
        ai_tone text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // ---- app_user (RLS-exempt: login resolves by email pre-tenant-context) ----
    await q.query(`
      CREATE TABLE app_user (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        email text NOT NULL UNIQUE,
        display_name text,
        role user_role_enum NOT NULL DEFAULT 'owner',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX idx_app_user_org ON app_user(org_id)`);

    // ---- branch ----
    await q.query(`
      CREATE TABLE branch (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        name text NOT NULL,
        address text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.protect(q, 'branch');

    // ---- practitioner ----
    await q.query(`
      CREATE TABLE practitioner (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        branch_id uuid NOT NULL REFERENCES branch(id) ON DELETE CASCADE,
        name text NOT NULL,
        working_hours jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.protect(q, 'practitioner');

    // ---- service ----
    await q.query(`
      CREATE TABLE service (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        name text NOT NULL,
        price int NOT NULL,
        duration_min int NOT NULL DEFAULT 30,
        version int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.protect(q, 'service');

    // ---- patient ----
    await q.query(`
      CREATE TABLE patient (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        phone text NOT NULL,
        name text,
        lead_status lead_status_enum NOT NULL DEFAULT 'lead',
        source_channel channel_enum NOT NULL DEFAULT 'whatsapp',
        last_note text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (org_id, phone)
      )
    `);
    await this.protect(q, 'patient');

    // ---- conversation ----
    await q.query(`
      CREATE TABLE conversation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        patient_id uuid NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
        channel channel_enum NOT NULL DEFAULT 'whatsapp',
        status conversation_status_enum NOT NULL DEFAULT 'ai',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX idx_conversation_org_status ON conversation(org_id, status)`);
    await this.protect(q, 'conversation');

    // ---- message ----
    await q.query(`
      CREATE TABLE message (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        conversation_id uuid NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
        sender_type message_sender_type_enum NOT NULL,
        text text NOT NULL,
        ai_meta jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX idx_message_org_conversation ON message(org_id, conversation_id)`);
    await this.protect(q, 'message');

    // ---- appointment ----
    await q.query(`
      CREATE TABLE appointment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        patient_id uuid NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
        practitioner_id uuid NOT NULL REFERENCES practitioner(id) ON DELETE CASCADE,
        service_id uuid REFERENCES service(id) ON DELETE SET NULL,
        slot_start timestamptz NOT NULL,
        status appointment_status_enum NOT NULL DEFAULT 'held',
        created_by created_by_enum NOT NULL DEFAULT 'ai',
        hold_token text,
        reminded_24h_at timestamptz,
        reminded_2h_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX idx_appointment_org_slot ON appointment(org_id, practitioner_id, slot_start)`);
    // Only one non-cancelled/no_show appointment may occupy a given practitioner+slot — the
    // Postgres-level backstop behind the Redis hold for the atomic-booking guarantee.
    await q.query(`
      CREATE UNIQUE INDEX uq_appointment_active_slot
      ON appointment(practitioner_id, slot_start)
      WHERE status IN ('held','booked','confirmed')
    `);
    await this.protect(q, 'appointment');

    // ---- knowledge_doc ----
    await q.query(`
      CREATE TABLE knowledge_doc (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        question text NOT NULL,
        answer text NOT NULL,
        source_type knowledge_source_type_enum NOT NULL DEFAULT 'manual',
        version int NOT NULL DEFAULT 1,
        published_at timestamptz,
        embedding vector(1536),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX idx_knowledge_org_published ON knowledge_doc(org_id, published_at)`);
    await this.protect(q, 'knowledge_doc');

    // ---- audit_log ----
    await q.query(`
      CREATE TABLE audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
        actor text NOT NULL,
        action text NOT NULL,
        entity text NOT NULL,
        entity_id text,
        before jsonb,
        after jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX idx_audit_log_org ON audit_log(org_id)`);
    await this.protect(q, 'audit_log');

    await q.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ozimai_app`);
    await q.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ozimai_app`);
  }

  private async protect(q: QueryRunner, table: string): Promise<void> {
    await q.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    // NULLIF(...,'') matters: once a pooled connection has SET LOCAL'd this
    // custom GUC at least once, it resets to '' (not NULL) after the
    // transaction ends, and '' would otherwise raise a hard cast error
    // instead of the "no rows match" we want for an unscoped connection.
    await q.query(`
      CREATE POLICY tenant_isolation ON ${table}
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'audit_log',
      'knowledge_doc',
      'appointment',
      'message',
      'conversation',
      'patient',
      'service',
      'practitioner',
      'branch',
      'app_user',
      'organization',
    ]) {
      await q.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    for (const type of [
      'knowledge_source_type_enum',
      'channel_enum',
      'lead_status_enum',
      'created_by_enum',
      'appointment_status_enum',
      'message_sender_type_enum',
      'conversation_status_enum',
      'billing_status_enum',
      'user_role_enum',
    ]) {
      await q.query(`DROP TYPE IF EXISTS ${type}`);
    }
    // Postgres refuses to DROP ROLE while it still holds any privileges
    // (including on objects outside this migration, like TypeORM's own
    // `migrations` bookkeeping table) — revoke everything first.
    await q.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ozimai_app`);
    await q.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ozimai_app`);
    await q.query(`REVOKE ALL PRIVILEGES ON SCHEMA public FROM ozimai_app`);
    await q.query(`DROP ROLE IF EXISTS ozimai_app`);
  }
}
