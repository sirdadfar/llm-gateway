import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiKey } from '../auth/api-key.entity';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { ProviderRegistry } from '../providers/provider.registry';

type AuthenticatedRequest = Request & { apiKey: ApiKey };

@ApiTags('models')
@ApiBearerAuth()
@Controller('v1/models')
@UseGuards(ApiKeyGuard)
export class ModelsController {
  constructor(private readonly registry: ProviderRegistry) {}

  @Get()
  @ApiOperation({ summary: 'List models available to the current API key' })
  async list(@Req() request: AuthenticatedRequest) {
    const allowed = new Set(request.apiKey.allowedModels);
    const providers = await Promise.all(
      this.registry.all().map(async (provider) => ({
        provider: provider.name,
        models: await provider.listModels(),
      })),
    );

    const data = providers
      .flatMap(({ provider, models }) =>
        models.map((id) => ({ id, object: 'model' as const, created: 0, owned_by: provider })),
      )
      .filter((model) => allowed.size === 0 || allowed.has(model.id));

    return { object: 'list', data };
  }
}