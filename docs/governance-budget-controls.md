---
title: GitHub Budget Control Designations
description: Official GitHub budget scopes, precedence, and application mapping verified September 11, 2026.
---

## Verified Designations

GitHub documents six budget controls, not a numbered three-tier, four-tier, or
six-tier hierarchy. The application uses named controls and two families.
"Universal spending limit" means the enterprise budget only when enterprise
metered spending is intended; it is not GitHub's name for a universal ULB.

### User-Level Budgets

* Individual user-level budget (`individual-ulb`): overrides cost center and universal ULBs for one user. Optional expiration removes the override and restores the next applicable ULB.
* Cost center user-level budget (`cost-center-ulb`): one per-user amount for every current and future member of a cost center. Overrides the universal default, not an individual ULB.
* Universal user-level budget (`universal-ulb`): default for all Copilot-licensed users without a more specific ULB.

The applicable ULB is selected in this order: individual, cost center, universal.
It caps a user's total AI credit consumption across included and metered usage
in a billing cycle. ULBs always hard-stop and have no Stop usage toggle.
GitHub's budget configuration uses USD amounts; the app's modeled credit values
must be converted at $0.01 per AI credit, not copied as dollar amounts.
ULB alerts are not consistently available. Tenant configuration and reset
evidence still require verification in the Active Register.

### Metered Budgets

* Cost center budget (`cost-center-metered-budget`): aggregate metered charges attributed to a cost center, not a per-user limit and not an included pool cap.
* Organization budget (`organization-metered-budget`): metered charges attributed to the organization billing the Copilot license when no cost center applies. It can further restrict, not override, enterprise controls.
* Enterprise budget, also called enterprise spending limit (`enterprise-metered-budget`): enterprise metered boundary, not the total invoice and not a universal ULB. License fees are additional.

These are USD controls for the metered phase. Stop usage is off by default;
without it, passing the threshold does not cap charges. The AI credit paid usage
policy must also permit overage. Metered budget alerts support 75%, 90%, and 100%.

GitHub describes the request flow as applicable ULB, included pool, then cost
center, organization, or enterprise metered scope. It also documents overlapping
budget restrictions and lowest remaining headroom. Therefore, a narrower metered
budget must not be described as bypassing every broader budget. Cost center
charges count against the enterprise budget by default; an explicit cost center
exclusion removes those charges from that enterprise boundary, not from ULBs.

Multiple organizations licensing the same user can cause the billed organization
to change each billing cycle. GitHub recommends direct user assignment to cost
centers for more predictable attribution. Included usage controls are separate,
license-derived caps that can block or permit paid overage when reached.

## Application Mapping

* Class 1 is the included pool, not a configurable budget.
* Class 2 is the enterprise metered budget.
* Class 3 is the universal ULB.
* Classes 4-6 are cost center ULB cohort profiles, not cost center metered budgets or individual ULBs.
* Classes 7-10 are organization access-policy profiles, not organization metered budgets. Their included credit values are not metered budget amounts.
* Individual ULBs and cost center or organization metered budgets are documented controls without fabricated catalog amounts or provider IDs.

The [control definitions](../shared/governanceTiers.json) and
[scope classifier](../shared/governanceControls.js) drive current labels and new
reports. Historical numeric `tier` fields are accepted for compatibility but
ignored for classification. New recommendations omit them. Saved PDFs, source
snapshots, audit history, and showcase captures are not rewritten.

The simulator models aggregate usage cohorts. It does not resolve live individual
ULBs, licensing attribution, cost center exclusions, paid usage policy, or all
overlapping budgets. Software tests and this documentation review do not verify
provider enforcement or production approval.

## Official Sources

Checked September 11, 2026:

* [Budgets for usage-based billing](https://docs.github.com/en/copilot/concepts/billing/budgets-for-usage-based-billing): six controls, ULB precedence, expiration, request flow, hard stops, attribution, and exclusions
* [Setting up budgets](https://docs.github.com/en/billing/how-tos/set-up-budgets): budget type versus scope, overlapping budgets, Users scope, and alerts
* [Budgets and alerts](https://docs.github.com/en/billing/concepts/budgets-and-alerts): metered and license distinctions, scope, and ULB alert limitations
* [Optimizing your budget configuration](https://docs.github.com/en/copilot/tutorials/budgets/optimizing-your-budget-configuration): direct assignment, sizing, and organization licensing risks
* [Cost centers](https://docs.github.com/en/billing/concepts/cost-centers): attribution and separate included usage controls
