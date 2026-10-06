# Security Policy

## Supported versions

Security fixes are applied to the current default branch and the latest published release.

## Reporting a vulnerability

Please do not open a public GitHub issue for a suspected security vulnerability.

Report privately with:
- a clear description of the issue
- affected endpoint/component
- reproduction steps or a minimal proof of concept
- impact assessment
- any suggested mitigation

Do not include real API keys, provider credentials, customer data or production prompts.

## Security principles

- Client API keys are stored as SHA-256 hashes only.
- Admin authentication uses a separate secret and constant-time comparison.
- Authorization headers are redacted from request logs.
- Prompt logging is disabled by default.
- Model allowlists are enforced per client key.
- Rate limiting fails closed when Redis policy infrastructure is unavailable.
- Cache failures do not expose request contents to logs and fail open.
- The gateway should run behind TLS in production.
