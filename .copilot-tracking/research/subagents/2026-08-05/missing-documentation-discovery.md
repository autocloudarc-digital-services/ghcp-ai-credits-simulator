---
title: Missing Documentation Discovery
description: Evidence-based gaps in customer documentation for enterprise AI credit budgeting
author: GitHub Copilot
ms.date: 2026-08-05
ms.topic: reference
keywords:
  - documentation gaps
  - AI credits
  - enterprise governance
estimated_reading_time: 10
---

## Research Scope

Identify undocumented functionality relevant to enterprise AI-credit budgeting
and the requested implementation guide. Inspect `scripts/`, `extension/`,
`.github/skills/`, `client/src`, `server/src`, and `shared`. Treat only the
user-approved documentation paths as possible documentation targets.

## Surface Inventory

The repository does not contain `scripts/`, `extension/`, or `.github/skills/`
directories. No gaps can be attributed to those optional surfaces in this
checkout.

The existing `docs/implementation-guide.md` has headings for the expected
enterprise process, but each section contains only one sentence. It does not
document the implemented formulas, data provenance, profile values, rule
thresholds, validation constraints, or report interpretation.

## Documentation Gaps

### Gap 1: Ten Budget Profile Classes Lack an Operational Catalog

* Source: `client/src/data/budgetProfileClasses.ts:5-176`
* Functionality type: Budget profile taxonomy and policy configuration
* User impact: Customers cannot determine which scope, budget type, hard-stop
  behavior, alert threshold, cost center, team, model access, or feature
  entitlement belongs to each of the ten implemented classes. The generic guide
  sections do not distinguish included pools, spending limits, ULBs, and
  organization policies.
* Documentation approach: Add a complete class matrix and selection guidance to
  `docs/implementation-guide.md` sections 3, 4, and 13. Cross-reference the
  generic naming conventions in `docs/naming-standards/naming-standards.md`, but
  explain that the implemented sample identifiers use a separate profile
  taxonomy.

### Gap 2: Simulator Financial and Time Assumptions Are Undocumented

* Source: `client/src/engine/creditCalculationEngine.ts:13-26`,
  `client/src/engine/creditCalculationEngine.ts:29-66`, and
  `client/src/engine/creditCalculationEngine.ts:89-100`
* Functionality type: Simulator calculations and assumptions
* User impact: Customers may treat projections as provider-sourced facts without
  knowing that the simulator uses 1,900, 3,900, 3,900, and 500 credits per SKU,
  a fixed 30-day cycle, a USD 0.01 overage rate, average-to-date linear burn,
  and a governance cap based on 5,000 credits per user plus five percent.
* Documentation approach: Add an assumptions and formulas section to
  `docs/implementation-guide.md`, including equations, data-entry examples,
  effective dates, and a requirement to validate rates against current GitHub
  terms before financial use.

### Gap 3: Live Promotional Rates Diverge From Simulator and Report Rates

* Source: `server/src/routes/assessment.ts:37-70`,
  `client/src/engine/creditCalculationEngine.ts:13-18`, and
  `server/src/services/reportGenerationService.ts:77-80`
* Functionality type: Included-credit pool calculation and temporal pricing
* User impact: From June 1 through August 31, 2026, the live assessment uses
  3,000 Business and 7,000 Enterprise credits per license, while simulator and
  PDF output continue to use 1,900 and 3,900. During that window, displayed
  pools and report assumptions can conflict materially.
* Documentation approach: Add an urgent effective-date warning and reconciliation
  procedure to `docs/implementation-guide.md`. Add the known divergence to the
  README limitations until all product surfaces share one rate source.

### Gap 4: Simulator Input and Allocation Constraints Are Undocumented

* Source: `client/src/schemas/forms.ts:33-75` and
  `client/src/components/simulator/PopulationAllocation.tsx:11-16`
* Functionality type: Simulator input validation
* User impact: Customers are not told that at least one license is required,
  counts must be nonnegative integers, the current cycle day is restricted to
  1 through 31, consumed credits cannot be negative, and all licensed users
  must be assigned exactly once across four fixed ULB cohorts.
* Documentation approach: Add a simulator input checklist and cohort assignment
  example to `docs/implementation-guide.md` before the budget-definition steps.

### Gap 5: What-If Snapshot and CSV Behavior Is Not Described

* Source: `client/src/components/simulator/WhatIfScenarioBuilder.tsx:12-31` and
  `client/src/components/simulator/WhatIfScenarioBuilder.tsx:47-68`
* Functionality type: Scenario comparison and export
* User impact: Customers do not know that snapshots capture the current license
  and population configuration, only four scenarios are retained, names are
  limited to 60 characters, and CSV export contains pool, burn, exhaustion,
  overage-credit, and overage-cost projections.
* Documentation approach: Add a concise usage note to the README application
  workflow. A future simulator reference page could document the CSV schema;
  this does not need to expand the core implementation guide substantially.

### Gap 6: Assessment Scope and Period Controls Are Misleading Without Semantics

* Source: `client/src/components/assessment/ApiConfigForm.tsx:37-47`,
  `client/src/components/assessment/ApiConfigForm.tsx:83-84`,
  `client/src/schemas/forms.ts:23-30`, `server/src/routes/assessment.ts:151-181`,
  and `server/src/routes/assessment.ts:426-430`
* Functionality type: Assessment input scope and temporal semantics
* User impact: The selected organizations scope billing usage, while governance
  inventory expands to enterprise-discovered organizations. The UI offers 7,
  30, or 1-to-90 custom days, but GitHub usage is queried for the current year
  and month; `periodDays` only controls the number of synthesized daily chart
  points. Customers could incorrectly infer that a seven-day API query occurred.
* Documentation approach: Explain scope boundaries in
  `docs/implementation-guide.md` section 11. Add the period mismatch to README
  limitations until the implementation queries or filters the requested range.

### Gap 7: Assessment Data Fallback and Partial-Success Rules Are Undocumented

* Source: `server/src/routes/assessment.ts:179-190`,
  `server/src/routes/assessment.ts:241-257`, and
  `server/src/routes/assessment.ts:516-594`
* Functionality type: Assessment fallback behavior and data quality
* User impact: Organization usage returning 404 is skipped, enterprise usage
  replaces model totals when available, organization totals backfill total
  consumption when enterprise usage is unavailable, and governance or inventory
  failures are returned as warnings. Customers need to distinguish absence from
  zero and partial results from complete assessments.
* Documentation approach: Add a source-precedence and warning-interpretation
  table to `docs/implementation-guide.md` sections 11 and 15. Keep API failure
  troubleshooting in the README.

### Gap 8: Daily Trends, Top Users, and Concentration Scores Are Derived

* Source: `server/src/routes/assessment.ts:414-431` and
  `client/src/engine/creditCalculationEngine.ts:155-176`
* Functionality type: Assessment output derivation and privacy presentation
* User impact: Top users are limited to ten and displayed as anonymized
  `Developer NN` labels. Daily consumption is a uniform division of monthly
  consumption, not observed daily usage. Concentration uses the first ten
  percent of the supplied top-user list and scales share by 160. These outputs
  can otherwise be mistaken for direct GitHub telemetry.
* Documentation approach: Add metric definitions, derivation formulas, and
  interpretation cautions to `docs/implementation-guide.md` sections 14 and 15.

### Gap 9: Recommendation Rules and Thresholds Are Undocumented

* Source: `client/src/engine/creditCalculationEngine.ts:183-414`
* Functionality type: Governance recommendation engine
* User impact: Customers cannot audit why recommendations appear. Implemented
  triggers include greater than 40 percent concentration, one-to-two-times,
  two-to-three-times, and greater-than-three-times average user cohorts,
  exhaustion before day 25, greater than 30 percent frontier-model usage, and
  organization mappings at 1.1, 1.75, and 2.5 times average consumption.
* Documentation approach: Add a decision table with trigger, recommended class,
  configured value, rationale, and review cadence to
  `docs/implementation-guide.md` sections 17 and 18.

### Gap 10: Readiness and Overage Risk Labels Lack Definitions

* Source: `client/src/engine/creditCalculationEngine.ts:423-431`,
  `client/src/components/dashboard/GovernanceReadinessScore.tsx:12-13`, and
  `client/src/components/dashboard/DashboardSummary.tsx:15-21`
* Functionality type: Dashboard scoring and risk classification
* User impact: Governance readiness is a recommendation-penalty proxy, not a
  direct control audit. Critical, high, medium, and low recommendations subtract
  30, 18, 8, and 3 points. Labels use 0-to-33, 34-to-66, and 67-to-100 bands.
  Overage risk uses exhaustion before day 20 or 28. Without definitions,
  stakeholders may overstate the score's assurance value.
* Documentation approach: Add metric definitions and non-assurance language to
  `docs/implementation-guide.md`. The README overview should link to that
  interpretation guidance.

### Gap 11: Assessment Pool Utilization Uses Simulator State

* Source: `client/src/pages/Assessment.tsx:87`,
  `client/src/components/assessment/AssessmentResults.tsx:82-83`, and
  `client/src/store/appStore.ts:124-135`
* Functionality type: Assessment-to-simulator data provenance
* User impact: The assessment summary divides assessed consumption by the
  simulator's current included pool. Completing an assessment updates enterprise
  name and consumed credits but does not replace all simulator license counts.
  Pool utilization may therefore reflect planning defaults rather than the live
  included-credit pool shown later in the assessment.
* Documentation approach: Add a reconciliation checkpoint to
  `docs/implementation-guide.md`: confirm license assumptions before interpreting
  utilization or proceeding to recommendations. Add this behavior to README
  limitations until the summary uses a clearly labeled live or simulated pool.

### Gap 12: Report Provenance and Omissions Are Undocumented

* Source: `server/src/routes/report.ts:15-44` and
  `server/src/services/reportGenerationService.ts:51-174`
* Functionality type: Executive PDF generation and reporting constraints
* User impact: The PDF requires a completed assessment session but combines
  simulator license assumptions, a small subset of assessment fields, static
  governance prose, fixed 30/60/90-day actions, and generated recommendations.
  It does not include partial-data warnings, source provenance, observed-versus-
  synthesized distinctions, or the live promotional-rate logic.
* Documentation approach: Add a report interpretation and pre-distribution
  checklist to `docs/implementation-guide.md`. Add a concise content summary to
  the README and reserve field-level coverage for a future report reference.

### Gap 13: Client Polling Can Time Out Before Server Work Ends

* Source: `client/src/pages/Assessment.tsx:49-62` and
  `server/src/routes/assessment.ts:659-667`
* Functionality type: Assessment runtime constraint
* User impact: The client polls 20 times at 750-millisecond intervals, so it can
  report timeout after roughly 15 seconds while the in-memory server job
  continues. Large enterprises or throttled APIs may see false client failures
  with no documented recovery procedure.
* Documentation approach: Add this to README limitations and troubleshooting.
  A future operational guide should define expected duration, retry behavior,
  and job lifecycle.

## Existing Coverage Excluded From Gaps

The README adequately covers OAuth setup, required permissions, CSRF and session
controls, workflow gating, per-tab `sessionStorage`, process-local jobs and
reports, lack of durable storage, and the WebGL-to-2D visualization fallback.
Those behaviors should not be duplicated as new gaps in the implementation
guide unless a short cross-reference helps readers.

## Key Discoveries

* The live promotional-rate branch and standard simulator/report rates disagree
  during the current promotion window.
* The assessment-period selector does not change the GitHub billing month query.
  It changes only the synthesized trend length.
* Several prominent metrics are heuristics or derived presentations rather than
  direct provider observations.
* The assessment is intentionally tolerant of missing governance and inventory
  data, but completeness must be inferred from warnings.
* The generic naming standards use patterns such as
  `cc-ghcp-{business-unit}-{environment}`, while profile fixtures use identifiers
  such as `aic-0011-ovr`; the relationship is not explained.

## Status and Confidence

Status: Complete for the requested repository surfaces.

Total gaps: 13.

Confidence: High for local implementation and documentation coverage. No
external validation was performed against current GitHub product documentation,
so provider pricing, API lifecycle, and policy availability still require an
authoritative product-doc pass before publication.

Additional passes needed: No additional local source pass is required for the
requested scope. An external fact-check and a post-edit documentation review are
recommended before publishing customer guidance.

## Blockers and Clarifying Questions

No research blocker prevented completion. The optional `scripts/`, `extension/`,
and `.github/skills/` directories are absent, so they could not yield findings.

Clarifying questions for the documentation owner:

* Should promotional rates be presented as time-bound product facts or as a
  simulator configuration defect pending code alignment?
* Should the implementation guide document current application behavior exactly,
  or define the intended enterprise operating model and label application
  heuristics separately?

## Recommended Next Research

* [ ] Validate included-credit and overage rates against authoritative GitHub
  documentation as of the publication date
* [ ] Validate whether billing APIs can support true arbitrary 1-to-90-day
  assessment windows
* [ ] Confirm whether organization and enterprise license totals can overlap in
  the included-pool calculation
* [ ] Review report output with governance, finance, privacy, and accessibility
  stakeholders
* [ ] Re-scan optional directories if `scripts/`, `extension/`, or
  `.github/skills/` are added later
