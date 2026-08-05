---
title: GitHub Governance Naming Standards
description: Naming convention rules and machine-readable catalogs for GitHub governance resources
author: autocloudarc-digital-services
ms.date: 2026-08-05
ms.topic: reference
keywords:
  - github governance
  - naming standards
  - resource provisioning
  - cost centers
  - budgets
estimated_reading_time: 8
---

## Purpose

These standards define predictable names for GitHub governance resources that
may be assessed, imported, or provisioned by the simulator. They provide a
human-readable reference and structured inputs for future validation,
generation, drift detection, and provisioning workflows.

The CSV files are the machine-readable catalogs. This guide defines how to
interpret and maintain them.

> [!IMPORTANT]
> Treat the examples and controlled values as a baseline. Confirm GitHub API
> constraints, enterprise policy, identity-provider ownership, and naming
> availability before provisioning production resources.

## Artifact Set

| Artifact                 | Purpose                                                                    | Primary editor              |
|--------------------------|----------------------------------------------------------------------------|-----------------------------|
| `README.md`              | Defines governance, conventions, validation, and maintenance instructions  | Platform governance team    |
| `naming-conventions.csv` | Stores one summary rule for each entity and its provisioning capability    | Governance or platform team |
| `naming-segments.csv`    | Stores ordered literals, variables, sources, and validation for every rule | Automation maintainers      |
| `naming-values.csv`      | Stores approved values that customers can extend for their environment     | Customer governance owner   |

The rule catalog is optimized for review and spreadsheet import. The segment
and value catalogs are normalized so automation does not need to parse compound
cells or infer segment order.

## Convention Model

A generated name consists of ordered segments separated by the delimiter in
the rule catalog. A rule can contain the following semantic positions:

* `prefix`: A fixed leading identifier for the entity type
* `infix`: A fixed or controlled qualifier between the prefix and primary segment
* `segment`: A variable business or ownership value
* `suffix`: A trailing classifier such as environment, period, or region

Not every rule requires all four positions. The ordered records in
`naming-segments.csv` are authoritative when the summary columns do not fully
describe a rule.

For example, the cost-center rule uses this pattern:

```text
cc-ghcp-{business-unit}-{environment}
```

The generated name `cc-ghcp-platform-prod` contains:

* Prefix: `cc`
* Infix: `ghcp`
* Segment: `platform`
* Suffix: `prod`

## Baseline Entity Rules

| Entity       | Pattern                                      | Example                       | Provisioning posture                    |
|--------------|----------------------------------------------|-------------------------------|-----------------------------------------|
| Cost center  | `cc-ghcp-{business-unit}-{environment}`      | `cc-ghcp-platform-prod`       | Provision after validation              |
| Budget       | `bgt-aic-{scope}-{period}`                   | `bgt-aic-enterprise-monthly`  | Provision after validation and approval |
| Organization | `org-ghcp-{business-unit}`                   | `org-ghcp-platform`           | Require enterprise approval             |
| Team         | `team-{function}-{business-unit}-{region}`   | `team-eng-platform-emea`      | Provision within an organization        |
| User         | `{identity-name}`                            | `jdoe`                        | Identity-provider managed               |

The `user` rule is advisory. Standard GitHub organizations invite existing
accounts, while Enterprise Managed Users are normally provisioned and named by
an identity provider through SCIM. The simulator must not assume that it can
create or rename GitHub users.

## Rule Catalog Fields

The required convention columns are `entity`, `pattern`, `example`, `segment`,
`prefix`, `infix`, `suffix`, and `description`. The catalog adds operational
fields needed by automation.

| Field                  | Meaning                                                               |
|------------------------|-----------------------------------------------------------------------|
| `rule_id`              | Stable key shared by all naming artifacts                             |
| `entity`               | Resource type governed by the rule                                    |
| `pattern`              | Ordered literal and token expression                                  |
| `example`              | Valid representative output                                           |
| `segment`              | Primary variable token or tokens                                      |
| `prefix`               | Fixed leading literal, when applicable                                |
| `infix`                | Fixed or controlled internal qualifier, when applicable               |
| `suffix`               | Trailing classifier, when applicable                                  |
| `separator`            | Character placed between generated segments                           |
| `case`                 | Required character casing                                             |
| `max_length`           | Maximum generated-name length                                         |
| `uniqueness_scope`     | Boundary within which a name must be unique                           |
| `provisioning_mode`    | Provisioning behavior for the entity                                  |
| `requires_approval`    | Whether provisioning requires an explicit approval                    |
| `description`          | Business purpose and usage guidance                                   |

Blank `prefix`, `infix`, or `suffix` cells mean that the position does not
apply. They do not mean that automation should invent a value.

## Naming Rules

Apply these rules before a name is accepted or submitted to a provider:

1. Convert customer-entered values to lowercase.
2. Trim leading and trailing whitespace.
3. Replace whitespace and underscores with the configured separator.
4. Remove characters that are not permitted by the segment validation pattern.
5. Collapse consecutive separators into one separator.
6. Remove leading or trailing separators.
7. Validate every segment against its allowed values and regular expression.
8. Validate the complete generated name against `full_validation_pattern`.
9. Reject names that exceed `max_length`; do not silently truncate identifiers.
10. Confirm uniqueness within `uniqueness_scope` before provisioning.

> [!CAUTION]
> Normalization must never change an existing provider identifier without an
> explicit migration plan. Report noncompliant existing resources as drift and
> recommend a replacement or approved exception.

## Provisioning Modes

Use the following controlled values in `naming-conventions.csv`:

| Mode               | Automation behavior                                                    |
|--------------------|------------------------------------------------------------------------|
| `provision`        | Validate and create through the supported provider API                 |
| `approval-required`| Validate, generate a proposal, and wait for approval before creation   |
| `provider-managed` | Validate or report the name, but delegate creation to another provider |
| `reference-only`   | Display the convention without offering automated creation             |

Provider capability must be checked at execution time. A naming rule does not
guarantee that the current token, API version, enterprise plan, or identity
model supports creation.

## Customer Customization

Customers should normally customize controlled values rather than rewrite
patterns. Use this workflow:

1. Copy the baseline artifacts into customer-controlled configuration.
2. Add business units, functions, regions, and environments to
   `naming-values.csv`.
3. Mark replaced values as `deprecated` instead of deleting values already in use.
4. Add a new rule identifier when a pattern changes incompatibly.
5. Validate the CSV files before publishing the new standard.
6. Review generated examples and collisions with existing GitHub resources.
7. Record approval before activating rules with `requires_approval` set to `true`.

Do not place secrets, user email addresses, access tokens, or customer-sensitive
identifiers in these catalogs.

## Validation and Automation

A future naming service should load the CSV files in this order:

1. Load active values from `naming-values.csv` into catalogs keyed by
   `catalog_name`.
2. Load and order segment records from `naming-segments.csv` by `rule_id` and
   `position`.
3. Load each rule from `naming-conventions.csv` and resolve its segment records.
4. Validate required inputs and catalog references.
5. Normalize each variable input according to the rule.
6. Join the ordered segment values with `separator`.
7. Validate length, full pattern, reserved values, and uniqueness.
8. Return a preview and validation result before any provisioning operation.

Importers must reject duplicate `rule_id` values, duplicate segment positions
within a rule, unknown catalog references, malformed regular expressions, and
examples that do not satisfy their declared rule.

## Change Governance

Assign one owner for the standard and require review from the team that owns
provisioning. Changes should preserve these invariants:

* Rule identifiers remain stable for compatible edits
* Existing active values are not silently redefined
* Examples continue to pass validation
* Provider-managed entities are not changed to provisionable without capability review
* Existing resource drift is reported rather than automatically renamed

Version customer policy bundles and retain the version used for each provisioned
resource. This enables audit history and deterministic regeneration.
