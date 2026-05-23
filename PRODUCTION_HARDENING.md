# Proxifix Production Hardening

## What is implemented

- Global request middleware with `x-request-id` propagation.
- Structured JSON logs for every `/api/*` request with latency, status, actor context, and IP.
- Structured error logs with stack trace, request metadata, and actor context.
- Auth event logs (success/failure) for password and Google login/register/admin-login flows.
- Offer event logs for worker submission/withdraw and client offer status updates.
- Message event logs for stream lifecycle, send, idempotent replay, and unsend.
- Route-level rate limits for auth, message writes, concern creation, and offer submission.
- Message-write idempotency support (`idempotency_key`) with database uniqueness.

## Structured logging format

Every log line is JSON and includes:

- `level`: info | warn | error
- `event`: namespaced event key (`request.complete`, `auth.login`, `messages.send.success`, etc.)
- `requestId`
- `method`
- `path`
- `actorUserId`
- `actorRole`
- event-specific fields

## Alert triggers

Recommended production alerts:

1. High 5xx rate

- Trigger: 5xx > 2% for 5 minutes or 20+ errors in 5 minutes.
- Source: Cloudflare Workers logs and analytics.

2. Auth failure spike

- Trigger: `auth.*` failure events exceed baseline by 3x within 10 minutes.
- Source: log pipeline filter on `event` + `outcome=failure`.

3. Stream disconnect anomaly

- Trigger: `messages.stream.close` events spike unexpectedly against normal open/close ratio.
- Source: logs with event aggregation.

## Monitoring integration

- Baseline: Cloudflare dashboard + `wrangler tail` in incident response.
- Recommended: stream logs to an external sink (Datadog, Grafana Cloud, New Relic, or ELK) for retention, alerting, and dashboards.
- Minimum dashboards:
  - Request volume, p95 latency, 4xx/5xx split
  - Auth success/failure
  - Message send and unsend counts
  - Stream open/close counters

## Security operational practices

- Store secrets only via `wrangler secret put`.
- Never log credentials, tokens, or full auth payloads.
- Rotate critical secrets on schedule and after incidents.
- Keep route-level authorization checks as deny-by-default.

## Realtime reliability guarantees

- Frontend stream reconnect + polling fallback remains active.
- Message writes support idempotency keys to prevent duplicates on retries.
- Message reply target validation enforces same-conversation integrity.

## Database safety additions

- Added `messages.idempotency_key`.
- Added unique index: `(conversation_id, sender_id, idempotency_key)`.
- Added composite index for read path: `(conversation_id, created_at)`.

## Failure-handling policy

- Retries allowed for idempotent operations only.
- For message write retries, client should send `x-idempotency-key`.
- Return explicit failures with `requestId`; avoid silent degradation.

## Rollback strategy

1. Stop rollout and preserve failing `requestId` samples.
2. Re-deploy last known-good Worker version.
3. Re-apply previous runtime secrets if changed.
4. Run smoke checks before reopening traffic.
5. Keep incident notes with impacted endpoints and root cause.
