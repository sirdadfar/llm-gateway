# LLM Gateway

[English](README.md)

یک Gateway متن‌باز و self-hosted برای مدل‌های زبانی که یک API سازگار با OpenAI در اختیار کلاینت قرار می‌دهد و OpenAI، Claude و Ollama را پشت یک قرارداد واحد قرار می‌دهد.

## شروع سریع

1. `cp .env.example .env`
2. حداقل یک کلید Provider در فایل `.env` قرار دهید.
3. `docker compose up --build`

برای ساخت کلید:

```bash
curl -X POST http://localhost:3000/admin/api-keys -H "Authorization: Bearer change-me" -H "Content-Type: application/json" -d '{"name":"local-client","requestsPerMinute":60,"allowedModels":[]}'
```

کلید تولیدشده فقط هنگام ساخت به‌صورت کامل نمایش داده می‌شود و در دیتابیس فقط SHA-256 آن ذخیره می‌شود.

## قابلیت‌ها

- `/v1/chat/completions` سازگار با OpenAI
- استریم SSE با فرمت OpenAI
- مسیریابی مدل به OpenAI، Anthropic و Ollama
- احراز هویت Bearer API Key
- Rate limit و Cache مبتنی بر Redis
- ثبت مصرف در PostgreSQL
- مدیریت کلید و آمار از API ادمین
- Swagger در `/docs`
- Health و Readiness
- Docker Compose و CI
- عدم ثبت Prompt و API Key در لاگ‌ها به‌صورت پیش‌فرض

## مسیریابی مدل

`gpt-*` و مدل‌های سری `o*` به OpenAI، مدل‌های `claude-*` به Anthropic و `ollama/<name>` به Ollama ارسال می‌شوند. Aliasهای ساده `fast` و `smart` نیز در Registry قرار داده شده‌اند.

## ساختار

```text
src/
  auth/          API key guards and persistence
  cache/         Redis response cache
  chat/          OpenAI-compatible chat API
  providers/     provider abstraction and adapters
  rate-limit/    Redis limiter
  usage/         usage persistence and stats
  admin/         key and usage administration
  health/        liveness/readiness
  models/        model discovery
  database/      TypeORM data source and migrations
```

## توسعه

```bash
npm ci
npm run migration:run
npm run start:dev
npm test
npm run lint
npm run build
```

برای جزئیات کامل متغیرهای محیطی، معماری، curlها و تصمیمات طراحی به [README انگلیسی](README.md) مراجعه کنید.