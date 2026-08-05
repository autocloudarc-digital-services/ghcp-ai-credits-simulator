---
title: Documentation Style Scan
description: Findings from the writing style and Markdown convention scan
ms.date: 2026-08-05
ms.topic: reference
---

## Research Scope

* Review all requested documentation and root community files for divergences from the writing style and Markdown instructions
* Emphasize findings in `docs/implementation-guide.md`
* Report paths, line numbers, issue types, current content, suggested fixes, severity totals, continuation signal, and blockers

## Governing Conventions

The scan applied the following instruction sources:

* `vscode-local:/c%3A/Users/prestopa/.vscode/extensions/ise-hve-essentials.hve-core-all-3.2.2/.github/instructions/hve-core/writing-style.instructions.md`
* `vscode-local:/c%3A/Users/prestopa/.vscode/extensions/ise-hve-essentials.hve-core-all-3.2.2/.github/instructions/hve-core/markdown.instructions.md`

The active rewrite prompt in
`.github/prompts/update-implementation-guide.prompt.md` was read only to
prioritize findings. It asks for a prescriptive, intuitive, structured,
comprehensive, and clear customer guide for enterprise budget profiles.

## Scoped Files

The scan covered every existing file matched by the requested scope:

* `docs/implementation-guide.md`
* `docs/naming-standards/naming-standards.md`
* `README.md`
* `LICENSE`

No `scripts/**/*.md` files exist. `CONTRIBUTING.md`, `CHANGELOG.md`,
`CODE_OF_CONDUCT.md`, `GOVERNANCE.md`, `SECURITY.md`, and `SUPPORT.md` do not
exist. Excluded customization and tracking paths were not scanned.

## Findings

### Implementation Guide Findings

#### DOC-001 Required Frontmatter Is Missing

Severity: Error

Path and line: `docs/implementation-guide.md`, line 1

Issue type: Required metadata and title structure

Current content: The file begins with `# Implementation Guide` and has no YAML
frontmatter.

Suggested fix: Add frontmatter with at least `title` and `description` as the
first content. Because `title` then supplies the document title, remove the H1
and begin body content at H2.

#### DOC-002 The Introduction Is Self-Referential

Severity: Warning

Path and line: `docs/implementation-guide.md`, line 3

Issue type: Self-referential writing

Current content: `This implementation guide aims to operationalize the
budgeting and management of AI credits within an enterprise.`

Suggested fix: Lead with customer context and outcome, such as `Enterprise
administrators can use this process to define, apply, monitor, and revise AI
credit budgets across enterprise, organization, cost-center, and user scopes.`

#### DOC-003 The Body Is an Outline Instead of an Actionable Guide

Severity: Warning

Path and lines: `docs/implementation-guide.md`, lines 5-163

Issue type: Instructional structure, specificity, and completeness

Current content: Most sections contain one sentence that restates the heading,
such as `Retrieve the current AI included credits for the enterprise.` and `Set
the enterprise spending budget for AI credits.`

Suggested fix: Give each phase a purpose, owner, prerequisites, required inputs,
ordered actions, expected output, validation criteria, failure handling, and a
clear handoff to the next phase. Add examples for enterprise, organization,
cost-center, universal user, and overage budget profiles. This finding is the
main divergence from the active rewrite request.

#### DOC-004 Compound Modifiers Are Inconsistent

Severity: Warning

Path and lines: `docs/implementation-guide.md`, lines 13, 15, 19, 37, 39, 41,
43, 99, 103, 117, 119, and 155

Issue type: Grammar and terminology consistency

Current content: `User Level Budget`, `user level budget`, `Organization based`,
`organization based`, `enterprise level budgets`, and `SKU based`.

Suggested fix: Use consistent compounds where they modify nouns: `User-Level
Budget`, `user-level budget`, `organization-based`, `enterprise-level budgets`,
and `SKU-based`. Rename `Enterprise Level` to a precise noun phrase such as
`Enterprise-Level Budget` if that section defines a budget rather than a scope.

#### DOC-005 Backward References Are Vague

Severity: Warning

Path and lines: `docs/implementation-guide.md`, lines 27, 35, 43, and 99

Issue type: Clarity and navigation

Current content: `according to the standards established above` and `based on
the previously established teams, cost centers, and organizational structures
and configurations`.

Suggested fix: Name and link the controlling section or artifact, then state the
specific inputs and validation criteria that carry forward.

#### DOC-006 Filler Weakens Three Instructions

Severity: Suggestion

Path and lines: `docs/implementation-guide.md`, lines 23, 31, and 39

Issue type: Conciseness

Current content: `in order to ensure consistency and clarity`.

Suggested fix: Replace `in order to` with `to` and define the measurable naming
outcome instead of relying on the generic phrase `consistency and clarity`.

#### DOC-007 Monitoring Outcomes Are Repetitive and Non-Specific

Severity: Warning

Path and lines: `docs/implementation-guide.md`, lines 131, 135, 139, and 143

Issue type: Actionability and precise vocabulary

Current content: Four sections repeat `trends, adoption, and potential areas for
optimization`.

Suggested fix: Define the metric, cadence, comparison period, threshold, owner,
and resulting action for weekly monitoring, monthly monitoring, and monthly
credit analysis. Remove `potential areas` and name the decisions the evidence
must support.

#### DOC-008 One Heading Uses Inconsistent Capitalization

Severity: Suggestion

Path and line: `docs/implementation-guide.md`, line 17

Issue type: Heading consistency

Current content: `## 4. Create a taxonomy for ULBs`

Suggested fix: Match the surrounding title case: `## 4. Create a Taxonomy for
ULBs`.

#### DOC-009 The Final Instruction Is Redundant

Severity: Suggestion

Path and line: `docs/implementation-guide.md`, line 163

Issue type: Conciseness and concrete instruction

Current content: `Loop continuously to review and iterate ... to drive ongoing
improvement and optimization.`

Suggested fix: State a defined review cadence, accountable owner, decision
inputs, and required versioned outputs. Remove overlapping terms such as
`continuously`, `iterate`, `ongoing improvement`, and `optimization`.

#### DOC-010 Desired-State Language Repeats Without a Definition

Severity: Suggestion

Path and lines: `docs/implementation-guide.md`, lines 57-95

Issue type: Repetitive vocabulary and missing definition

Current content: `desired state` appears throughout the policy profile section,
but the guide does not define the schema, fields, or acceptance criteria for a
desired-state profile.

Suggested fix: Define the desired-state profile once, including naming,
settings, scope, owner, and validation fields. Use the child sections for
enterprise-specific and organization-specific values instead of repeating the
same phrase.

### README Findings

#### DOC-011 Table Pipes Are Not Vertically Aligned

Severity: Error

Path and lines: `README.md`, lines 48-55, 106-114, 120-131, 138-146, 192-195,
276-280, 295-301, 341-344, 357-362, 377-384, 463-467, 637-646, 686-698, and
750-760

Issue type: Markdown table alignment

Current content: All 14 tables use compact rows such as `| Area | Capability |`
and `| --- | --- |`, so corresponding pipe characters do not align vertically.

Suggested fix: Pad every cell and delimiter row in each table so all pipe
characters occupy the same columns. Keep leading and trailing pipes.

#### DOC-012 Troubleshooting Bullets Need Sentence Punctuation

Severity: Warning

Path and lines: `README.md`, lines 438-455

Issue type: Bullet punctuation

Current content: Detailed troubleshooting items contain imperative or complete
clauses, such as `verify that ...`, `do not refresh ...`, and `use the enterprise
account slug ...`, but none ends with a period.

Suggested fix: Treat the detailed items as complete instructions and end each
item with a period. Preserve the existing colon-led symptom and resolution
format.

#### DOC-013 Current-Limitation Bullets Need Periods

Severity: Warning

Path and lines: `README.md`, lines 790-798

Issue type: Bullet punctuation

Current content: Complete sentences such as `Express uses its default in-memory
session store` do not end with periods.

Suggested fix: Add periods to all six complete-sentence bullets.

#### DOC-014 Opening Prose Is Not Wrapped Consistently

Severity: Suggestion

Path and lines: `README.md`, lines 20-21 and 34

Issue type: Readable line wrapping

Current content: The line beginning `It is focused on managing GitHub Copilot AI
Credits` is 231 characters, while most later prose is wrapped near 80
characters.

Suggested fix: Wrap the opening paragraphs consistently with the rest of the
file without breaking links, URLs, or code spans.

### Naming Standards Findings

#### DOC-015 The Purpose Uses Self-Referential Wording

Severity: Warning

Path and lines: `docs/naming-standards/naming-standards.md`, lines 23-25

Issue type: Self-referential writing

Current content: `This guide defines how to interpret and maintain them.`

Suggested fix: State the action directly, such as `Use the following rules to
interpret and maintain the machine-readable catalogs.`

#### DOC-016 One Table Cell Lacks Required Padding

Severity: Error

Path and line: `docs/naming-standards/naming-standards.md`, line 140

Issue type: Markdown table spacing

Current content: `| \`approval-required\`| Validate, generate a proposal, and
wait for approval before creation   |`

Suggested fix: Add a space before the second pipe: `| \`approval-required\` |
Validate, generate a proposal, and wait for approval before creation   |`.

#### DOC-017 Governance Bullets Need Periods

Severity: Warning

Path and lines: `docs/naming-standards/naming-standards.md`, lines 189-193

Issue type: Bullet punctuation

Current content: The five invariant bullets are complete sentences, including
`Rule identifiers remain stable for compatible edits`, but do not end with
periods.

Suggested fix: Add periods to all five bullets.

#### DOC-018 The Artifact Name Does Not Match the Existing File

Severity: Warning

Path and line: `docs/naming-standards/naming-standards.md`, line 35

Issue type: Precise naming and internal reference accuracy

Current content: The artifact table names `README.md`, but the documentation
artifact in that directory is `naming-standards.md`.

Suggested fix: Change the artifact cell to `naming-standards.md`, or add the
intended `README.md` and clarify the role of each file.

### Files Without Findings

`LICENSE` is standard legal text rather than Markdown. No writing-style defect
was recorded because editorial changes could alter the canonical license text.

## Summary

Status: Complete

Total grouped issues: 18

Severity totals:

* Errors: 3
* Warnings: 10
* Suggestions: 5

The 18 grouped issues include every repeated occurrence. For example, the
single README table-alignment issue records all 14 affected table blocks rather
than inflating the total by counting each block as a separate issue.

Completed checks:

* Inventoried every requested scope pattern and confirmed absent optional files
* Read every existing scoped file in full
* Checked required frontmatter, title hierarchy, heading levels, heading spacing, and heading punctuation
* Checked lists, bullet punctuation, table structure and alignment, code fence languages, blank-line boundaries, tabs, trailing spaces, consecutive blank lines, and final newlines
* Checked em dashes, prohibited filler, bolded-prefix list items, self-referential wording, terminology consistency, and repeated vague language
* Checked local links and image destinations; all existing local targets resolve
* Confirmed URLs are represented as links, autolinks, code spans, or code-block content

New findings most relevant to continuation:

* The implementation guide needs a structural rewrite, not a sentence-level polish
* Adding required title frontmatter requires removing the current H1
* The rewrite should define budget-profile inputs, owners, actions, outputs, validation, exceptions, monitoring thresholds, and revision cadence
* The README has a repository-wide table-formatting pattern that can be corrected mechanically

Additional passes needed: No

Confidence in completeness: High

Continuation signal: Ready for the documentation rewrite and targeted Markdown
cleanup. Start with `docs/implementation-guide.md`, then apply the mechanical
README and naming-standard fixes separately.

Blockers: None. The repository does not contain the validation scripts or
schemas referenced by the external Markdown instructions, so schema and
markdownlint checks were reproduced manually with read-only structural scans.

## Recommended Next Research

No additional research is required for the requested scope. Implementation may
need product-owner confirmation for budget-profile terminology, API-specific
procedures, approval roles, and quantitative monitoring thresholds.

## Clarifying Questions

The scan itself requires no clarification. Before rewriting the implementation
guide, confirm the authoritative customer workflow, supported GitHub billing
APIs, budget profile taxonomy, approval model, and target metrics if those
details are not already encoded elsewhere in the repository.
