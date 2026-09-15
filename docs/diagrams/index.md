---
title: Onboarding and Implementation Diagram Index
description: PNG and Mermaid onboarding diagrams plus SVG workflows for the implementation guides
---

## Onboarding Diagrams

| Diagram | PNG preview | Editable source |
| ------- | ----------- | --------------- |
| Optional local testing or direct Azure deployment | [Onboarding PNG](../images/onboarding-flowchart.png) | [Mermaid source](onboarding-flowchart.mmd) |
| Local services and persistence boundaries | [Architecture PNG](../images/local-architecture.png) | [Mermaid source](architecture-flowchart.mmd) |

The PNGs were exported with Mermaid 11.12.0, SVG text labels
(`htmlLabels: false`), a white background, and 2x scale. When updating them,
validate the Mermaid source and export the entire SVG view box, not only the
visible browser viewport. Check the final PNG for clipping and readable labels.

For the executable setup steps, use the [repository README](../../README.md).

## Implementation guide diagrams

The implementation guides reference stable diagram IDs from this index. Only
the SVG assets are maintained for these two diagrams.

### IG-INT-01

Application architecture and workflow from validated evidence through
calculations, advisory profiles, owner approval, manual provider configuration,
monitoring, and rollback.

* [Open the internal workflow SVG](implementation-guide-internal.svg)
* [Read the internal implementation guide](../implementation-guide-internal.md)

### IG-EXT-01

Provider-neutral governance architecture and workflow from owned evidence
through configurable controls, approval, pilot, rollout, monitoring, and
rollback.

* [Open the external workflow SVG](implementation-guide-external.svg)
* [Read the external implementation guide](../implementation-guide-external.md)
