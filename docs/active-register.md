---
title: Active Register Reference Contract
description: "Source mapping and implementation boundaries for the PostgreSQL governance register."
---

## Sources

* User-supplied Enterprise AI Credits Governance implementation guide, September 10, 2026, 44 pages: sections 1-7 and Appendix J are the detailed contract.
* User-supplied Enterprise AI Credits Governance overview, September 2026, 15 slides: lifecycle, ownership, and control distinctions corroborate the guide. The detailed guide also requires P-01a.
* [Requested loop-engineering video](https://www.youtube.com/watch?v=dLiXiD8hOAI): fetch returned HTTP 401. No transcript or video-derived claim is verified. Supply an accessible transcript to resolve this source gap.

## Domain Contract

The nine record types are policy-profile, ULB, entitlement-baseline,
included-usage-control, metered-budget, license-baseline, rollout-wave,
controlled-test, and exception. The canonical key is
`(record_type, scope_id, enterprise_control_id)`, extended by profile and version
only for named patterns. Provider IDs and owners are attributes, not keys.

Phases are Prepare, Baseline, Design, Approve, Pilot, Rollout, Operate.
Monitor & Respond and Review Decision support every phase. Owner is required
from Prepare; evidence from Baseline; approval, delegates, support, effective
period, and rollback from Approve for production-intended records; timestamped
tests from Pilot. Preserve prior revisions and approval evidence.

ULBs are integer AI Credits with individual > cost-center > universal precedence.
ULB reset cadence requires tenant evidence. The monthly shared pool reset rule
must not be applied to ULBs automatically. Included-usage controls have no
`stop_usage_state`; only their separate downstream metered budgets have that field.
Metered budgets use numeric USD amounts and enumerated SKUs. License and entitlement
baselines are informational, never enforcement controls. Thresholds are observed,
provider-supported values, not hard-coded defaults. Unknowns remain unknown.

## Evidence Boundaries

The register records provider facts and human decisions; it does not apply GitHub
budgets, certify enforcement, approve its own changes, or infer complete enterprise
coverage from team assignments. Data retrieval, software tests, provider pilot tests,
and production approvals are separate evidence categories.

The fixed ledger includes application requirements and external operational gates.
Partial, blocked, untested, and tenant-dependent requirements score zero. A ten-iteration
cap is a valid stopping condition even below 90 percent; it is not a readiness certificate.

## Local Setup

Requires Node 22, Docker, and Docker Compose. From the repository root:

```sh
npm ci --ignore-scripts
npm run register:db:up
REGISTER_INTEGRATION=1 npm run register:test
npm run dev
```

The official PostgreSQL 17 image stores data in the named
`ghcp-active-register_register_data` volume. PostgreSQL has no host port.
PostgREST listens only at `127.0.0.1:3302` and requires short-lived server-signed
credentials. Generated secrets live in the ignored, permission-restricted
`.local/register.env` file. Do not expose the gateway through Codespaces forwarding.

The server verifies `/user` using the existing encrypted OAuth token on every
register request. An operator must configure a numeric-ID role map. Set
`REGISTER_ACCESS_JSON` in the server environment, or use the ignored
`.local/register-access.json` file for local development:

```json
{
 "123456": { "tenant": "enterprise:immutable-id", "role": "editor" },
 "789012": { "tenant": "enterprise:immutable-id", "role": "approver" }
}
```

Replace the example IDs with independently verified identities. This is explicit
application RBAC, not automatic proof of GitHub enterprise-owner permissions.
Each account maps to one tenant; unmapped users are denied. Readers can inspect
and export. Editors can maintain drafts. Approvers can record approval decisions
and update approved production records. No role is automatically granted during setup.
The local access file uses the same JSON shape shown above and is read on each
register request. An explicit `REGISTER_ACCESS_JSON` value takes precedence,
including an empty value or `{}`. Production never reads the local access file.
Creating a mapping does not create or import records; a new tenant starts empty.
The server does not automatically load the repository `.env` file; export these
values in its process environment. Storage-only local secrets load from `.local/`.

Production must inject `REGISTER_JWT_SECRET`, `REGISTER_GATEWAY_URL`, and
`REGISTER_ACCESS_JSON` through a secret/configuration manager. The local Compose
stack is not a production HA deployment. Runtime database credentials cannot directly
insert, update, or delete tables; saves use the audited function. Database owners
remain privileged, so this is not protection against a malicious database administrator.

## Application Persistence

The same PostgreSQL volume also stores application data in account-scoped tables:

| Table | Persistent data |
| --- | --- |
| `register.application_sessions` | AES-256-GCM encrypted login sessions, including OAuth and refresh tokens, with expiry |
| `register.assessment_jobs` | Assessment inputs without billing tokens, status, results, warnings, and capture timestamps |
| `register.workflows` | Simulator inputs and results, up to four scenarios, review progress, recommendations, visualization preference, assessment reference, and cost-center allocation plans |
| `register.generated_reports` | PDF bytes, filename, creation time, and the generating input snapshot with assessment reference |

Application ownership uses the numeric GitHub ID verified during OAuth sign-in.
It is separate from register tenant roles; a register reader does not gain edit
rights by saving a personal workflow. PostgreSQL row-level policies isolate
accounts. Workflow revisions reject concurrent edits and stale-account saves.
Browser caches are no longer the source of saved workflow or allocation data.
Recent assessments can be restored in Assessment, and recent PDFs can be
downloaded again in the Executive report view. History lists show the newest
100 entries; older records remain stored and available by their existing IDs.

Start or migrate PostgreSQL before starting Express. Run `npm run persistence:test`
for session, storage, API, and assessment regression checks. Database outages
fail requests explicitly; there is no in-memory storage fallback. Interrupted
assessment leases expire after two minutes without a heartbeat and are reported
as failed when queried. Rerun these assessments with the required credentials.

Use a stable `SESSION_SECRET` or `GHCP_SESSION_SECRET` of at least 32 characters.
Production requires an explicit secret. Development generates a restricted,
ignored `.local/session-secret` when neither variable is set. Keep that secret
and the gateway secrets securely backed up separately from the database. Losing
or rotating the session secret invalidates existing encrypted sessions but does
not delete saved account data. Sessions expire after eight hours of inactivity;
expired rows are pruned hourly. Disconnect destroys the stored session, while
saved assessments, workflows, reports, and register history remain.

One-time assessment billing tokens are never persisted. Environment credentials
and the local register role map remain configuration, not database records.
Existing in-memory jobs and PDFs cannot be recovered after their old process
exits. Old unscoped browser caches are not automatically imported into a signed-in
account; run a new assessment and resave prior allocation plans as needed.

The existing backup command includes all six register and application tables.
`npm run register:db:verify-recovery` compares all six tables after container
recreation and an isolated backup restore. Run it without concurrent writes.
Backups contain sensitive assessment data and encrypted credentials; protect
them and establish an operator-managed retention and off-host backup policy.
There is no automatic deletion of assessment or report history.

## Evidence Entry

Evidence and tests are structured JSON arrays in the record editor. For example,
the field shapes below are templates, not actual evidence or test results:

```json
{
 "evidence": [{
  "evidence_link": "evidence-system:replace-with-real-id",
  "source_url": "https://github.com/enterprises/replace-with-tenant",
  "retrieval_timestamp": "2026-09-10T00:00:00Z",
  "observation": "unknown",
  "limitations": "Replace this template with retrieved evidence."
 }],
 "tests": [{ "test_id": "P-01a", "test_result": "not-run" }]
}
```

Observation classes are observed, calculated, forecast, and unknown. Enabled metered
Stop usage additionally requires observed evidence with a future `valid_until` and
a timestamped, bounded passing P-04 record. No universal freshness interval or
alert-threshold schedule is invented. Record provider-supported SKU IDs and threshold
evidence; automatic provider catalog reconciliation is not implemented.

Material changes after approval require a new record and approval; named policy
versions cannot be renamed in place. JSON exports include all current records and
revisions from a consistent database snapshot. CSV exports contain historical revisions,
semicolon-delimited SKU values, and spreadsheet formula protection. Blank numeric
values mean unknown, not zero. Neither format is a signed phase-exit approval.
The inventory view is capped at 1,000 records and displays an incompleteness warning;
full exports are not capped. Local tests use separate `test:` tenant IDs and never
populate an operator's tenant or certify provider enforcement.

## Backup And Recovery

```sh
npm run register:db:backup
npm run register:db:verify-recovery
node scripts/register-db.mjs stop
npm run register:db:up
```

Backups are PostgreSQL custom-format dumps under `.local/backups/`, with file mode
0600. They contain register data and audit history, not OAuth tokens. Keep encrypted
off-host copies and a retention policy; a local volume and a local dump are not disaster
recovery. Recovery verification briefly recreates the database container with its existing
volume, compares record/history fingerprints, restores into a randomly named separate
database, and drops only that temporary database. Run it in a maintenance window without
concurrent writes. It never restores over the active database or removes its volume.

For disaster recovery, provision PostgreSQL with the required roles, restore the dump
into a new empty database with `pg_restore --exit-on-error --no-owner`, validate records
and audit history, then explicitly switch the gateway database URI. Do not run
`docker compose down -v`. Preserve original backups until restoration is accepted.
