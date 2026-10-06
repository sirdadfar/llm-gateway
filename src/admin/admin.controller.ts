import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { ApiKeyService } from '../auth/api-key.service';
import { UsageService } from '../usage/usage.service';
import { CreateApiKeyDto } from './admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly keys: ApiKeyService,
    private readonly usage: UsageService,
  ) {}

  @Post('api-keys')
  @ApiOperation({ summary: 'Create a client API key' })
  async create(@Body() body: CreateApiKeyDto) {
    const result = await this.keys.create({
      name: body.name ?? null,
      requestsPerMinute: body.requestsPerMinute,
      monthlyTokenQuota: String(body.monthlyTokenQuota),
      allowedModels: body.allowedModels ?? [],
    });

    return {
      key: result.key,
      id: result.entity.id,
      prefix: result.entity.prefix,
      name: result.entity.name,
      createdAt: result.entity.createdAt,
    };
  }

  @Get('api-keys')
  list() {
    return this.keys.list();
  }

  @Delete('api-keys/:id')
  async revoke(@Param('id') id: string) {
    await this.keys.revoke(id);
    return { ok: true };
  }

  @Get('usage')
  stats(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('apiKeyId') apiKeyId?: string,
    @Query('groupBy') groupBy?: string,
  ) {
    const allowed = new Set(['day', 'model', 'provider']);
    const bucket = groupBy && allowed.has(groupBy) ? groupBy : 'day';

    return this.usage.stats(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      apiKeyId,
      bucket,
    );
  }
}