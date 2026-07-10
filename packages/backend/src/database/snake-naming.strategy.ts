import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

function camelToSnake(input: string): string {
  return input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Migrations (InitSchema) are hand-written raw SQL with snake_case columns
 * (org_id, billing_status, created_at...) — this strategy makes entity
 * property names (orgId, billingStatus, createdAt...) resolve to those same
 * column names instead of TypeORM's camelCase default, without needing an
 * explicit `name:` on every single @Column().
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  columnName(propertyName: string, customName: string | undefined, embeddedPrefixes: string[]): string {
    const base = embeddedPrefixes.concat(customName || propertyName).join('_');
    return customName ? base : camelToSnake(base);
  }
}
