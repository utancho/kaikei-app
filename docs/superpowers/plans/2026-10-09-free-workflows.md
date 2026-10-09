# Free Accounting Workflows Implementation Plan

> **For agentic workers:** Use parallel independent domains, test-first implementation and a fresh final review. No staged confirmation per user's execute-all instruction.

**Goal:** Ship useful accounting workflows with explicit quota and security boundaries, without enabling paid services.
**Architecture:** Additional D1 tables/triggers, Hono API modules and a white/green operations page. Existing business/session gates remain intact.
**Tech Stack:** Hono, D1/SQLite, React/TypeScript, native Web Crypto.
**Spec:** docs/superpowers/specs/2026-10-09-free-workflows-design.md

## Global Constraints
- Preserve dirty working tree and production data; no new authentication/payment/provider accounts.
- Original evidence: 256KiB/file,5MiB/business,50MiB/global. No lossy compression.
- Email maximum90/day globally, recurring generation max20/run, draft-only, no automatic send.
- Restore only isolated local databases. No production restore operation.

## Review Focus
- Foreign entity IDs: every reference and attachment must use authorized business.
- VIEWER comments must not grant accounting writes or lock control.
- Closed months: alternate bank/invoice/asset writes must also be blocked.
- Offline providers: never claim verification/sending succeeded.
- Retries: recurring jobs and concurrent quota claims cannot duplicate or overrun budgets.

### Task 1: Identity and notifications
Files: routes/accountSecurity.ts, services/accountSecurityService.ts, migration0019, accountSecurity tests; auth middleware session capture; auth getMe verified flag.
Produces API /api/account-security/status, /verify-email/request, /verify-email/confirm, /sessions, DELETE /sessions/:id, POST /logout-all, GET /notifications, POST /notifications/:id/read.
- [ ] Fail tests for token single-use and disabled mail.
- [ ] Implement hashes/expiry, same-user verification, bounded mail, session metadata, DB notification.
- [ ] Test and report exact API shapes for frontend.

### Task 2: Accounting integrity/workflows
Files: migration0018, services/workflowService.ts, routes/workflows.ts, triggers; workflow tests.
Produces /api/workflows?businessId=id: GET /overview,/history,/reviews,/evidence,/backup; POST /lock,/reviews,/evidence,/recurring,/recurring/run,/sample; PATCH /reviews/:id; GET /suggestions,/duplicates,/recurring; DELETE /evidence/:id,/recurring/:id.
- [ ] Add failing SQLite/API tests for locks, history and scoped operations.
- [ ] Implement additive tables/triggers and endpoint validation/quota.
- [ ] Test real D1 owner/viewer/unrelated ACL and normal controls.

### Task 3: User interface
Files: lib/workflowApi.ts, pages/Operations.tsx, pages/AccountSecurity.tsx, components onboarding/reminders, App/Layout/Dashboard route wiring.
- [ ] Build explicit loading/error/provider status and quota UI, no disconnected buttons.
- [ ] Connect backend contracts; preserve white/green/mobile layout.
- [ ] Browser tests real owner and viewer paths.

### Task 4: Dependency and recovery
Files: safe dependency overrides, scripts/backup/restore verifier and docs.
- [ ] Investigate residual audit and fix without Prisma downgrade if compatible.
- [ ] Verify backup restores to isolated DB with digest/row counts; never production.
- [ ] Run full build/test and final review; deploy only verified migrations/modules to existing site.

## Execution record
2026-10-09: Tasks1-4 implemented within declared free-mode limits. Build client/server PASS;20 node tests PASS;three local API regression scripts PASS;40-table isolated restore PASS;production audit0/full audit7(dev only);owner/VIEWER390px browser PASS;0018-0023 remote migration PASS;current deployc77b3d07-a20c-4974-bace-3fa03ba814f0 and public rejection/redirect checks PASS.
Provider completion excluded: Resend settings absent, no actual emails; external AI disabled; no external penetration certification. Recurring generation is deliberate manual draft creation, not unattended sending. Existing pricing/account plan unchanged.
Review fixes: downstream cascade history, UTF8 quota accounting, pre-write actor/reservation, atomic subsequent-month invoice payment, immutable paid records, session-version-aware active device listing, Cloudflare trigger CASE parser compatibility.
Full acceptance and remaining risks: docs/keirio-free-workflows-20261009.md.
