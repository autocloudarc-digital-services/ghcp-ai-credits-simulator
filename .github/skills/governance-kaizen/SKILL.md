---
name: governance-kaizen
description: "Use for loop engineering, kaizen iterations, PDF reference alignment, and evidence-led Active Register improvements without changing the existing application layout."
---

# Governance Kaizen

## Inputs

Read the [reference contract](../../../docs/active-register.md),
[requirement ledger](../../../docs/active-register-requirements.json), and
[iteration log](../../../docs/active-register-iterations.md).
The attached 44-page implementation guide is authoritative for detailed schema;
the 15-slide overview is supporting context. Record inaccessible sources as blocked.

## Loop

1. Freeze the requirement IDs and denominator before editing. Score only verified requirements; blocked and partial items score zero.
2. Select one unmet requirement or related local group. State a falsifiable hypothesis and the cheapest check. Inspect only its controlling code and neighboring contract.
3. Make the smallest reversible change, preserving existing behavior. Immediately run that focused check before expanding scope.
4. Repair local failures and rerun the same check. Stop after three failed repairs, on a security boundary, or when user input is indispensable.
5. Record iteration, hypothesis, change, commands, results, residual risk, and evidence references in the iteration log. Update the ledger without shrinking the denominator.
6. Recompute `100 * verified / total`. Stop at 90% with no failed safety gate, or at 10 completed iterations, whichever comes first. At the cap, report remaining gaps; do not fabricate completion or continue indefinitely.

## Safety Gates

* Authorization, CSRF, persistent storage, unknown-value preservation, and regression checks must pass before claiming readiness.
* No production provider control changes, synthetic approvals, broad tool hooks, public ports, secrets in output, or destructive volume operations.
* Browser fixtures prove rendering only. API reads prove retrieval only. Neither proves P-01 through P-05 provider enforcement or production approval.
* Keep lifecycle phases Prepare, Baseline, Design, Approve, Pilot, Rollout, Operate. Monitor & Respond and Review Decision are overlays, not extra phases.

## Closeout

Run `npm run register:check` and required builds/tests. Return the measured score,
completed iterations, source limitations, database/backup instructions, and residual gaps.