---
title: GitHub Copilot AI Credits Simulator
description: Assess enterprise usage, model GitHub Copilot AI Credit consumption, and produce governance recommendations and reports
author: autocloudarc-digital-services
ms.date: 2026-09-15
ms.topic: overview
keywords:
  - github copilot
  - ai credits
  - usage-based billing
  - governance
  - react
  - express
  - azure
estimated_reading_time: 9
---

## Independent Analysis Disclaimer

This solution reflects independent analysis and opinions only. It does not
necessarily represent the views, positions, policies, or endorsements of the
author's employer, affiliated organizations, GitHub, Microsoft, or any service
provider.

The solution is based on official cloud-service and developer-platform
documentation available at publication, together with empirical examples from
the author's GitHub Enterprise Cloud development account. Capabilities,
pricing, policies, and availability may change. Verify current provider
information before making technical, operational, financial, legal, or
procurement decisions.

The solution is provided "as is," without warranties of accuracy,
merchantability, fitness for a particular purpose, non-infringement, or
availability. No liability, professional-services relationship, commitment,
endorsement, or guarantee is created, to the maximum extent permitted by law.

## Overview

The GitHub Copilot AI Credits Simulator is an assessment and planning
application for GitHub Enterprise customers managing AI Credit consumption
under usage-based billing.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-149ECA?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Azure](https://img.shields.io/badge/Azure-Container_Apps-0078D4?logo=microsoftazure)](https://azure.microsoft.com/products/container-apps)

The application combines live enterprise assessment, scenario modeling,
governance recommendations, interactive visualizations, and PDF reporting in a
React and Express workspace. A completed assessment establishes the context for
simulation and reporting, so downstream results remain tied to the selected
enterprise, license population, usage, budgets, and cost centers.

![Contributor onboarding and architecture map](docs/images/contributor-onboarding-architecture.svg)

## Solution Use Notice

This repository supports planning, demonstration, and controlled evaluation.
It is not a substitute for current provider documentation, validated billing
data, security review, privacy review, legal advice, or procurement approval.

Do not use results as a guarantee of future consumption or cost. Validate API
behavior, pricing, calculations, governance controls, identity boundaries, and
operational requirements before using the solution with production data.

Never place real enterprise credentials in an untrusted fork, source file,
issue, pull request, chat transcript, or shared development environment. This
notice complements, and does not replace, the warranty and liability terms in
the [MIT License](LICENSE).

## Capabilities

| Area | Capability |
| ---- | ---------- |
| Assessment | Retrieves authenticated GitHub billing, budget, cost-center, organization, team, and license data available to the connected identity |
| Simulator | Models license pools, user populations, AI Credit burn rates, exhaustion points, and what-if scenarios |
| Governance insights | Summarizes projected credit posture, overage exposure, population, and governance readiness |
| Visualization | Presents AI Credit flow through charts, a 3D React Three Fiber scene, and a 2D fallback |
| Recommendations | Produces governance actions from assessed and simulated conditions |
| Reporting | Previews and generates a downloadable executive PDF report |
| Active Register | Persists governed records, revisions, evidence, decisions, and role-scoped access |

## Architecture

The repository is an npm workspace with separate client, server, and shared
packages. The Vite development server proxies `/auth` and `/api` requests to
Express. PostgreSQL stores sessions, assessments, workflows, allocation plans,
reports, and Active Register history.

| Layer | Technologies |
| ----- | ------------ |
| Client | React 18, TypeScript, Vite, React Router, Tailwind CSS |
| State and validation | Zustand, React Hook Form, Zod |
| Visualization | Recharts, React Three Fiber, Drei, Three.js, Framer Motion |
| Server | Node.js, Express, TypeScript |
| Integration | Axios, GitHub OAuth, GitHub billing APIs |
| Persistence | PostgreSQL 17 and PostgREST |
| Reporting | React PDF Renderer |
| Security | Microsoft Entra admission, GitHub OAuth, CSRF protection, rate limiting, encrypted tokens, and managed identities |
| Azure runtime | Container Apps, Container Registry, Key Vault, Log Analytics, and private networking |

The production topology is defined in Bicep under `infra/`. The protected
GitHub Actions workflow validates the release, authenticates to Azure with
OpenID Connect, performs subscription preflight and what-if, deploys the
foundation, runs migrations, verifies internal admission, and then enables
public ingress.

## Prerequisites

### Required Tools

| Tool or access | Purpose |
| -------------- | ------- |
| GitHub account | Clone the repository and authorize the application |
| Git | Manage branches and changes |
| Node.js 20 or 22 LTS | Run the client and server toolchains |
| npm | Install and run workspace packages |
| Docker with Compose | Run local PostgreSQL and build production images |
| Modern browser | Use the React interface and WebGL visualization |
| VS Code | Use the configured development container and MCP integrations |
| GitHub OAuth application credentials | Authenticate assessment users |
| GitHub Enterprise access | Read the enterprise data allowed to the connected identity |
| Azure subscription | Use the protected production deployment path |

### Permissions

The connected GitHub user must hold the roles required by each billing or
governance endpoint. GitHub App permissions do not expand the user's existing
enterprise or organization authority.

Production deployment also requires a protected GitHub environment, an Azure
OIDC service principal, least-privilege Azure RBAC, and a Microsoft Entra
admission application. See the [Azure deployment guide](docs/azure-deployment.md)
for the complete trust and configuration model.

## Choose Your Development Path

| Path | Typical setup | Best for |
| ---- | ------------- | -------- |
| GitHub Codespaces | 5-10 minutes | A repository-managed Node.js, Docker, Azure CLI, and VS Code environment |
| Local VS Code | 10-20 minutes | Developers with Node.js, npm, Git, Docker, and VS Code installed |
| Production deployment | Environment-specific | Reviewed releases through the protected GitHub Actions workflow |

### GitHub Codespaces

1. Open the repository in a Codespace.
2. Wait for the Dev Container setup to finish.
3. Configure the four required Codespaces secrets described in
   [Runtime Configuration](#runtime-configuration).
4. Make forwarded port `5173` public so GitHub can reach the OAuth callback.
5. Start PostgreSQL and the application.

```bash
npm run register:db:up
npm run dev
```

The application is available from the forwarded port `5173` URL. The server
derives the Codespaces origin and callback URL from the Codespaces environment.

### Local VS Code

```bash
git clone https://github.com/autocloudarc-digital-services/ghcp-ai-credits-simulator.git
cd ghcp-ai-credits-simulator
npm clean-install
npm run register:db:up
```

Export your runtime values using
[Configure Runtime Values](docs/contributor-guide.md#configure-runtime-values),
then run `npm run dev` in the same terminal. The server does not automatically
load `.env` files; copying [.env.example](.env.example) is not sufficient.

Open <http://localhost:5173>. Configure the GitHub App callback as
`http://localhost:5173/auth/github/callback`.

## Runtime Configuration

Create a single-tenant GitHub App for user authorization, disable webhooks, and
grant only the permissions required by the assessment endpoints. Install the
app for the organization or account being assessed.

| Runtime value | Codespaces name | Local or production name |
| ------------- | --------------- | ------------------------ |
| GitHub App client ID | `GHCP_APP_CLIENT_ID` | `GITHUB_APP_CLIENT_ID` |
| GitHub App client secret | `GHCP_APP_CLIENT_SECRET` | `GITHUB_APP_CLIENT_SECRET` |
| Enterprise billing token | `GHCP_ENTERPRISE_BILLING_TOKEN` | `GHCP_ENTERPRISE_BILLING_TOKEN` |
| Session secret | `GHCP_SESSION_SECRET` | `SESSION_SECRET` |

The enterprise billing token is a classic personal access token used only for
the fixed enterprise billing endpoint families implemented by the server. Give
it the minimum scopes and expiration required for the target account.

Generate a persistent session secret on a trusted machine:

```bash
openssl rand -hex 32
```

GitHub Actions secrets are not automatically available in Codespaces. Store
Codespaces values under **Repository Settings > Secrets and variables >
Codespaces**, then restart the Codespace after changing them.

See [Contributor Guide](docs/contributor-guide.md) for local environment details
and [Configure Runtime Values](docs/contributor-guide.md#configure-runtime-values)
for the supported exports.

## Validate The Project

Run validation from the repository root:

```bash
npm clean-install
npm run build
npm run lint --workspace=client
npm run runtime:test
npm run register:test
```

Run persistence integration tests with PostgreSQL available:

```bash
npm run register:db:up
npm run persistence:test
```

Build the production application and migration images locally:

```bash
npm run container:build
```

## Production Deployment

Production deployment is available through the manually dispatched **Azure
production deployment** workflow. The workflow requires an approved release
commit, the protected `production` environment, a current monthly estimate, and
an exact acknowledgement of the approved public-retail ceiling.

> [!CAUTION]
> The workflow performs Azure what-if and then continues to provisioning in the
> same approved job. Review the commit, configuration, expected cost, and
> environment approval before selecting **Approve and deploy**.

The approved topology uses Azure Container Apps, PostgreSQL Flexible Server,
Container Registry, Key Vault, managed identities, private networking, and Log
Analytics. Deployment occurs in stages so authentication and internal ingress
are verified before public ingress is enabled.

Use the [Azure production deployment guide](docs/azure-deployment.md) for
identity setup, environment variables, secrets, cost controls, preflight gates,
deployment steps, and recovery guidance.

## Useful Commands

| Task | Command |
| ---- | ------- |
| Start client and server | `npm run dev` |
| Build all workspaces | `npm run build` |
| Lint the client | `npm run lint --workspace=client` |
| Run runtime tests | `npm run runtime:test` |
| Build production images | `npm run container:build` |
| Start local PostgreSQL | `npm run register:db:up` |
| Apply database migrations | `npm run register:db:migrate` |
| Check database status | `npm run register:db:status` |
| Test the Active Register | `npm run register:test` |
| Check the Active Register | `npm run register:check` |
| Back up PostgreSQL | `npm run register:db:backup` |
| Verify database recovery | `npm run register:db:verify-recovery` |
| Run persistence integration tests | `npm run persistence:test` |
| Check repository status | `git status --short --branch` |

## Project Layout

```text
ghcp-ai-credits-simulator/
  client/                         React and Vite application
    src/
      components/                 Assessment, dashboard, simulator, and report UI
      engine/                     AI Credit calculation engine
      pages/                      Application routes
      store/                      Zustand workflow state
  server/                         Express and TypeScript API
    src/
      middleware/                 Security and request middleware
      persistence/                PostgreSQL persistence services
      register/                   Active Register access and history
      routes/                     Authentication, assessment, and report routes
      services/                   GitHub integration and domain services
  shared/                         Shared contracts and governance data
  infra/                          Subscription and workload Bicep modules
  scripts/                        Runtime, persistence, and deployment checks
  docs/                           Architecture, governance, deployment, and operations
  .github/workflows/              Protected production deployment workflow
  compose.register.yaml           Local PostgreSQL and PostgREST services
  Dockerfile                      Application and migration image targets
```

## Key Documentation

* [Azure production deployment](docs/azure-deployment.md)
* [Contributor guide](docs/contributor-guide.md)
* [Active Register](docs/active-register.md)
* [Governance budget controls](docs/governance-budget-controls.md)
* [Internal implementation guide](docs/implementation-guide-internal.md)
* [External implementation guide](docs/implementation-guide-external.md)
* [Architecture diagrams](docs/diagrams/index.md)
* [Naming standards](docs/naming-standards/naming-standards.md)

## Current Limitations

* GitHub endpoint availability depends on the target enterprise plan, billing
  platform, token scopes, app permissions, and the connected user's roles.
* Provider APIs may return partial data or hide inaccessible resources with a
  `404` response.
* Simulations and recommendations are planning outputs, not provider forecasts,
  invoices, approvals, certifications, or policy enforcement results.
* The 3D visualization requires WebGL; the application provides a 2D fallback.
* Production deployment assumptions and public pricing require revalidation
  before each release.

## Troubleshooting

| Symptom | Check |
| ------- | ----- |
| OAuth returns to the wrong host or port | Match the GitHub App callback to `CALLBACK_URL` and the browser origin |
| GitHub rejects the client credentials | Confirm the client ID and secret belong to the same GitHub App |
| Assessment endpoints return `403` | Verify app installation, user role, app permission, and token scope |
| Enterprise endpoints return `404` | Verify the enterprise slug and whether the token can view the resource |
| Port `5173` returns an empty response in Codespaces | Confirm both development processes are running and the port is public |
| PostgreSQL-backed tests fail | Start Docker and run `npm run register:db:up` |
| The 3D view is unavailable | Enable WebGL or use the 2D fallback |

## Contributing

Focused contributions to calculations, accessibility, integrations,
documentation, governance controls, and deployment safety are welcome. Review
the [Contributor Guide](docs/contributor-guide.md) before opening a pull request.

Run the relevant build, lint, and test commands for code changes. For
Markdown-only changes, run `git diff --check` and a Markdown linter when one is
available.

## License

[MIT](LICENSE)
