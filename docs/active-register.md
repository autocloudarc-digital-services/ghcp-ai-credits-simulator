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

The [official GitHub control mapping](governance-budget-controls.md) distinguishes
all six budget controls without numbered tiers. GitHub documents billing-cycle
ULBs as always-hard-stop controls configured in USD; this register retains integer
AI credits as its normalized unit and requires tenant reset evidence. Convert
units explicitly rather than interpreting credit amounts as dollars. Cost center
ULBs and cost center metered budgets are different record types; organization
policy profiles are not organization metered budgets. No source documentation
review changes a saved record's approval or verified enforcement state.

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
| `register.workflows` | Versioned simulator inputs and results, up to four scenarios, review progress, recommendations, visualization preference, assessment reference, allocation plans, and Governance Insights view/filter preferences |
| `register.workflow_revisions` | Append-only, account-owned workflow snapshots with revision, schema version, database recording time, and origin |
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

The existing backup command includes all seven register and application tables.
`npm run register:db:verify-recovery` compares all seven tables after container
recreation and an isolated backup restore. Run it without concurrent writes.
Backups contain sensitive assessment data and encrypted credentials; protect
them and establish an operator-managed retention and off-host backup policy.
There is no automatic deletion of assessment or report history.

## Persistent Structured Storage Requirement

[Issue #11: create-persistent-structured-storage](https://github.com/autocloudarc-digital-services/ghcp-ai-credits-simulator/issues/11)
is implemented by the existing PostgreSQL backends for both local and Azure-hosted
use; no additional storage backend is required. Both use the same ordered
[SQL migrations](../server/src/register/migrations) and PostgREST access layer.
The seven structured tables are `register.records`, `register.revisions`, and
the five application tables listed above. They retain governed records, audit
history, encrypted sessions, assessments, workflows, and generated reports,
with account/tenant isolation rather than browser or process memory as durable storage.

| Scenario | Persistence implementation | Operational boundary |
| --- | --- | --- |
| Local / Codespaces | [Compose](../compose.register.yaml) runs PostgreSQL 17 with the named `register_data` volume; [database commands](../scripts/register-db.mjs) apply migrations and verify container recreation and isolated dump restoration. | Retain the volume and encryption secrets. Local dumps still need protected off-host copies; this is not HA or disaster recovery. |
| Azure hosted | [Database Bicep](../infra/modules/database.bicep) provisions private PostgreSQL 17 Flexible Server with 32 GiB auto-growing storage and seven-day backup retention. The [application sidecar](../infra/modules/application.bicep) connects PostgREST to that database; durable data is outside the application containers. | HA and geo-redundant backup are disabled. Use the [protected deployment workflow](azure-deployment.md#supported-production-path), which requires successful migrations before application deployment. Local data is not automatically copied to Azure. |

### Verification Evidence — 2026-09-17

* Local `npm run register:db:up` and `npm run register:db:migrate` succeeded,
  including reapplying all six migrations. PostgREST reported all seven tables
  loaded. `npm run register:db:verify-recovery` passed container recreation and
  isolated backup restoration on a fresh database; this is not populated-data
  recovery evidence.
* The server build passed. `node --test scripts/azure-deploy-test.mjs` passed
  all 12 configuration tests. Running `node --test scripts/persistence-test.mjs
  scripts/register-test.mjs scripts/register-api-test.mjs` without integration
  enabled passed 28 tests and skipped seven database integration tests.
* `npm run persistence:test` was attempted but did **not** pass: requests to
  `127.0.0.1:3302` timed out in this sandbox, including a direct HTTP probe.
  Assessment tests also failed on storage access without the integration flag.
  Local end-to-end verification remains incomplete. The sandbox used Node 24;
  rerun with the documented Node 22 toolchain and a reachable local gateway,
  including `REGISTER_INTEGRATION=1 npm run register:test`, then repeat recovery
  verification with populated data and no concurrent writes.
* Azure [production deployment run 35257851912](https://github.com/autocloudarc-digital-services/ghcp-ai-credits-simulator/actions/runs/35257851912)
  succeeded for commit `87cdb358c38d55f320c30075289b2b71feecdc27`. Its job results
  confirm successful database migrations, internal application admission, and
  readiness/traffic verification. This is deployment evidence, not a new
  authenticated save/reload, application-restart durability, or point-in-time
  restore test against Azure. Those operational acceptance checks remain separate.

## Unstructured Storage Assessment

Assessment for [issue #12](https://github.com/autocloudarc-digital-services/ghcp-ai-credits-simulator/issues/12),
September 17, 2026.

**Classification:** optional feature enhancement, not a persistence bug.
**Recommendation:** retain PostgreSQL for the current workload; defer a dedicated
object store until an approved attachment use case or measured report-storage
growth justifies the additional service. This assessment does not provision storage
or implement uploads, and the proposal below is not an approved deployment change.

### Current Coverage And Value

Unstructured content means file bytes such as PDFs, screenshots, or supporting
documents, rather than the validated record and workflow fields stored as JSON.
The application already persists one such artifact: generated PDFs. The
[report store](../server/src/persistence/applicationStore.ts) saves them as
base64 text in `register.generated_reports`, alongside their owner and input
snapshot. The [report API](../server/src/routes/report.ts) supports generation,
history, and account-scoped re-download. PostgreSQL backups include these bytes.

Register evidence currently records links and provenance in structured JSON
(see [Evidence Entry](#evidence-entry)); it does not upload or retain the linked
file. There is no general-purpose attachment API or object-storage resource in
the current Azure topology.

| Option | Benefit | Trade-off and decision |
| --- | --- | --- |
| Keep existing PostgreSQL storage and evidence links | Preserves working report downloads, ownership, and one recovery boundary without another service | Links do not preserve external files; base64 adds roughly one-third to raw PDF size before database overhead. Recommended now; measure database and backup growth rather than assume a capacity problem. |
| Add private object storage with PostgreSQL metadata | Could retain approved evidence attachments and offload larger report bytes | Adds authorization, upload security, retention, cost, and cross-store recovery work. Preferred future design if justified. |
| Store files on the application container filesystem | Simple temporary staging | Not a durable production store across replacement or scaling; reject for retained artifacts. |

Useful future cases are retaining authorized, sanitized evidence screenshots or
documents with a register revision, and moving report bytes out of PostgreSQL
when measured volume or restore time warrants it. A general file drive, arbitrary
URL importer, public sharing, and replacement of structured governance records
are outside this proposal. Storing a file does not validate its contents or certify
provider enforcement.

### Bounded Future Proposal

1. Keep ownership, provenance, history, and artifact metadata in PostgreSQL.
   Reference immutable object versions using server-generated keys; record size,
   validated media type, checksum, creation time, and scan state. Personal reports
   remain account-owned; register attachments require the server-configured tenant
   and register role. Neither boundary grants access to the other.
2. Use private Azure Blob Storage for production bytes, with public access disabled,
   private networking, encryption, and least-privilege application managed identity.
   Authorize every upload, link, and download through the application; knowledge of
   an object key is not permission. Do not embed credentials or reusable access
   tokens in evidence links. Local development needs an explicitly persistent
   local object-store volume, not the application container's writable layer.
3. Start with a narrow, approved file-type allowlist, content validation, per-file
   size and tenant/account quotas, CSRF protection, and rate limits. Quarantine
   uploads until malware scanning succeeds; failed or unavailable scanning must
   not release files. Serve downloads as attachments without inline active content.
   Exclude credentials and require review/redaction of sensitive evidence.
4. Define retention, deletion authority, and any legal holds before enabling
   cleanup. Preserve artifacts referenced by historical evidence; never overwrite
   prior versions to satisfy validation. Audit attachment changes and access
   without logging contents or access tokens.
5. Account for the lack of a shared PostgreSQL/blob transaction: stage uploads,
   finalize references only after integrity and scan checks, make retries
   idempotent, and reconcile orphaned objects and missing references safely.
   Back up and restore metadata and matching object versions together. A database
   dump alone would no longer recover all artifacts.

Before implementation, confirm allowed data, expected sizes/counts, retention,
recovery objectives, and an operating owner. Review total costs, including
capacity, operations, network transfer, private endpoints, scanning, and recovery;
do not assume they fit the existing approved Azure ceiling. Any infrastructure
addition must use the [protected production workflow](azure-deployment.md#supported-production-path)
after cost and security approval.

Acceptance for a separate implementation should include additive schema changes,
cross-account and cross-tenant denial tests, upload-limit and quarantine tests,
retry/failure reconciliation, and backup/restore tests covering both stores.
Preserve existing report IDs and downloads during any migration; verify copied
bytes before retiring database copies. Validate retention and historical references,
container-replacement durability locally, and Azure recovery separately. No such
object-storage acceptance tests or operational readiness are claimed by this assessment.

## Governance Insights Persistence

Migration `006-governance-insights.sql` adds workflow audit history and version
metadata without deleting or replacing Active Register records or revisions.
Assessment jobs, generated reports, register records, and register revisions now
have a positive `schema_version`, initially `1`. This identifies the stored
payload contract, not evidence completeness or provider API certification.

Workflow JSON uses `schemaVersion: 1`. The API supplies defaults for older
documents; unsupported versions are rejected. `governanceInsights` stores the
selected view, separate findings and register searches, priority, lifecycle phase,
and the attention-only filter. Search strings are limited to 200 characters.
Preferences follow the authenticated account and use the existing optimistic
workflow revision checks. They do not grant access to another register tenant.

Every workflow save atomically appends a full snapshot to
`register.workflow_revisions`. Runtime clients may read their own history but
cannot insert, alter, or delete historical rows directly. The owner comes from
the server-signed identity, and the database supplies the recording timestamp.
The migration copies only each existing workflow's current revision, labeled
`legacy-baseline`; its timestamp is the migration recording time, not an invented
historical action. Older revisions that were never stored cannot be reconstructed.

`GET /api/workflow/history` returns up to 50 revisions, newest first, and a
`nextBeforeRevision` cursor. Pass that value as `?beforeRevision=<revision>` to
retrieve older entries. Responses are authenticated, account-scoped, and no-store.
History is currently exposed through this API, not a restore or history editor.

Completing an insights review persists a workflow acknowledgement only after its
assessment and confirmed simulation are saved. Changing those source inputs
requires saving an unreviewed state first. Prior snapshots retain the acknowledged
assessment ID and simulation values. A workflow acknowledgement is not a provider
test pass, register approval, or certification of the separately loaded register
inventory. Register records retain their own tenant-specific revision history.

Full snapshots include filters and recommendations and can grow with frequent
edits. No automatic history retention or deletion policy is introduced. Include
this table in capacity planning, protected backups, and an approved retention plan.

## Future Schema Changes

For each future feature that introduces durable state:

1. Define the owning account or register tenant, source provenance, units, null
    semantics, and payload version before adding fields or tables.
2. Add a numbered, repeatable migration in `server/src/register/migrations`.
    Prefer additive changes; preserve historical evidence and make any backfill
    distinguishable from user activity. Back up before applying it.
3. Extend the server validator, client types, and hydration defaults together.
    For incompatible payloads, add an explicit version transition and update the
    database version guard before writing the new version. Do not accept arbitrary
    unvalidated extension JSON as a substitute for a feature contract.
4. Route writes through authenticated, CSRF-protected APIs with account or tenant
    isolation, optimistic concurrency, and atomic history where required.
5. Add focused compatibility, access, concurrency, and history tests. Add new
    durable tables to the recovery fingerprints in `scripts/register-db.mjs`.
6. Run migration repeatability checks, `npm run persistence:test`, and
    `npm run register:check`. Verify backup restoration without concurrent writes
    before declaring the new persistence path ready.

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
0600. They contain all seven register and application tables, including encrypted
OAuth/refresh-token sessions, assessments, workflow history, and report bytes.
One-time assessment billing tokens are not persisted. Keep encrypted
off-host copies and a retention policy; a local volume and a local dump are not disaster
recovery. Recovery verification briefly recreates the database container with its existing
volume, compares record/history fingerprints, restores into a randomly named separate
database, and drops only that temporary database. Run it in a maintenance window without
concurrent writes. It never restores over the active database or removes its volume.

For disaster recovery, provision PostgreSQL with the required roles, restore the dump
into a new empty database with `pg_restore --exit-on-error --no-owner`, validate records
and audit history, then explicitly switch the gateway database URI. Do not run
`docker compose down -v`. Preserve original backups until restoration is accepted.
