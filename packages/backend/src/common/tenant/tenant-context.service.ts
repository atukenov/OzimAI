import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { EntityManager, ObjectLiteral, EntityTarget } from 'typeorm';
import { UserRole } from '@ozimai/shared';

export interface TenantStore {
  orgId: string;
  userId: string;
  role: UserRole;
  manager: EntityManager;
}

const als = new AsyncLocalStorage<TenantStore>();

/**
 * Request-scoped tenant context backed by AsyncLocalStorage.
 *
 * `TenantScopeInterceptor` opens one Postgres transaction per authenticated
 * request, runs `SET LOCAL app.current_org_id`, and enters this context with
 * the transaction's EntityManager. Every feature service reads the manager
 * through here instead of injecting `@InjectRepository()` directly, so it is
 * structurally impossible to run a tenant query outside the RLS-scoped
 * transaction.
 */
@Injectable()
export class TenantContextService {
  run<T>(store: TenantStore, fn: () => T): T {
    return als.run(store, fn);
  }

  private store(): TenantStore {
    const store = als.getStore();
    if (!store) {
      throw new Error(
        'TenantContextService used outside of a tenant-scoped request. ' +
          'Did you forget @Public() or the TenantScopeInterceptor?',
      );
    }
    return store;
  }

  get orgId(): string {
    return this.store().orgId;
  }

  get userId(): string {
    return this.store().userId;
  }

  get role(): UserRole {
    return this.store().role;
  }

  get manager(): EntityManager {
    return this.store().manager;
  }

  repo<Entity extends ObjectLiteral>(target: EntityTarget<Entity>) {
    return this.manager.getRepository(target);
  }
}
