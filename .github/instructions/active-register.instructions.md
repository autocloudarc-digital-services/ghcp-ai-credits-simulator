---
description: "Preserve governance semantics, evidence, and access boundaries when changing the Active Register."
applyTo: "shared/activeRegister.ts,server/src/register/**,client/src/components/report/ActiveRegister.tsx,scripts/register-*.mjs"
---

# Active Register

* Follow the [reference contract](../../docs/active-register.md). Never infer provider enforcement from configured state.
* Keep the existing simulator, Reports artifacts, navigation, styling, and API contracts intact.
* Preserve unknowns as null. Team-derived directory coverage is not proof of a complete enterprise directory.
* Separate AI Credits from USD, included-usage controls from metered budgets, and forecasts from enforcement.
* Enforce lifecycle validation server-side. Never generate approvals, named owners, test passes, evidence, or provider identifiers.
* Authorize every register operation from a verified GitHub user ID and server-configured role. Never trust a client-supplied tenant or actor.
* Use parameterized SQL, optimistic revisions, append-only history, and atomic transactions. Never delete prior evidence to make validation pass.
* Run focused tests after each edit. Do not publish ports, run destructive volume commands, change GitHub controls, or commit without authorization.