import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from './config/config';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import { ChatModule } from './chat/chat.module';
import { ModelsModule } from './models/models.module';
import { ProvidersModule } from './providers/providers.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { UsageModule } from './usage/usage.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './admin/admin.module';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config], cache: true }),
    LoggerModule.forRoot({ pinoHttp: { genReqId: (req) => req.headers['x-request-id']?.toString() ?? randomUUID(), redact: ['req.headers.authorization'] } }),
    TypeOrmModule.forRoot({ type: 'postgres', url: process.env.DATABASE_URL, autoLoadEntities: true, synchronize: false, migrationsRun: process.env.DB_RUN_MIGRATIONS === 'true', migrations: ['dist/database/migrations/*.js'] }),
    AuthModule, CacheModule, ProvidersModule, ChatModule, ModelsModule, RateLimitModule, UsageModule, HealthModule, AdminModule,
  ],
})
export class AppModule {}