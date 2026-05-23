# Release Checklist

## Pre-deploy checklist

- Worker type-check passes: `npx tsc -p worker/tsconfig.json`
- Frontend type-check/build passes.
- Schema bootstrap changes reviewed for backward compatibility.
- Rate-limit thresholds reviewed for current traffic.
- Secrets present in target environment.
- `PRODUCTION_HARDENING.md` reviewed for alert routing.

## Deploy

- Deploy Worker to production environment.
- Confirm deployment version and timestamp.

## Post-deploy smoke checklist

- Run: `node scripts/post-deploy-smoke.mjs`
- Validate:
  - health endpoint
  - auth/session flow
  - concern creation and worker discovery
  - offer submit/accept
  - message send/unsend UI path

## Realtime validation

- Run dual-account realtime check script (or equivalent).
- Confirm both sides receive sync events.

## Rollback checklist

- If critical failure occurs:
  1. Revert Worker to last known-good deployment.
  2. Re-run post-deploy smoke.
  3. Verify 5xx and auth failure metrics return to baseline.
  4. Publish incident summary with request IDs and impact window.
