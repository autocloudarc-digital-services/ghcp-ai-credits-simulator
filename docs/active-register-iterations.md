---
title: Active Register Kaizen Run
description: "Evidence ledger for the bounded reference-alignment loop."
---

## Baseline

Run date: 2026-09-10. Fixed denominator: 30 requirements.
Stop at ten completed iterations or 90 percent verified with passing safety gates.
No production GitHub controls or tenant approvals are authorized by this run.
Video access is blocked (HTTP 401); PDF page and slide references are available in context.

## Iteration 1 - Loop Contract

Hypothesis: discoverable artifacts and a fixed ledger prevent false coverage claims.
Change: scoped instructions, a reusable skill, a bounded agent and invocation prompt.
Check: parse the requirement ledger and assert unique IDs and the 10/90 bounds.
Result: JSON contract passed (30 unique IDs, 10/90 limits). YAML parser installation
was blocked, including script-disabled installation; no further install attempts.
After the user enabled Allow all, the script-disabled YAML parser install succeeded.
All four customization frontmatters and the fixed ledger passed validation.

## Iteration 2 - PostgreSQL Foundation

Hypothesis: a named volume and repeatable SQL migration preserve register data across restarts.
Change: PostgreSQL 17 and PostgREST containers, private network, local gateway,
generated ignored secrets, canonical tables, tenant read policies.
Check: `npm run register:db:up`, then repeat `npm run register:db:migrate`.
Result: PostgreSQL and gateway running; migration passed twice. Named volume created.
Runtime restart and backup/restore checks remain scheduled for iteration 9.

## Iteration 3 - Typed Domain Rules

Hypothesis: strict discriminated schemas reject cross-layer fields and fabricated test passes.
Change: nine type schemas, seven phases, ownership/evidence gates, unknown preservation,
numeric units, thresholds, exception expiry, configured/effective closure checks.
Check: `npm run register:test`.
Result: server compiled; ten focused tests passed. Provider behavior is not certified.

## Iteration 4 - Atomic Persistence

Hypothesis: one privileged save function preserves revisions atomically without direct runtime table writes.
Change: JWT-scoped gateway client, immutable keys, concurrency checks, tenant policies,
append-only runtime history, database integration checks.
Check: migrations and `REGISTER_INTEGRATION=1 npm run register:test`.
Result: eleven tests passed, including live optimistic locking, duplicate identity,
tenant isolation, and denied runtime history deletion. Internal-only networking initially
prevented loopback publishing; a gateway-only bridge corrected it. Database remains isolated.

## Iteration 5 - Authorized API

Hypothesis: verified GitHub numeric identity plus operator-configured tenant roles can authorize register operations without trusting browser claims.
Change: deny-by-default role map, source identity verification, API validation, CSRF reuse,
sanitized storage errors, approver-only approval changes.
Check: server build and both Node test files with `REGISTER_INTEGRATION=1`.
Result: fourteen tests passed, including anonymous, reader, spoofing, CSRF and conflict cases.
Real operator access has not been granted or inferred from the CLI account.

## Iteration 6 - Reports Integration

Hypothesis: a third Reports tab can expose register editing and history without changing existing report or simulator workflows.
Change: existing-style filtered inventory, type-specific editor, structured evidence,
validation errors, read-only role, loading/error states and revision history.
Check: client build; desktop/mobile rendering scheduled in the final iteration.
Result: client build passed after replacing unsupported `replaceAll` with an ES2020-compatible formatter.
Existing bundle-size warning remains; no unrelated bundling changes made.

## Iteration 7 - Snapshot Exports

Hypothesis: a single database statement gives consistent timestamped tenant exports with historical evidence.
Change: JSON/CSV exports, canonical name/version defaults, semicolon SKU values,
spreadsheet protection, and download controls.
Check: export/API tests and client build.
Result: all four API/export tests and client build passed after fixing a SQL alias collision.
Exports are not signed or approved phase-exit snapshots (R24 remains unverified).

## Iteration 8 - Lifecycle Review

Hypothesis: phase/status checks and immutable approved attributes prevent stale approvals from being reused for materially different controls.
Change: active-state gating, current evidence requirement for Stop usage, ISO currency
validation, recorded decision timing and immutable evidence reference checks.
Check: focused domain and API test suites.
Result: pending.
