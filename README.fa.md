# LLM Gateway

[English](README.md)

یک Gateway متن‌باز و self-hosted برای مدل‌های زبانی که یک قرارداد واحد و سازگار با OpenAI در اختیار کلاینت‌ها قرار می‌دهد و OpenAI، Claude و Ollama را پشت یک لایه قابل‌کنترل قرار می‌دهد.

## امکانات اصلی

- API سازگار با OpenAI برای chat completions و models
- نمونه کلاینت Node.js و Python با OpenAI SDK
- مسیریابی مدل و alias قابل تنظیم
- timeout، retry و fallback اختیاری
- استریم SSE و لغو درخواست هنگام قطع اتصال کلاینت
- API Key با پیشوند lgw_ و ذخیره فقط SHA-256
- محدودسازی مدل برای هر API Key
- Rate limit اتمیک Redis و سهمیه ماهانه توکن
- Cache پاسخ با کلید SHA-256 پایدار
- ثبت مصرف و آمار در PostgreSQL
- API مدیریت کلیدها و گزارش مصرف
- Swagger در /docs
- health و readiness واقعی برای PostgreSQL، Redis و providerهای فعال
- Helmet، CORS، محدودیت حجم body و validation
- عدم ثبت Prompt و Authorization در لاگ‌ها به‌صورت پیش‌فرض
- Docker Compose، migration، Jest و GitHub Actions

## معماری

```text
Client / OpenAI SDK
        |
        v
NestJS Gateway
  |-- Authentication
  |-- Rate Limit / Quota
  |-- Cache
  |-- Provider Registry
  |      |-- OpenAI
  |      |-- Anthropic
  |      `-- Ollama
  `-- Usage -> PostgreSQL
```

در Controller مستقیماً با SDKهای Provider کار نمی‌شود. درخواست ابتدا به قرارداد داخلی کوچک تبدیل می‌شود و هر Adapter مسئول ترجمه و تبدیل پاسخ است.

## مسیریابی

- gpt-*، o1*، o3* و o4* به OpenAI
- claude-* به Anthropic
- ollama/* به Ollama
- fast به gpt-4o-mini
- smart به claude-sonnet-4-5

متغیر ENABLED_PROVIDERS تعیین می‌کند کدام Provider اجازه سرویس‌دهی دارد. Provider غیرفعال از مسیر اصلی و fallback انتخاب نمی‌شود.

## امنیت

کلیدهای Client به شکل lgw_<random-secret> تولید می‌شوند. مقدار کامل فقط هنگام ساخت برگردانده می‌شود و دیتابیس فقط hash و prefix را نگه می‌دارد.

API ادمین کلید جداگانه ADMIN_API_KEY دارد و مقایسه آن به شکل constant-time انجام می‌شود. کلیدها و Promptهای واقعی را وارد Git نکنید.

برای هر API Key می‌توان allowedModels تعیین کرد. لیست خالی یعنی تمام مدل‌های Providerهای فعال.

## Rate limit و سهمیه

Rate limit با Lua و sliding window اتمیک روی Redis پیاده شده است. Headerهای X-RateLimit-Limit، X-RateLimit-Remaining و X-RateLimit-Reset برگردانده می‌شوند و در 429، Header مربوط به Retry-After نیز وجود دارد.

سهمیه ماهانه بر اساس UTC month در Redis نگهداری می‌شود. مقدار صفر سهمیه را غیرفعال می‌کند. قبل از درخواست، یک برآورد محافظه‌کارانه انجام می‌شود و بعد از دریافت usage واقعی نیز مصرف ثبت می‌شود.

## Cache

Streamها cache نمی‌شوند. درخواست‌های temperature=0 به‌صورت پیش‌فرض قابل cache هستند. X-Cache: enable برای دماهای دیگر cache را فعال می‌کند و Cache-Control: no-cache آن را دور می‌زند.

کلید cache با canonicalize کردن بازگشتی objectها ساخته می‌شود؛ بنابراین ترتیب propertyها باعث ایجاد cache entry تکراری نمی‌شود.

خرابی Cache نباید درخواست معتبر LLM را خراب کند و در این حالت سیستم cache را fail-open می‌کند.

## API

| Method | Endpoint | کاربرد |
|---|---|---|
| POST | /v1/chat/completions | تکمیل مکالمه |
| GET | /v1/models | مدل‌های قابل دسترس برای کلید |
| GET | /v1/usage | مصرف کلید فعلی |
| POST | /admin/api-keys | ساخت کلید |
| GET | /admin/api-keys | لیست کلیدها |
| DELETE | /admin/api-keys/:id | لغو کلید |
| GET | /admin/usage | آمار مصرف |
| GET | /health | liveness |
| GET | /health/ready | readiness |
| GET | /docs | Swagger UI |

## شروع سریع

```bash
cp .env.example .env
docker compose up --build
```

برای فعال‌سازی Ollama:

```bash
docker compose --profile ollama up --build
```

ساخت کلید:

```bash
curl -X POST http://localhost:3000/admin/api-keys \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{"name":"local-client","requestsPerMinute":60,"monthlyTokenQuota":0,"allowedModels":[]}'
```

## توسعه

```bash
npm install
npm run migration:run
npm run start:dev
npm test
npm run lint
npm run format:check
npm run build
```

CI نیز همین مسیر اصلی را با PostgreSQL و Redis اجرا می‌کند و در نهایت Docker image را build می‌کند.

## ساخت Provider جدید

اینترفیس LLMProvider را با متدهای chat، chatStream، listModels و healthCheck پیاده کنید. منطق و typeهای اختصاصی Provider باید داخل Adapter بماند. سپس Provider را در ProvidersModule ثبت و route آن را در ProviderRegistry اضافه کنید.

## نکات Production

PostgreSQL منبع اصلی metadata کلیدها و usage است و Redis زیرساخت موقتی برای rate limit، quota و cache محسوب می‌شود.

در محیط واقعی TLS را پشت reverse proxy یا load balancer معتبر terminate کنید، CORS را محدود کنید، ADMIN_API_KEY پیش‌فرض را عوض کنید، برای PostgreSQL و Redis backup/monitoring داشته باشید و credentialهای Providerها را دوره‌ای rotate کنید.

ثبت usage عمداً non-blocking است تا اختلال telemetry باعث اختلال درخواست LLM نشود. برای نیازهای سخت‌گیرانه می‌توان یک durable queue قبل از writer اضافه کرد.

## مجوز

MIT.