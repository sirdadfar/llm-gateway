import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenUsageSchema1700000001000 implements MigrationInterface {
  name = 'HardenUsageSchema1700000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_api_keys_active" ON "api_keys" ("active")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_usage_api_key_created" ON "usage_logs" ("apiKeyId", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_usage_model_created" ON "usage_logs" ("model", "createdAt")',
    );

    await queryRunner.query(
      'ALTER TABLE "usage_logs" ADD CONSTRAINT "FK_usage_api_key" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "usage_logs" DROP CONSTRAINT IF EXISTS "FK_usage_api_key"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_usage_model_created"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_usage_api_key_created"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_api_keys_active"',
    );
  }
}