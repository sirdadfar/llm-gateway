import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1700000000000 implements MigrationInterface {
  name = 'Initial1700000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await q.query(
      'CREATE TABLE "api_keys" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "keyHash" varchar(64) NOT NULL, "prefix" varchar(16) NOT NULL, "name" varchar(120), "active" boolean NOT NULL DEFAULT true, "requestsPerMinute" integer NOT NULL DEFAULT 60, "monthlyTokenQuota" bigint NOT NULL DEFAULT 0, "allowedModels" jsonb NOT NULL DEFAULT \'[]\', "createdAt" timestamptz NOT NULL DEFAULT now(), "revokedAt" timestamptz, CONSTRAINT "PK_api_keys" PRIMARY KEY ("id"), CONSTRAINT "UQ_api_keys_hash" UNIQUE ("keyHash"))',
    );

    await q.query(
      'CREATE TABLE "usage_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "apiKeyId" uuid NOT NULL, "provider" varchar(32) NOT NULL, "model" varchar(160) NOT NULL, "promptTokens" integer NOT NULL DEFAULT 0, "completionTokens" integer NOT NULL DEFAULT 0, "totalTokens" integer NOT NULL DEFAULT 0, "latencyMs" integer NOT NULL DEFAULT 0, "status" varchar(24) NOT NULL, "cached" boolean NOT NULL DEFAULT false, "stream" boolean NOT NULL DEFAULT false, "errorCode" varchar(80), "createdAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_usage_logs" PRIMARY KEY ("id"), CONSTRAINT "FK_usage_api_key" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE)',
    );

    await q.query('CREATE INDEX "IDX_api_keys_active" ON "api_keys" ("active")');
    await q.query('CREATE INDEX "IDX_usage_api_key_created" ON "usage_logs" ("apiKeyId", "createdAt")');
    await q.query('CREATE INDEX "IDX_usage_model_created" ON "usage_logs" ("model", "createdAt")');
    await q.query('CREATE INDEX "IDX_usage_created" ON "usage_logs" ("createdAt")');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE "usage_logs"');
    await q.query('DROP TABLE "api_keys"');
  }
}