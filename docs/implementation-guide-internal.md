---
title: Internal Repository Application Implementation Guide
description: Internal, repository application-specific guidance for implementing and operating the AI Credits governance workflow
---

## Purpose and outcomes

This internal guide is for maintainers, reviewers, and operators of this
repository application. It documents how the application implements an
auditable set of AI Credit (AIC) budget and organization policy profiles.

The fields, rates, heuristics, pages, and generated artifacts described here
are implementation details. They are not released customer requirements.
Customers implementing the governance approach without this application should
use the [standalone customer implementation guide](implementation-guide-external.md).

The application process runs from source-data validation through approved
profile design, pilot, rollout, monitoring, and controlled change.

The implementation should produce these outcomes:

* One approved enterprise spending limit
* One Universal User-Level Budget (Universal ULB) baseline
* Approved cost-center ULB overrides for eligible user cohorts
* Approved organization policy profiles mapped to business requirements
* A profile register with named owners, approvers, assignments, and evidence
* Reconciled assessment, simulator, and billing records
* Measurable alert, escalation, exception, rollback, and review controls

> [!IMPORTANT]
> The application is an assessment, simulation, recommendation, and reporting
> tool. It does not create, update, or delete GitHub budgets, cost centers,
> organizations, teams, users, or Copilot policy settings. Authorized customer
> administrators perform and verify all production changes in approved systems.

## Data and action boundaries

Treat every value according to its provenance. Do not present calculated,
synthesized, or manually entered values as raw GitHub telemetry.

| Category                 | Values and activities                                                                                                                                                        | Required treatment                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GitHub-sourced data      | AI Credit usage by organization and model, identifiable user usage when returned, license inventory, budgets, cost centers, organizations, teams, users, and team membership | Record retrieval time, scope, warnings, and permissions. Preserve unavailable values as unknown, not zero.  |
| Application calculations | Included pool estimate, burn rate, exhaustion day, overage credits and cost, population totals, and governance impact                                                        | Record input values, rate basis, calculation date, and scenario name. Reconcile results before approval.    |
| Advisory heuristics      | Concentration score, top-user cohorts, organization profile suggestions, governance gaps, readiness score, and daily trend                                                   | Label as advisory or synthesized. Require human review before production assignment or financial decisions. |
| Manual customer actions  | Define ownership, approve values, configure GitHub resources and policies, communicate changes, train users, and roll back                                                   | Execute through customer change control. Capture operator, approval, timestamp, evidence, and verification. |

The assessment reads GitHub governance and inventory data where credentials
and endpoints permit. It does not retrieve or apply Copilot policy settings.
Policy fields in Classes 7 through 10 are built-in planning examples, not a
representation of current GitHub policy state.

The assessment daily trend evenly distributes current total consumption across
the selected period. It is synthesized for display and is not daily GitHub
telemetry. The governance readiness score is also heuristic: recommendations
reduce a starting score of 100 according to their priority.

## Prerequisites and accountability

Complete the prerequisites before collecting data or selecting profiles.

| Prerequisite                  | Acceptance condition                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorized application access | GitHub OAuth is connected by a user who can read the target enterprise and organizations.                                                             |
| Enterprise billing access     | An approved enterprise billing credential is available when budgets, cost centers, enterprise usage, and enterprise-direct license data are required. |
| Defined assessment scope      | Enterprise slug, organization slugs, billing cycle, assessment period, and included or excluded populations are documented.                           |
| Named business ownership      | Budget owner, security owner, license owner, business owners, and platform administrator are assigned.                                                |
| Approved evidence location    | A controlled location exists for reports, approvals, profile-register versions, and change records.                                                   |
| Current naming standard       | Customer naming patterns and approved values are published and available to profile designers.                                                        |
| Change and rollback process   | Production operators can submit, approve, verify, and reverse changes through the customer process.                                                   |

### Accountable roles

| Role                            | Accountability                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Executive sponsor               | Accepts enterprise risk posture and unresolved business exceptions                             |
| Enterprise budget owner         | Approves spending limits, ULB values, alert recipients, and financial variance                 |
| GitHub enterprise administrator | Performs and verifies approved GitHub configuration changes                                    |
| Security and compliance owner   | Approves model, feature, integration, data-handling, and exception requirements                |
| License owner                   | Validates license inventory, SKU assignment, and entitlement assumptions                       |
| Organization business owner     | Confirms user need, organization assignment, and operational impact                            |
| Cost-center owner               | Approves cohort membership, higher ULB ceilings, and chargeback mapping                        |
| Service owner                   | Owns the profile register, evidence, operating cadence, and change control                     |
| Pilot lead                      | Coordinates pilot users, support, feedback, success measures, and rollback                     |
| Internal audit or risk reviewer | Reviews evidence completeness, approvals, reconciliations, and control operation when required |

No advisory score can replace business, security, license, and budget owner
approval. Record each approval before production assignment.

## Required inputs and validation

### Assessment inputs

| Input                    | Implemented check                                                                                          | Customer control                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Enterprise slug          | Required; alphanumeric characters and internal hyphens; no leading or trailing hyphen; up to 39 characters | Confirm it is the enterprise account slug, not a display name or organization slug.                                           |
| Organization slugs       | At least one; comma-separated in the UI; each value follows the enterprise-slug character rule             | Confirm completeness against the approved in-scope organization list.                                                         |
| Enterprise billing token | Optional in the form; 512 characters or fewer                                                              | Use an approved secret path. Never place the token in reports, registers, screenshots, or source files.                       |
| Assessment period        | `7`, `30`, or `custom`; custom period from 1 through 90 days                                               | Record that usage endpoints request the current billing month; do not infer historic daily telemetry from the display period. |

### Simulator inputs

| Input                    | Implemented check                                                                                    | Customer control                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Enterprise name          | Required; 100 characters or fewer                                                                    | Use the approved reporting name.                                                                             |
| License counts           | Nonnegative integers; at least one licensed user across Business, Enterprise, Cloud Agent, and Spark | Reconcile counts to the license-owner record. Simulator counts are manually confirmed planning assumptions.  |
| Billing-cycle start date | Valid date                                                                                           | Match the financial reporting cycle used for reconciliation.                                                 |
| Current day of cycle     | Integer from 1 through 31                                                                            | Confirm the day aligns with the consumed-credit snapshot.                                                    |
| Credits consumed so far  | Nonnegative number                                                                                   | Enter a sourced snapshot. Mark unavailable input as unknown outside the simulator rather than entering zero. |
| Population allocation    | Nonnegative integers whose total equals total licensed users                                         | Assign every licensed user once across Universal, Overage, Abundant, and Exponential cohorts.                |
| Scenario name            | 60 characters or fewer                                                                               | Include rate basis, cycle, and scenario purpose in the supporting record.                                    |

> [!WARNING]
> From June 1 through August 31, 2026, the live assessment estimates included
> credits at 3,000 per Copilot Business license and 7,000 per Copilot
> Enterprise license. The simulator and generated PDF use standard rates of
> 1,900 Business, 3,900 Enterprise, 3,900 Cloud Agent, and 500 Spark credits per
> license. Label the rate basis on every comparison. Review and rerun all
> affected assessments, scenarios, approvals, and reports after August 31, 2026. Do not approve a variance until rate-basis differences are isolated.

## Three-tier budget hierarchy

ULB means User-Level Budget. AIC means AI Credit. The implemented governance
hierarchy applies controls in this order:

| Tier | Control                   | Scope                                 | Purpose                                                                            |
| ---- | ------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| 1    | Enterprise Spending Limit | Metered overage across the enterprise | Provides the final enterprise hard cap after the included pool is consumed.        |
| 2    | Universal ULB             | Each user across the enterprise       | Provides the default monthly per-user ceiling of 5,000 credits.                    |
| 3    | Cost Center ULB Overrides | Approved users in mapped cost centers | Replaces the Universal ULB with a 6,000, 7,000, or 8,000 monthly per-user ceiling. |

The Tier 3 assignment is the most specific per-user control and takes
precedence over the Tier 2 default for mapped users. Tier 1 remains the
enterprise backstop across all metered overage. A user reaching an applicable
ULB hard stop cannot continue metered usage under that profile. If aggregate
metered overage reaches the enterprise spending hard stop, affected usage stops
regardless of remaining user-level headroom. Validate exact provider behavior
in the target environment before rollout.

Class 1 represents the included pool. It is not a configurable hard stop in the
built-in catalog, but its exhaustion determines when metered overage exposure
begins.

## Canonical profile catalog

The ten built-in classes are canonical application records. Internal field
names and string values are shown exactly where they are implemented.

### Budget and pool Classes 1 through 6

| Class | `name`                              | `slug`                                | `scope`       | `budgetType`      | `skus`               |
| ----- | ----------------------------------- | ------------------------------------- | ------------- | ----------------- | -------------------- |
| 1     | Enterprise Included AI Credits Pool | `enterprise-included-ai-credits-pool` | `enterprise`  | `included`        | `All AI Credit SKUs` |
| 2     | Enterprise Spending Limit           | `enterprise-spending-limit`           | `enterprise`  | `metered-overage` | `All AI Credit SKUs` |
| 3     | Universal User-Level Budget (ULB)   | `universal-ulb`                       | `enterprise`  | `ulb`             | `All AI Credit SKUs` |
| 4     | Overage Users (ULB Cost Center)     | `ulb-cost-center-overage-users`       | `cost-center` | `ulb`             | `All AI Credit SKUs` |
| 5     | Abundant Users (ULB Cost Center)    | `ulb-cost-center-abundant-users`      | `cost-center` | `ulb`             | `All AI Credit SKUs` |
| 6     | Exponential Users (ULB Cost Center) | `ulb-cost-center-exponential-users`   | `cost-center` | `ulb`             | `All AI Credit SKUs` |

| Class | `budgetCredits` | `unit`        | `frequency`   | `stopUsage`      | `excludeCostCenter` | `alertThresholds` |
| ----- | --------------- | ------------- | ------------- | ---------------- | ------------------- | ----------------- |
| 1     | Not specified   | Not specified | Not specified | `not-applicable` | `not-applicable`    | `0.75`, `0.9`     |
| 2     | Not specified   | Not specified | Not specified | `true`           | Not specified       | `0.75`, `0.9`     |
| 3     | `5000`          | `per-user`    | `per-month`   | `true`           | Not specified       | `0.75`, `0.9`     |
| 4     | `6000`          | `per-user`    | `per-month`   | `true`           | Not specified       | `0.75`, `0.9`     |
| 5     | `7000`          | `per-user`    | `per-month`   | `true`           | Not specified       | `0.75`, `0.9`     |
| 6     | `8000`          | `per-user`    | `per-month`   | `true`           | Not specified       | `0.75`, `0.9`     |

| Class | `costCenterId` | `enterpriseTeam`             | `modelOption1` | `modelOption2`          | `modelOption3`          |
| ----- | -------------- | ---------------------------- | -------------- | ----------------------- | ----------------------- |
| 1     | Not specified  | Not specified                | Not specified  | Not specified           | Not specified           |
| 2     | Not specified  | Not specified                | Not specified  | Not specified           | Not specified           |
| 3     | Not specified  | Not specified                | `auto-mode`    | Not specified           | Not specified           |
| 4     | `aic-0011-ovr` | `aic-overage-usage-team`     | `auto-mode`    | `open-ai-gpt-5.6-sol`   | `open-ai-gpt-5.6-terra` |
| 5     | `aic-0012-abd` | `aic-abundant-usage-team`    | `auto-mode`    | `open-ai-gpt-5.6-sol`   | `open-ai-5.6-luna`      |
| 6     | `aic-0013-exp` | `aic-exponential-usage-team` | `auto-mode`    | `open-ai-gpt-5.6-terra` | `open-ai-5.6-luna`      |

The 5,000, 6,000, 7,000, and 8,000 values, mappings, teams, and model strings
are fixed built-in examples. Class 2 intentionally has no canonical limit;
the customer selects and approves that value. Class 1 is calculated from
license inputs and the applicable rate basis. Production owners may propose
different values, but must version them as customer profiles and preserve the
canonical source record for comparison.

### Organization policy Classes 7 through 10

Classes 7 through 10 are organization policy profiles. They are never
organization budget classes. Their license counts, included-credit values,
cost centers, organizations, teams, models, and features are fixed examples in
the application catalog. Customers select and approve production mappings and
settings after validating requirements and provider capabilities.

| Class | `name`                                                                 | `slug`                   | `scope`        | `budgetType` | `skus`            |
| ----- | ---------------------------------------------------------------------- | ------------------------ | -------------- | ------------ | ----------------- |
| 7     | Organization Policy: Standard (Copilot Business)                       | `org-policy-standard`    | `organization` | `org-policy` | `GHCP Business`   |
| 8     | Organization Policy: Engineering (Copilot Enterprise)                  | `org-policy-engineering` | `organization` | `org-policy` | `GHCP Enterprise` |
| 9     | Organization Policy: Architects (Copilot Enterprise)                   | `org-policy-architects`  | `organization` | `org-policy` | `GHCP Enterprise` |
| 10    | Organization Policy: AI Platform SMEs (Copilot Enterprise, All Access) | `org-policy-ai-platform` | `organization` | `org-policy` | `GHCP Enterprise` |

| Class | `licenseCountBusiness` | `licenseCountEnterprise` | `includedCredits` | `costCenterId` | `enterpriseOrg`                    | `enterpriseTeam`           |
| ----- | ---------------------- | ------------------------ | ----------------- | -------------- | ---------------------------------- | -------------------------- |
| 7     | `10`                   | Not specified            | `19000`           | `org-0001-dig` | `autocloudarc-digital-services`    | `digital-services-team`    |
| 8     | Not specified          | `3`                      | `5700`            | `org-0004-mfg` | `autocloudarc-manufacturing-group` | `manufacturing-group-team` |
| 9     | Not specified          | `5`                      | `19500`           | `org-0009-spc` | `autocloudarc-space-fleet`         | `space-fleet-team`         |
| 10    | Not specified          | `3`                      | `11700`           | `org-0005-mar` | `autocloudarc-marine-industries`   | `marine-industries-team`   |

| Class | `chatEnabled` | `autoModeEnabled` | `agentModeEnabled` | `cloudAgentEnabled` | `repoRefactorEnabled` | `mcpIntegrationsEnabled` |
| ----- | ------------- | ----------------- | ------------------ | ------------------- | --------------------- | ------------------------ |
| 7     | `true`        | `true`            | `false`            | `false`             | `false`               | `false`                  |
| 8     | `true`        | `true`            | `limited`          | `false`             | `true`                | Not specified            |
| 9     | `true`        | `true`            | `true`             | `limited`           | `true`                | `true`                   |
| 10    | `true`        | `true`            | `true`             | `true`              | `true`                | `true`                   |

| Class | `modelOption1` | `modelOption2`  | `modelOption3`  |
| ----- | -------------- | --------------- | --------------- |
| 7     | `gpt-5-mini`   | `claude-haiku`  | Not specified   |
| 8     | `gpt-5`        | `gpt-5-codex`   | `claude-sonnet` |
| 9     | `gpt-5`        | `claude-sonnet` | Not specified   |
| 10    | `all`          | `all`           | `all`           |

Fields shown as `Not specified` are undefined in the implementation. Do not
convert them to `false`, zero, an empty policy, or an inferred value.

## Advisory assignment rules

Use engine output to identify candidates, then apply business context and
approval. Engine thresholds are advisory heuristics, not production policy.

| Class | Implemented advisory signal                                                                                                                                                                                                        | Required human decision                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1     | Included pool is estimated from license inventory and configured rates.                                                                                                                                                            | License and budget owners reconcile the pool to authoritative billing records.                                |
| 2     | Recommend when projected pool exhaustion is before day 25 of a 30-day cycle; suggested limit is 120% of projected overage cost.                                                                                                    | Budget owner selects the limit and confirms cash exposure, continuity needs, and hard-stop impact.            |
| 3     | Recommend without assessment, or if the highest 10% of the top-user sample (up to ten records) exceeds 40% of usage or has a concentration score over 40. Scenario ULB uses 130% of included credits per user; canonical is 5,000. | Business and budget owners confirm the enterprise default and users for whom a hard stop is acceptable.       |
| 4     | Candidate users consume more than 1 times and no more than 2 times average consumption.                                                                                                                                            | Cost-center owner confirms legitimate elevated work and the 6,000 ceiling.                                    |
| 5     | Candidate users consume more than 2 times and no more than 3 times average consumption.                                                                                                                                            | Cost-center owner confirms sustained high-intensity work and the 7,000 ceiling.                               |
| 6     | Candidate users consume more than 3 times average consumption.                                                                                                                                                                     | Cost-center and security owners confirm exceptional need, model access, weekly review, and the 8,000 ceiling. |
| 7     | Default organization profile; also recommended when frontier-model share exceeds 30% for standard organizations.                                                                                                                   | Business, security, and license owners approve Business licensing and the example restricted feature set.     |
| 8     | Organization consumption is more than 1.1 times and no more than 1.75 times the assessed organization average.                                                                                                                     | Owners approve Enterprise licensing, limited Agent Mode, repository refactor, and model access.               |
| 9     | Organization consumption is more than 1.75 times and no more than 2.5 times the assessed organization average.                                                                                                                     | Owners approve architecture use cases, integrations, limited Cloud Agent, and model access.                   |
| 10    | Organization consumption is more than 2.5 times the assessed organization average.                                                                                                                                                 | Executive, security, license, and budget owners approve all-access need and enhanced monitoring.              |

Do not use an average-based rule when any organization, license, user, or usage
source is unavailable. Resolve the gap or mark the recommendation as
non-actionable. Before assignment, review business purpose, data sensitivity,
security controls, license eligibility, expected cost, interruption impact,
and owner acceptance.

## Profile register and naming

Maintain one controlled profile register. Use stable record identifiers and
version every approved change.

| Required field                    | Purpose                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Register record ID                | Stable customer identifier independent of a GitHub display name                          |
| Canonical class ID and slug       | Links the customer profile to Class 1 through 10                                         |
| Customer profile name and version | Identifies the approved production variant                                               |
| Profile type and scope            | Distinguishes pool, budget, ULB, and organization policy records                         |
| Enterprise and organization       | Records the assignment boundary                                                          |
| Cost center and team              | Records the ownership and population mapping                                             |
| User or cohort rule               | Defines who is assigned and prevents duplicate assignment                                |
| SKU and license basis             | Records license types, counts, source, and snapshot time                                 |
| Credit or currency limit          | Records value, unit, frequency, rate basis, and effective date                           |
| Alert and hard-stop settings      | Records 75%, 90%, and 100% behavior and recipients                                       |
| Models and features               | Records approved values, restrictions, and `Not specified` fields                        |
| Business owner                    | Accepts purpose and user impact                                                          |
| Budget and cost-center owners     | Accept financial exposure and chargeback                                                 |
| Security and license approvers    | Accept policy, integration, entitlement, and data-handling posture                       |
| Technical operator                | Performs the approved production action                                                  |
| Evidence links                    | Links assessment, scenario, report, approval, change, verification, and rollback records |
| Review and expiry dates           | Forces periodic reassessment and time-bounds exceptions                                  |
| Status                            | Uses proposed, pilot, approved, active, suspended, retired, or rolled-back               |

Apply the customer rules in the
[GitHub Governance Naming Standards](naming-standards/naming-standards.md).
The built-in identifiers such as `aic-0011-ovr`, `org-0001-dig`, and
`aic-overage-usage-team` are examples and may not comply with customer naming
patterns. Do not rename existing provider resources without an approved
migration. Record noncompliance as drift or an approved exception.

## Gated implementation procedure

### Phase 1: Prepare

Accountable roles: service owner, enterprise budget owner, security owner,
license owner, and GitHub enterprise administrator.

1. Name every accountable role and escalation delegate.
2. Define enterprise, organization, user, SKU, and billing-cycle scope.
3. Confirm application access and read permissions with non-destructive checks.
4. Approve evidence storage, data handling, retention, and secret handling.
5. Publish customer naming standards and the profile-register template.
6. Define pilot success, alert response, hard-stop communication, and rollback criteria.

Outputs and evidence:

* Signed scope and role matrix
* Access test with no credentials captured
* Approved data-handling and evidence plan
* Profile-register template
* Pilot and rollback criteria

Exit gate: all owners accept the scope, permissions, evidence location, and
decision rights. No assessment begins with an unowned data source.

### Phase 2: Assess and baseline

Accountable roles: service owner, license owner, budget owner, and GitHub
enterprise administrator.

1. Enter validated enterprise and organization slugs and select the assessment period.
2. Run the assessment and retain its timestamp, scope, rate basis, and warnings.
3. Record GitHub-sourced usage, inventory, budget, cost-center, organization, team, user, and membership data.
4. Mark each missing source as unavailable. Do not substitute zero or an empty list.
5. Reconcile license totals, included pool, gross usage, included usage, metered usage, and budget consumption to authoritative records.
6. Label the daily trend, concentration score, governance gaps, and readiness score as synthesized or heuristic.
7. Establish the approved baseline and document unresolved variances.

Outputs and evidence:

* Dated assessment result and warning list
* Source inventory and data-quality log
* Billing and license reconciliation
* Approved baseline with variance explanations

Exit gate: required sources are complete or explicitly accepted as limitations,
and budget and license owners approve the reconciled baseline.

### Phase 3: Design

Accountable roles: service owner, budget owner, security owner, license owner,
organization business owners, and cost-center owners.

1. Create Class 1 and Class 2 register records using the reconciled pool and customer-selected enterprise spending limit.
2. Model the Class 3 Universal ULB and Class 4 through 6 population allocations.
3. Confirm that allocations are nonnegative and total the licensed population exactly once.
4. Review advisory thresholds, then confirm each user cohort using business purpose and interruption impact.
5. Map each organization to one proposed Class 7 through 10 policy profile.
6. Review every proposed model and feature value with security and license owners.
7. Apply customer naming rules and record drift from built-in examples.
8. Compare scenarios under promotional and standard rate bases when the assessment falls within the promotional period.

Outputs and evidence:

* Versioned proposed profile register
* Scenario comparison and population mapping
* Organization policy mapping
* Security, licensing, and naming review notes

Exit gate: every proposed assignment has one owner, a documented rationale,
complete inputs, and no unresolved duplicate or missing population mapping.

### Phase 4: Approve

Accountable roles: enterprise budget owner, security owner, license owner,
business owners, and executive sponsor for accepted exceptions.

1. Review the report and trace every recommendation to its source, calculation, or heuristic.
2. Approve the enterprise limit, ULB values, alert recipients, hard-stop response, and policy mappings separately.
3. Record approvals from business, security, license, budget, and cost-center owners as applicable.
4. Time-bound exceptions and define compensating controls, expiry, and reapproval conditions.
5. Approve pilot population, duration, support plan, success measures, and rollback trigger.
6. Open customer change records for manual production configuration.

Outputs and evidence:

* Signed profile-register version
* Decision log and exception register
* Approved pilot and rollback plan
* Authorized production change records

Exit gate: each profile is approved, rejected, or returned to design with a
named action owner.

### Phase 5: Pilot

Accountable roles: pilot lead, GitHub enterprise administrator, service owner,
support lead, and affected business owners.

1. Capture the pre-change configuration and a tested restoration procedure.
2. Have an authorized administrator manually configure approved pilot controls in GitHub.
3. Independently verify values, scope, recipients, and hard-stop behavior against the approved register.
4. Notify pilot users of limits, alert handling, support, and interruption paths.
5. Monitor consumption, alerts, workflow impact, support demand, and exception requests each week.
6. Reconcile pilot results to billing records and collect structured user and owner feedback.
7. Roll back when a trigger is met, evidence is incomplete, or an unapproved population is affected.

Outputs and evidence:

* Before and after configuration evidence
* Independent verification record
* Weekly pilot measures and feedback
* Incident, exception, and rollback records

Exit gate: success measures are met for the approved duration, reconciliations
are within accepted tolerance, and owners approve rollout. Otherwise, roll back
or return to design.

### Phase 6: Roll out

Accountable roles: service owner, GitHub enterprise administrator, change
manager, support lead, and organization business owners.

1. Sequence rollout by organization or cohort to limit simultaneous impact.
2. Confirm the approved register version and current source data before each wave.
3. Communicate effective dates, limits, alerts, support, and exception routes.
4. Have authorized administrators manually apply the approved GitHub changes.
5. Verify each wave against the profile register and record discrepancies.
6. Pause or roll back a wave when hard-stop impact, data variance, or assignment error exceeds approved criteria.
7. Close each change only after evidence and ownership records are complete.

Outputs and evidence:

* Wave plan and communications
* Change and verification records for each wave
* Updated active profile register
* Rollout reconciliation and acceptance

Exit gate: all in-scope assignments match the active register, unresolved
variances have owners and due dates, and operations accepts support ownership.

### Phase 7: Operate and improve

Accountable roles: service owner, budget owner, security owner, license owner,
cost-center owners, and organization business owners.

1. Run weekly operational reviews for alerts, high-consumption cohorts, hard stops, incidents, and active exceptions.
2. Run monthly financial reviews for license counts, pool estimates, consumption, overage, cost-center allocation, forecast, and reassignment.
3. Run quarterly governance reviews for profile values, organization policies, models, features, ownership, exceptions, training, and naming drift.
4. Rerun assessment and scenarios after material license, rate, organizational, policy, or usage changes.
5. Process changes through versioning, approvals, testing, implementation, verification, and rollback readiness.
6. Retire stale profiles and preserve evidence according to customer retention policy.

Outputs and evidence:

* Weekly, monthly, and quarterly review records
* Reconciliations, trends, incidents, and exception decisions
* Versioned profile changes and retirement records
* Improvement backlog with owners and target dates

Exit gate: recurring controls operated on schedule, exceptions are current, and
the active register matches verified production state.

## Monitoring and response controls

Apply these responses to profiles that support alerts and hard stops. Class 1
uses thresholds for pool monitoring, but `stopUsage` is `not-applicable`.
Classes 2 through 6 use `stopUsage: true` in the canonical catalog.

| Threshold | Required response                                                                                                                                                                | Evidence                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 75%       | Notify the profile and budget owners; validate source completeness; confirm burn rate, forecast, assignment, and remaining need.                                                 | Alert record, owner acknowledgment, refreshed forecast, and data-quality check                |
| 90%       | Escalate to the cost-center or enterprise budget owner; review headroom, continuity impact, exceptions, and communications; freeze nonessential increases.                       | Escalation decision, impact assessment, approved action, and user communication               |
| 100%      | Enforce the configured hard stop where supported; open an incident or financial-control record; notify owners and users; require emergency approval for restoration or increase. | Provider event, incident record, approval or rollback decision, and post-event reconciliation |

| Cadence   | Minimum review                                                                                                                                |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Weekly    | 75%, 90%, and 100% events; Classes 4 through 6; top-user concentration; incidents; data warnings; pilot measures; expiring exceptions         |
| Monthly   | License inventory; included pool; gross, included, and metered usage; overage; budget consumption; cost-center mapping; forecast; assignments |
| Quarterly | All ten profiles; organization policy mappings; models and features; owner access; naming drift; exception necessity; training; changes       |

## Data quality and reconciliation

Use this resolution sequence whenever a source is incomplete or totals differ:

1. Preserve the original result and warning. Do not overwrite evidence.
2. Classify the value as GitHub-sourced, calculated, heuristic, synthesized, or manual.
3. Confirm scope, timestamp, billing month, organization list, SKU mapping, and rate basis.
4. Compare enterprise totals with organization totals and identify expected coverage differences.
5. Compare license-owner records with organization and enterprise-direct license inventory.
6. Compare gross usage, included usage, net metered usage, pool use, and budget consumption without treating them as interchangeable.
7. Recalculate scenarios with reconciled inputs and the applicable rate basis.
8. Record variance amount, cause, owner, disposition, and approval.
9. Block production assignment when a missing value affects averages, hard-stop impact, license eligibility, or spending exposure.

An empty result is zero only when the source completed successfully and the
provider explicitly returned no matching records. A failed, hidden,
unauthorized, unsupported, or partially retrieved source is unknown or
unavailable.

## Exceptions, change control, and rollback

Every exception must identify the profile, affected population, business
reason, risk, compensating controls, budget impact, approvers, effective date,
expiry date, and rollback trigger. Review exceptions weekly and reapprove or
close them before expiry.

Use this change sequence for limits, assignments, models, features, names, and
alert recipients:

1. Open a change request linked to the active profile-register version.
2. Capture the current production state and reconciliation baseline.
3. Assess financial, security, license, business, support, and hard-stop impact.
4. Obtain required approvals and update the proposed register version.
5. Test through a pilot or documented impact-validation path.
6. Have an authorized administrator apply the change manually.
7. Independently verify provider state and monitor the agreed observation period.
8. Roll back on assignment error, unauthorized access, unexpected interruption, unreconciled variance, or failed success criteria.
9. Close the change after evidence is complete and the active register is updated.

Rollback restores the captured prior provider state and prior active register
version. It does not delete assessment history, approval records, incidents, or
evidence needed for audit.

## Report and evidence checklist

Before approving a profile or closing a rollout wave, confirm the evidence set
contains:

* Assessment scope, timestamp, source warnings, and authorization context
* GitHub-sourced usage, license, budget, cost-center, organization, team, user, and membership records used in the decision
* Simulator inputs, population allocation, scenario name, calculation outputs, and rate basis
* Explicit labels for application calculations, heuristics, and synthesized daily trend
* Reconciliation to authoritative license and billing records
* Profile-register version with mappings, values, owners, and effective dates
* Business, security, license, budget, and cost-center approvals as applicable
* Exception records with expiry and compensating controls
* Before and after provider configuration evidence captured by authorized operators
* Independent verification, alert tests, pilot results, and user communications
* Change, incident, rollback, and post-change monitoring records
* Generated PDF reviewed against the current profile register and standard rate basis
* Post-August 31, 2026 review for decisions that used promotional assessment rates

## Glossary

| Term                        | Definition                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| AI Credit (AIC)             | Unit used by the application to represent GitHub Copilot usage-based consumption.                           |
| Included pool               | Estimated credits included with configured license inventory for the applicable rate basis.                 |
| Metered overage             | Consumption beyond the included pool that the application estimates at `0.01` USD per credit.               |
| User-Level Budget (ULB)     | Monthly per-user credit ceiling used by Universal and cost-center profiles.                                 |
| Universal ULB               | Enterprise-wide default ULB, represented by canonical Class 3 at 5,000 credits per user per month.          |
| Cost-center ULB override    | More specific Class 4, 5, or 6 per-user ceiling for an approved mapped cohort.                              |
| Enterprise Spending Limit   | Tier 1 hard cap on metered overage across the enterprise.                                                   |
| Organization policy profile | Class 7 through 10 planning record for SKU, model, and feature settings. It is not an organization budget.  |
| Hard stop                   | Configured behavior that prevents further applicable usage when a supported limit reaches 100%.             |
| Advisory heuristic          | Application rule that identifies a candidate action but requires human validation and approval.             |
| Synthesized data            | Display or planning data generated from other values rather than retrieved as raw provider telemetry.       |
| Profile register            | Controlled record of profile values, mappings, ownership, approvals, evidence, status, and version history. |
| Reconciliation              | Comparison that explains differences among source records, calculations, scenarios, and billing evidence.   |
| Rate basis                  | Credit-per-license values used for a pool estimate, including time-limited promotional or standard rates.   |

## References

* [GitHub Governance Naming Standards](naming-standards/naming-standards.md)
* The application Assessment page for GitHub-sourced results and data warnings
* The application Simulator page for manually confirmed planning assumptions and scenarios
* The application Recommendations page for advisory heuristic output
* The application Report page for preview and PDF generation
