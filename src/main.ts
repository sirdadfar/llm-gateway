import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { OpenAIExceptionFilter } from './common/filters/openai-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({ origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN?.split(',') });
  app.useBodyParser('json', { limit: process.env.BODY_LIMIT ?? '1mb' });
  app.useGlobalFilters(new OpenAIExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('LLM Gateway')
    .setDescription('OpenAI-compatible gateway for OpenAI, Anthropic and Ollama')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
void bootstrap();