import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { entities } from './database/data-source';
import { SnakeNamingStrategy } from './database/snake-naming.strategy';
import { TenantModule } from './common/tenant/tenant.module';
import { TenantScopeInterceptor } from './common/tenant/tenant-scope.interceptor';
import { RedisModule } from './common/redis/redis.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { CrmModule } from './modules/crm/crm.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { AiModule } from './modules/ai/ai.module';
import { DialoguesModule } from './modules/dialogues/dialogues.module';
import { ChannelAdapterModule } from './modules/channels/channel-adapter.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { BillingModule } from './modules/billing/billing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HealthController } from './health.controller';

// Single-service deployment (Railway): the backend also serves the built
// frontend SPA. Same relative depth from src/ (ts-node dev) and dist/
// (compiled prod), so this path works in both. When the frontend hasn't
// been built (typical local dev — Vite serves it on :5173 instead), the
// module is simply omitted.
const FRONTEND_DIST = join(__dirname, '../../frontend/dist');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...(existsSync(FRONTEND_DIST)
      ? [
          ServeStaticModule.forRoot({
            rootPath: FRONTEND_DIST,
            // API, webhooks, health, and the WS handshake must never fall
            // through to the SPA's index.html.
            exclude: ['/api/(.*)', '/webhooks/(.*)', '/health', '/socket.io/(.*)'],
          }),
        ]
      : []),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        // Deliberately APP_DATABASE_URL, not DATABASE_URL — see the comment
        // on the 'ozimai_app' role in the InitSchema migration. Connecting
        // the running app as the superuser would silently bypass every RLS
        // policy in the database.
        url: config.get<string>('APP_DATABASE_URL'),
        entities,
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        logging: false,
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-only-change-me',
        signOptions: { expiresIn: '7d' },
      }),
    }),
    ScheduleModule.forRoot(),
    TenantModule,
    RedisModule,
    AuditModule,
    ChannelAdapterModule,
    AuthModule,
    OrganizationsModule,
    CrmModule,
    KnowledgeModule,
    SchedulingModule,
    DialoguesModule,
    AiModule,
    ChannelsModule,
    BillingModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantScopeInterceptor },
  ],
})
export class AppModule {}
