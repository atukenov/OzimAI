import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'node:path';
import { entities } from '../../src/database/data-source';
import { SnakeNamingStrategy } from '../../src/database/snake-naming.strategy';

config({ path: join(__dirname, '../../../../.env') });

/**
 * Same entities/naming strategy as the production DataSource, but connected
 * as the restricted `ozimai_app` role (APP_DATABASE_URL) instead of the
 * migration superuser — RLS tests are meaningless against a superuser
 * connection, since superusers bypass RLS regardless of policy.
 */
export const TestAppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.APP_DATABASE_URL || 'postgres://ozimai_app:ozimai_app_dev@localhost:5433/ozimai',
  entities,
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: false,
});
