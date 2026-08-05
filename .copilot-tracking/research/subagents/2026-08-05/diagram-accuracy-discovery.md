---
title: Diagram Accuracy Discovery
description: Evidence-backed content requirements and prohibitions for the internal and external governance diagrams
ms.date: 2026-08-05
ms.topic: reference
---

## Research questions

* What exact nodes, decisions, routes, controls, and caveats must the internal
  repository diagram contain?
* What exact provider-neutral content must the external customer diagram
  contain?
* Which flows in the current reference implementation are tempting but are
  not supported by repository behavior or the implementation guides?

## Scope and method

The review compared the two implementation guides with the application paths
that retrieve data, calculate scenarios, gate pages, generate recommendations,
and render reports. No external provider-behavior claim was accepted unless the
guides required it to be validated in the customer environment.

Primary evidence:

* docs/implementation-guide-internal.md
* docs/implementation-guide-external.md
* client/src/data/budgetProfileClasses.ts
* client/src/engine/creditCalculationEngine.ts
* client/src/App.tsx
* client/src/store/appStore.ts
* client/src/pages/Assessment.tsx
* client/src/pages/Simulator.tsx
* client/src/pages/Dashboard.tsx
* client/src/pages/Recommendations.tsx
* client/src/components/assessment/AssessmentResults.tsx
* client/src/components/visualization/AICFlowVisualizer.tsx
* client/src/components/recommendations/BudgetHierarchyDiagram.tsx
* server/src/routes/assessment.ts
* server/src/routes/report.ts
* server/src/services/githubBillingService.ts
* server/src/services/reportGenerationService.ts

## Internal diagram specification

Use three visually distinct lanes or node styles.

1. Provider evidence: read-only usage, license inventory, existing budgets,
   cost centers, organizations, teams, users, and memberships, each with scope,
   timestamp, authorization, and availability status.
2. Application output: calculations, synthesized trends, and advisory
   heuristics. These are not raw provider telemetry or approved controls.
3. Customer action: reconciliation, design choices, approvals, manual provider
   changes, verification, monitoring, exception handling, and rollback.

Required nodes and routes:

1. Start at `Authenticated read-only assessment request` and route to
   `Provider and customer evidence collected`.
2. Add `Required source complete and authorized?`. Route `No` to
   `Record Unknown or unavailable, retain warning, resolve or accept limitation`.
   Block design or approval when the missing value affects eligibility,
   averages, financial exposure, interruption impact, or enforcement.
3. Route `Yes or accepted limitation` to `Assessment baseline` with gross
   consumption, metered consumption when returned, organization and model
   totals, top-user sample, inventory, existing budgets, and cost centers.
4. Add application nodes for `Included-pool estimate from license inventory`,
   `Synthesized even daily trend`, `Concentration heuristic`, and
   `Governance-gap heuristic`.
5. Add a rate-basis decision. During 2026-06-01 through 2026-08-31 UTC, the
   assessment pool estimate uses 3,000 Business and 7,000 Enterprise credits
   per license. The simulator and PDF rate table use the standard basis of
   1,900 Business, 3,900 Enterprise, 3,900 Cloud Agent, and 500 Spark credits.
   Route both bases to reconciliation before comparison or approval.
6. Show the exact UI route and gates:
   `Assessment -> Simulator -> Governance Insights dashboard ->
   Recommendations -> Report`. Assessment completion unlocks Simulator.
   Confirming valid simulator inputs unlocks Dashboard. Entering Dashboard and
   Recommendations marks their UI review flags. These flags are navigation
   state, not formal business approval.
7. In the simulator node, show manually confirmed license counts, cycle day,
   credits consumed, and population allocation. Outputs are included-pool
   estimate, burn rate, exhaustion projection, overage credits and cost, and a
   governance comparison. The governance comparison currently caps with the
   Universal ULB only; population tier allocation and higher cost-center
   ceilings do not alter that calculation.
8. In the advisory node, show the implemented heuristic families:
   concentration to Universal ULB, top-user multiples to cohort candidates,
   projected early pool exhaustion to a proposed enterprise limit, model share
   to a standard access-profile suggestion, and organization-average multiples
   to organization-profile suggestions.
9. Present `Included pool estimate` as context, not a configurable hard stop.
10. Present `Enterprise spending limit` as a customer-selected metered-overage
    guardrail. The catalog has no canonical limit. The recommendation heuristic
    proposes 120 percent of projected overage cost.
11. Present `Universal ULB` as the default per-user proposal. Separate the
    canonical 5,000 example from the scenario recommendation, which can use
    130 percent of estimated included credits per user.
12. Present `Approved higher-usage cohort ULB overrides` as the built-in 6,000,
    7,000, and 8,000 per-user examples for advisory cohorts. Do not show that
    the application assigns users or creates cost centers.
13. Present `Organization policy profiles` as Classes 7 through 10 planning
    examples for license, model, and feature posture. Place them beside, not
    inside, the financial hierarchy. They are not organization budgets and are
    not retrieved current Copilot policy settings.
14. Add `Reconciled to authoritative license and billing records?`. Route `No`
    to variance investigation and recalculation. Route `Yes` to a human design
    and approval gate.
15. Add `Business, budget, security, license, and cohort owners approve?`.
    Route `No` to revise, reject, or time-bound an exception. Route `Yes` to
    `Authorized administrator manually applies approved provider changes` and
    then `Independent verification against the approved register`.
16. The report node must say `Preview and PDF generated from application state;
    standard rate table; advisory output requires review`.
17. Close with `Pilot -> staged rollout -> operate` and a
    `Monitor, reconcile, review, exception, rollback` loop back to baseline or
    design after material rate, license, organization, policy, or usage change.

Required caveat banner:

`Read-only assessment, simulation, recommendations, and reporting. The
application does not mutate GitHub governance resources and does not retrieve
or apply Copilot policy settings. Provider scope, precedence, alerting, and
enforcement must be validated with authoritative records and controlled tests.`

Internal prohibited concepts:

* Do not label the locally calculated included-pool estimate as a provider
  object automatically created or verified by the application.
* Do not draw application write routes to budgets, cost centers,
  organizations, teams, users, or policy settings.
* Do not claim the assessment observes or enforces Copilot policy settings.
* Do not present cost-center versus organization budget routing or ULB
  precedence as repository-computed behavior.
* Do not present `stopUsage` catalog examples or `preventFurtherUsage` fields as
  proof that requests will stop in every target environment.
* Do not place organization policy profiles in the budget hierarchy.
* Do not claim the simulator's governance curve models the 6,000, 7,000, and
  8,000 cohort overrides. It uses the Universal ULB ceiling for all users.

## External diagram specification

The external diagram must be tool-neutral. Use customer-controlled records and
provider capabilities rather than application or repository terms.

Required nodes and routes:

1. Start with two evidence inputs: `Authoritative provider evidence` and
   `Authoritative customer evidence`. Provider evidence includes current
   consumption, entitlements, costs, control coverage, and capability
   documentation. Customer evidence includes finance, license, population,
   ownership, risk, and business-need records.
2. Merge at `Evidence source register` with owner, scope, retrieval time,
   authorization, data condition, limitations, evidence location, and review
   date.
3. Add `Complete enough for this decision?`. Route `No` to
   `Record Unknown, never zero; resolve, formally accept limitation, or defer`.
   Route material unknowns to `Approval blocked`.
4. Route usable evidence to `Baseline worksheet` and then
   `Reconcile entitlement, gross, included, metered, cost, forecast, and
   existing control coverage`.
5. Add `Variance within approved tolerance and explained?`. Route `No` to
   source correction, variance ownership, and baseline refresh. Route `Yes` to
   four independent configurable governance layers.
6. Layer 1 wording: `Enterprise financial guardrail: customer-selected bound on
   aggregate exposure where supported`.
7. Layer 2 wording: `Universal per-user baseline: default customer-selected
   boundary for eligible users where supported`.
8. Layer 3 wording: `Approved higher-usage cohort override: justified,
   owned, time-bounded or standing alternative boundary`.
9. Layer 4 wording: `Organization access-policy archetype: separately approved
   feature and service access posture`. Do not connect it as a budget child or
   derive a financial limit from it.
10. Put `Validate capability, scope, overlap, precedence, alerts, transitions,
    and enforcement through current documentation and controlled testing`
    across all four layers before approval.
11. Show the lifecycle exactly as
    `Design -> Approval -> Limited pilot -> Staged rollout -> Operate`.
    At pilot, branch on `Success, tolerance, alert, and interruption criteria
    met?`. Route `No` to rollback and redesign. Route `Yes` to rollout.
12. Between approval and pilot or rollout, show
    `Authorized administrator applies approved change` followed by
    `Independent verification against active profile register`.
13. In Operate, show three configurable response branches:
    `Early warning -> validate data, refresh forecast, notify owners`,
    `Critical -> escalate, assess continuity, approve and communicate action`,
    and `Limit reached -> follow tested enforcement, incident, exception, or
    rollback path`.
14. Add an `Exception and rollback` control with reason, risk, compensating
    controls, forecast impact, approvers, expiry, review date, prior state, and
    rollback trigger. Route recurring and event-driven reviews back to evidence,
    reconciliation, or design.

Required caveat banner:

`Values, rates, thresholds, models, scope, precedence, alerts, and enforcement
are customer decisions constrained by current provider capabilities. Unknown
is not zero. Validate actual behavior before reliance.`

External prohibited concepts:

* No application, repository, page, endpoint, class ID, slug, or built-in name
* No fixed budget or consumption values
* No fixed license rates or cost rates
* No fixed alert or cohort thresholds
* No named model or fixed access-model list
* No universal provider enforcement, routing, inheritance, or precedence claim

## Tempting but inaccurate reference flows

The current in-application activity flow is useful as the closest available
reference. The supplied image itself was not available as a separate artifact,
so image-only details could not be inspected.

1. `Automatic Included Pool Established` overstates repository evidence. The
   server calculates a limit from license counts and date-sensitive rates. Use
   `Application included-pool estimate; reconcile to authoritative provider and
   billing records`. Confidence: high for repository behavior, medium for any
   universal provider claim.
2. `Governance and Policy Enforcement: All requests` is unsupported by the
   assessment. No current Copilot policy settings are retrieved or applied.
   Use `Policy planning examples; validate current provider state separately`.
   Confidence: high.
3. `Included Pool Exhausted? -> Metered AI Credits Begin` presents a local
   estimate as the provider's causal switch. The assessment can receive net
   metered quantity directly, while the pool limit is calculated. Use parallel
   measured and estimated nodes followed by reconciliation. Confidence: high.
4. `Individual ULB -> Cost Center ULB -> Universal ULB` precedence is not
   computed or tested by the repository. Use `Determine and test applicable
   scope and precedence`. Confidence: high.
5. `Cost center assignment -> cost-center overage budget; otherwise
   organization budget` is not derived by the service. It only reads budget and
   cost-center lists and resource arrays. Use `Candidate assignment and funding
   mapping; verify provider routing`. Confidence: high.
6. `Cost Center Overage Budget` conflates a cost-center financial routing
   concept with Classes 4 through 6, which are catalogued as per-user ULB
   overrides. Use the precise profile type and keep chargeback routing separate.
   Confidence: high.
7. `Enterprise spending budget` as an always-last universal backstop assumes
   ordering and overlap behavior not validated by the application. Use
   `Proposed aggregate guardrail; validate overlap and precedence`.
   Confidence: high.
8. `Stop Usage Setting? -> Blocked or Continue Billing` turns a retrieved flag
   or catalog example into a guarantee. Use `Limit response according to tested
   provider behavior; incident, exception, or rollback`. Confidence: high.
9. The 3D and fallback visualizer sets `overageActive` when projected overage is
   greater than zero and labels that state `STOP: Usage Halted`. Overage
   projection does not prove a configured or enforced stop. Use
   `Projected overage exposure` without a stop outcome. Confidence: high.
10. The simulator documentation implies cost-center overrides shape the
    governance burn curve, but the calculation uses one Universal ULB ceiling
    multiplied by total users and ignores population allocation and the higher
    cohort limits. Do not draw allocation-driven burn paths. Confidence: high.

## Evidence locations

* docs/implementation-guide-internal.md, Data and action boundaries,
  Three-tier budget hierarchy, Advisory assignment rules, Gated implementation
  procedure, Monitoring and response controls, Data quality and reconciliation,
  and Exceptions, change control, and rollback
* docs/implementation-guide-external.md, Evidence foundations, Configurable
  governance model, Lifecycle phases, Monitoring and response, Reconciliation
  and data quality, and Exceptions, change control, and rollback
* server/src/routes/assessment.ts, getIncludedCreditsPerLicense, runAssessment,
  dailyTrend, includedCreditPools, governanceDataWarnings, and read-only job
  routes
* server/src/services/githubBillingService.ts, authenticatedGet,
  getCostCenters, and getExistingBudgets
* client/src/engine/creditCalculationEngine.ts, calculateIncludedPool,
  generateBurnDownSeries, runSimulation, generateRecommendations, and
  calculateGovernanceReadinessScore
* client/src/App.tsx, NAV_ITEMS, WorkflowGate, access, and Routes
* client/src/store/appStore.ts, confirmSimulation, markDashboardReviewed, and
  markRecommendationsReviewed
* server/src/services/reportGenerationService.ts, standard license rate table
  and report sections
* client/src/components/assessment/AssessmentResults.tsx,
  governancePolicies and AICConsumptionFlow
* client/src/components/visualization/AICFlowVisualizer.tsx, Fallback2DFlow and
  overageActive

## Counts and completion signals

* Internal diagram requirement groups: 17
* Internal prohibited concept groups: 7
* External diagram requirement groups: 14
* External prohibited concept groups: 6
* Tempting or inaccurate reference-flow findings: 10
* Additional source-code pass: not required for the requested repository
  accuracy determination
* Blocker: the supplied reference image was not available as a separate file or
  prompt attachment, so image-only labels could not be compared
* Continuation signal: stop; continue only if the source image, target Mermaid
  files, or current provider documentation must be reviewed

## Recommended next research

* [ ] Compare the final rendered diagrams against this matrix
* [ ] Validate provider capability, scope, precedence, alerting, and enforcement
  against current authoritative provider documentation and controlled tests
* [ ] Review the supplied reference image if it becomes available as an
  accessible attachment or workspace file

## Clarifying questions

No clarification is needed to specify the required diagrams. The source image
is needed only for a pixel-for-pixel or label-for-label comparison.
