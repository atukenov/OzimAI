import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { TenantContextService } from './tenant-context.service';

/**
 * Opens exactly one Postgres transaction per authenticated request, sets
 * `app.current_org_id` for the lifetime of that transaction (so every RLS
 * policy in the database applies), and enters the AsyncLocalStorage-backed
 * TenantContextService before the route handler runs. Commits on success,
 * rolls back on any thrown error. Public routes (auth, webhooks, health)
 * skip this entirely and use the unscoped DataSource directly.
 */
@Injectable()
export class TenantScopeInterceptor implements NestInterceptor {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    return new Observable((subscriber) => {
      void this.runScoped(user, next, subscriber);
    });
  }

  private async runScoped(
    user: JwtPayload,
    next: CallHandler,
    subscriber: { next: (v: unknown) => void; error: (e: unknown) => void; complete: () => void },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query('SELECT set_config($1, $2, true)', [
        'app.current_org_id',
        user.orgId,
      ]);

      await new Promise<void>((resolve, reject) => {
        this.tenantContext.run(
          { orgId: user.orgId, userId: user.sub, role: user.role, manager: queryRunner.manager },
          () => {
            next.handle().subscribe({
              next: (value) => subscriber.next(value),
              error: (err) => reject(err),
              complete: () => resolve(),
            });
          },
        );
      });

      await queryRunner.commitTransaction();
      subscriber.complete();
    } catch (err) {
      await queryRunner.rollbackTransaction().catch(() => undefined);
      subscriber.error(err);
    } finally {
      await queryRunner.release();
    }
  }
}
