import { Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';
import { QuotaGuard } from './quota.guard';

@Module({
  providers: [RateLimitService, RateLimitGuard, QuotaGuard],
  exports: [RateLimitService, RateLimitGuard, QuotaGuard],
})
export class RateLimitModule {}