---
title: GitHub Copilot AI Credits Simulator
description: Assess enterprise usage, simulate GitHub Copilot AI Credit consumption, and generate governance recommendations and reports
author: autocloudarc-digital-services
ms.date: 2026-08-02
ms.topic: overview
keywords:
  - github copilot
  - ai credits
  - usage-based billing
  - governance
  - react
  - express
  - codespaces
estimated_reading_time: 14
---

## Overview

The GitHub Copilot AI Credits Simulator is a self-service assessment and planning application for GitHub Enterprise customers.
It is focused on managing GitHub Copilot AI Credits under usage-based billing. It combines live enterprise assessment, scenario modeling, simulation, governance recommendations, and PDF reporting in one React and Express workspace.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-149ECA?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

The application follows one assessment-led workflow. Every user connects
through GitHub OAuth and completes a live enterprise assessment before the
simulator, governance insights, recommendations, or report become available.
Each operation unlocks the next step so downstream output always has the
required assessed and modeled context.

The resulting state drives tailored recommendations, a governance-readiness score, interactive charts, a 3D AI Credit flow visualization,
and an executive PDF report.

![Contributor onboarding and architecture map](docs/images/contributor-onboarding-architecture.svg)

> [!IMPORTANT]
> This repository is a planning and demonstration tool. Validate calculations,
> GitHub API behavior, security controls, privacy requirements, and governance
> recommendations before using the results for production financial decisions.
> Do not use real enterprise credentials in an untrusted fork or shared
> development environment.

## Application Capabilities

| Area | Capability |
| --- | --- |
| Assessment | Retrieves authenticated GitHub billing, budget, and cost-center data for an enterprise |
| Simulator | Models license pools, user populations, burn rates based on what-if scenarios |
| Governance Insights | Summarizes projected credit posture, overage, population, and governance readiness |
| Visualization | Shows AI Credit flow through an interactive React Three Fiber scene with a 2D fallback |
| Recommendations | Produces governance actions based on simulated and assessed conditions |
| Report | Previews and generates a downloadable PDF executive report |

## Architecture

The repository is an npm workspace with separate client, server, and shared
packages. The Vite development server proxies `/auth` and `/api` requests to
Express, so the browser uses one origin during local and Codespaces development.

```mermaid
flowchart LR
    User[Browser user]
    GitHub[GitHub OAuth and billing APIs]

    subgraph Client[React client on port 5173]
        Vite[Vite development server]
        Router[Assessment, Simulator, Governance Insights, Recommendations, Report]
        Store[Zustand application state]
        Engine[Credit calculation engine]
        Visuals[Recharts and React Three Fiber]
    end

    subgraph Server[Express server on port 3001]
        Security[CORS, sessions, CSRF, and rate limits]
        Auth[Authentication routes]
        Assessment[Assessment routes and jobs]
        Report[Report routes and PDF renderer]
        Memory[(In-memory sessions, jobs, and reports)]
    end

    Shared[Shared TypeScript contracts]

    User --> Vite
    Vite --> Router
    Router <--> Store
    Store --> Engine
    Engine --> Visuals
    Vite -- /auth and /api proxy --> Security
    Security --> Auth
    Security --> Assessment
    Security --> Report
    Auth <--> GitHub
    Assessment <--> GitHub
    Security <--> Memory
    Assessment <--> Memory
    Report <--> Memory
    Shared -. types .-> Client
    Shared -. types .-> Server
```

### Technology Stack

| Layer | Technologies |
| --- | --- |
| Client | React 18, TypeScript, Vite, React Router, Tailwind CSS |
| State and validation | Zustand, React Hook Form, Zod |
| Visualization | Recharts, React Three Fiber, Drei, Three.js, Framer Motion |
| Server | Node.js, Express, TypeScript |
| Integration | Axios, GitHub OAuth, GitHub billing APIs |
| Reporting | React PDF Renderer |
| Security | Express Session, Lusca CSRF protection, Express Rate Limit, AES-256-GCM token encryption |

## Prerequisites

### Required Tools

| Requirement | Purpose |
| --- | --- |
| GitHub account | Clone or fork the repository and create a Codespace |
| Git | Clone, branch, and preserve changes |
| Node.js 20 or 22 LTS | Run the client and server toolchains |
| npm | Install and run the workspace packages |
| Modern browser | Run the React UI and WebGL visualization |
| VS Code 1.101 or later | Load the configured MCP servers and extension providers |
| GitHub Copilot access | Use GitHub, Azure, and Fabric MCP tools in Copilot Chat agent mode |
| Azure account with an active subscription | Authenticate Azure MCP and access Azure resources |
| Microsoft Fabric access | Use live Fabric and OneLake operations when tenant access is required |

GitHub OAuth credentials are required because a completed live assessment is
the prerequisite for every downstream operation.

### Permissions and Access

| Activity | Requirement |
| --- | --- |
| Use GitHub Codespaces | Codespaces must be enabled for your account or organization |
| Create a fork | Permission to fork into a personal or approved organization account |
| Run a live assessment | GitHub OAuth credentials and access to the target enterprise data |
| Use the GitHub MCP server | GitHub account authorization and an organization policy that permits MCP |
| Use the Azure MCP server | Microsoft Entra authentication and least-privilege Azure RBAC assignments |
| Use live Fabric MCP operations | Fabric tenant access and permissions for the target workspace and items |
| Push changes | Write access to your fork or the source repository |

If organization policy restricts Codespaces, public forwarded ports, OAuth
applications, or third-party npm packages, confirm access with an administrator
before setup.

## GitHub MCP Server Setup

The Dev Container configures GitHub's official hosted MCP server at
`https://api.githubcopilot.com/mcp/`. The server gives Copilot Chat access to
GitHub repositories, issues, pull requests, and other capabilities allowed by
your GitHub account and organization policies.

Complete these steps after cloning the repository or opening a Codespace:

1. Use VS Code 1.101 or later and confirm that GitHub Copilot is available.
1. Create the Dev Container. For an existing container or Codespace, run
  **Dev Containers: Rebuild Container** from the Command Palette so VS Code
  applies the MCP configuration.
1. Open Copilot Chat and switch to agent mode.
1. Run **MCP: List Servers** from the Command Palette and select `github`.
1. Start the server, review its URL, and confirm that you trust the
  configuration.
1. Complete the GitHub OAuth prompt with the account whose repositories and
  organizations you need to access.
1. Open **Configure Tools** in Copilot Chat and enable the required `github`
  tools.
1. Verify the connection with a read-only request, such as listing open issues
  for this repository.

> [!IMPORTANT]
> GitHub MCP authentication is separate from the application's GitHub App and
> `GHCP_ENTERPRISE_BILLING_TOKEN`. Do not add a personal access token to
> `devcontainer.json`. The hosted server uses VS Code's OAuth flow and applies
> the signed-in account's permissions.

If the server does not appear, rebuild the container and run **MCP: List
Servers** again. If authentication or tools are blocked, confirm that your
organization enables MCP servers and that your GitHub account has access to the
requested resources.

## Azure and Fabric MCP Server Setup

The Dev Container installs Microsoft's official Azure MCP Server and Microsoft
Fabric MCP Server extensions:

| Server | VS Code extension | Configuration model |
| --- | --- | --- |
| Azure MCP Server | `ms-azuretools.vscode-azure-mcp-server` | Extension-managed local MCP server with Microsoft Entra authentication |
| Microsoft Fabric MCP Server | `fabric.vscode-fabric-mcp-server` | Extension-managed local MCP server with Fabric settings and automatic updates |

Extensions are used for Azure and Fabric because Microsoft recommends their VS
Code extensions and distributes server updates and settings through them. The
GitHub MCP server remains in `customizations.vscode.mcp` because GitHub provides
an official hosted OAuth endpoint rather than a companion VS Code extension.

Complete these steps after creating or rebuilding the Dev Container:

1. Open the Extensions view and confirm that **Azure MCP Server** and
  **Microsoft Fabric MCP Server** are installed in the Dev Container.
1. For Azure access, run **Azure: Sign In** from the Command Palette. You can
  alternatively run `az login` if the Azure CLI is installed.
1. Run **MCP: List Servers**, select **Azure MCP Server ext**, and start the
  server.
1. Verify Azure access with a read-only prompt such as `List my Azure resource
  groups`.
1. Run **MCP: List Servers**, select **Fabric MCP Server**, and start the
  server.
1. Verify the Fabric server with a context-only prompt such as `What Fabric
  workload types are available?`.
1. Before using live OneLake or Fabric operations, sign in with the required
  Microsoft Entra account and confirm access to the target Fabric workspace,
  items, and capacity.

> [!CAUTION]
> Azure and Fabric MCP tools can expose write operations. Use least-privilege
> Azure RBAC and Fabric workspace roles, review each requested tool invocation,
> and test with read-only prompts before allowing changes. Do not store Azure or
> Fabric credentials in `devcontainer.json`.

VS Code 1.103 or later can automatically start extension-managed MCP servers.
Set `chat.mcp.autostart` to `newAndOutdated`, or start each server manually from
**MCP: List Servers**. If a server is missing after an extension update, rebuild
the Dev Container and check the MCP server output channel for startup errors.

## GitHub App Setup

Use this runbook to configure the GitHub App credentials required for the
Assessment and Report API flows.

### Step 1: Choose the callback URL pattern

Pick the callback URL based on where you run the app:

1. Local development: `http://localhost:5173/auth/github/callback`
2. Codespaces: run this command in the Codespace and use its output:

```bash
printf 'https://%s-5173.%s/auth/github/callback\n' \
  "${CODESPACE_NAME}" \
  "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
```

Use this exact local callback when running on your machine now:

* `http://localhost:5173/auth/github/callback`

For this project, use port `5173` for callbacks in development. The browser
origin is the Vite app, and Vite proxies `/auth` and `/api` to Express.

### Step 2: Create the GitHub App

1. Open GitHub.
1. Go to Settings.
1. Go to Developer settings.
1. Select GitHub Apps.
1. Select New GitHub App.
1. Set a unique app name.
1. Set Homepage URL to:

  `https://github.com/autocloudarc-digital-services/ghcp-ai-credits-simulator`

  If you are configuring this in your fork, use your fork URL instead.

1. Set Callback URL to the local value
  `http://localhost:5173/auth/github/callback` or the exact Codespaces value
  printed by the command in Step 1.
1. Disable webhooks for now because this app does not consume webhook events.
1. Configure these least-privilege app permissions:

| Permission category | Setting | Reason |
| --- | --- | --- |
| Repository permissions | No access | The backend does not call repository endpoints |
| Organization permissions | Administration: Read-only | Required for organization AI Credit usage and usage-summary endpoints |
| Account permissions | No access | The backend does not call user billing endpoints; Plan access is not required |

Leave every other repository, organization, and account permission set to No
access. The app only reads billing data and does not need write access.

1. Create the app.

### Step 3: Enable user authorization and install the app

1. Ensure user authorization is enabled for the app.
2. Install the app to the organization or account you will assess.
3. Grant access to the target organization and enterprise resources.
4. Authorize the app as a user who meets the role requirements for every API
  used by the assessment:

| Assessment data | Required role |
| --- | --- |
| Organization AI Credit usage and usage summary | Organization administrator |
| Enterprise budgets | Enterprise administrator or billing manager |
| Enterprise cost centers | Enterprise owner, billing manager, or organization owner |

For a complete assessment, use an enterprise owner or administrator who also
administers the target organization, or a billing manager who has the required
organization access. App permissions never grant access that the authorizing
user does not already have.

This backend requests OAuth scopes `read:enterprise,read:org` and calls
enterprise and organization billing endpoints. GitHub Apps use their
registered fine-grained permissions rather than OAuth App scopes, so these
legacy scope parameters do not replace the app permission and user-role
requirements above.

> [!NOTE]
> GitHub's GitHub App permission reference maps the organization billing
> endpoints to Organization Administration read-only access and supports user
> access tokens. It does not currently publish a separate GitHub App permission
> mapping for the enterprise budget and cost-center endpoints. GitHub's
> enhanced-billing automation guidance also documents personal access tokens
> (classic) and states that fine-grained personal access tokens are unsupported.
> Validate GitHub App user-token support against your target enterprise and API
> version. For a `403` response, inspect `X-Accepted-GitHub-Permissions` before
> granting any broader access.

### Step 4: Collect credentials

From the GitHub App settings:

1. Copy the Client ID.
2. Generate a new Client Secret.
3. Copy the Client Secret immediately because GitHub displays it only once.
4. Store both values in an approved secret manager or in GitHub Codespaces
  secrets. Never commit either value to the repository or place it in
  `.env.example`.

For Codespaces, do not use `GITHUB_APP_CLIENT_ID` or
`GITHUB_APP_CLIENT_SECRET` as stored secret names. GitHub reserves the
`GITHUB_` prefix and rejects Codespaces secrets that use it. Store the values
under these aliases. The server reads the aliases directly in Codespaces:

| GitHub App value | Codespaces secret name | Local and production variable |
| --- | --- | --- |
| Client ID | `GHCP_APP_CLIENT_ID` | `GITHUB_APP_CLIENT_ID` |
| Client Secret | `GHCP_APP_CLIENT_SECRET` | `GITHUB_APP_CLIENT_SECRET` |

Enterprise budgets and cost centers require a separate personal access token
(classic) with the `manage_billing:enterprise` scope. Create it as an
enterprise owner or billing manager, set an expiration, and store it as
`GHCP_ENTERPRISE_BILLING_TOKEN`. The server uses this token only for enterprise
budget and cost-center requests.

The credential can retain the broader scopes configured for planned features.
No additional environment variables are required because a PAT carries all of
its granted scopes in the same bearer credential. Each endpoint still enforces
the token owner's GitHub role in addition to the token scope.

| Configured capability | Current use | Planned endpoint family |
| --- | --- | --- |
| Copilot (`manage_billing:copilot`) | Reserved | Enterprise and organization Copilot seat and policy management |
| `manage_billing:enterprise` | Active | Enterprise budgets and cost centers |
| `read:org` | Reserved | Organization membership, teams, and read-only Copilot seat details |
| `user` | Reserved | Authenticated user profile, email, and follow data |

The current server sends this credential only to GitHub API URLs assembled from
fixed enterprise billing paths. Future features must add explicit endpoint
methods before they can exercise the reserved scopes. Copilot management
requests require the owner roles documented by each endpoint.

### Step 5: Set runtime environment variables

Use the following storage and runtime mapping. GitHub Actions secrets are not
automatically available in Codespaces, so create Codespaces secrets in the
location specified below.

| Runtime variable | Store in Codespaces as | How to provide it |
| --- | --- | --- |
| `GITHUB_APP_CLIENT_ID` | `GHCP_APP_CLIENT_ID` | Read directly by the server |
| `GITHUB_APP_CLIENT_SECRET` | `GHCP_APP_CLIENT_SECRET` | Read directly by the server |
| `GHCP_ENTERPRISE_BILLING_TOKEN` | `GHCP_ENTERPRISE_BILLING_TOKEN` | Read directly by the server |
| `SESSION_SECRET` | `GHCP_SESSION_SECRET` | Generate once and read directly by the server |
| `CLIENT_ORIGIN` | Do not store | Derived automatically from Codespaces metadata |
| `CALLBACK_URL` | Do not store | Derived automatically from `CLIENT_ORIGIN` |

Generate a strong `GHCP_SESSION_SECRET` value on a trusted machine:

```bash
openssl rand -hex 32
```

Create the four stored values at **Repository Settings > Secrets and
variables > Codespaces > New repository secret**:

* `GHCP_APP_CLIENT_ID`
* `GHCP_APP_CLIENT_SECRET`
* `GHCP_ENTERPRISE_BILLING_TOKEN`
* `GHCP_SESSION_SECRET`

For organization-managed access, an organization owner can instead create the
same names at **Organization Settings > Codespaces > Secrets** and grant this
repository access. Do not put these values in Actions secrets, repository
variables, source files, or dev container configuration. Stop and restart an
existing Codespace after adding or changing a Codespaces secret.

### Step 6: Configure for local or Codespaces

The server defaults to `http://localhost:5173` for local development. In
Codespaces, it derives the forwarded port `5173` origin and callback from
`CODESPACE_NAME` and `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`. Set
`CLIENT_ORIGIN` or `CALLBACK_URL` only when you need to override these defaults.

In Codespaces, set port `5173` visibility to Public so GitHub can reach the
callback URL.

### Step 7: Validate sign-in flow

1. Start the app with `npm run dev`.
2. Open the app in the browser.
3. Confirm the application opens on the Assessment page.
4. Select **Connect GitHub Enterprise**.
5. Complete consent in GitHub.
6. Confirm return to `/` and that the connected enterprise is displayed.
7. Verify API health with `GET /healthz`.

### Step 8: Validate assessment access

1. Run an assessment job.
2. Confirm status polling succeeds.
3. Confirm results are returned.
4. Generate and download the PDF report.

If assessment calls fail after successful sign-in, verify app installation,
organization access, enterprise access, and user billing permissions.

### GitHub App troubleshooting

* Authentication failure at callback: callback URL mismatch between app settings
  and `CALLBACK_URL`
* GitHub reports that the Client ID or Client Secret is incorrect: verify that
  `GHCP_APP_CLIENT_ID` matches the Client ID on the same GitHub App, generate a
  new Client Secret on that app, replace `GHCP_APP_CLIENT_SECRET`, and restart
  the Codespace so the updated secrets enter the environment
* Callback reports invalid or missing OAuth state: do not refresh or reuse the
  callback URL; return to the Assessment page and start a new connection after
  the development server has restarted
* Redirect lands on wrong host or port: `CLIENT_ORIGIN` mismatch
* Assessment APIs return unauthorized or forbidden: app not installed to target
  org or enterprise, or user lacks required visibility
* Enterprise budget or cost-center APIs return `404`: use the enterprise account
  slug from `https://github.com/enterprises/{slug}`, then verify that the
  authorizing user can view enterprise billing; GitHub can return `404` when a
  resource exists but is hidden from the token
* Codespaces sign-in worked earlier but now fails: Codespace name changed and
  callback URL was not updated

Organization usage can still complete when enterprise budget or cost-center
data is unavailable. The assessment marks those governance sources unavailable
and does not interpret them as empty.

## Choose Your Setup Path

| Path | Typical setup time | Best for |
| --- | --- | --- |
| GitHub Codespaces | 5-10 minutes | Avoiding local runtime, proxy, or endpoint-security constraints |
| Local VS Code | 5-10 minutes | Developers with a working Node.js and npm environment |
| Local PowerShell | 5-10 minutes | Windows users who prefer explicit environment configuration |

## GitHub Codespaces Setup

Codespaces is the recommended path when local endpoint security or an internal
npm proxy prevents access to packages from the public npm registry. This
repository includes a dev container based on Node.js 22. It installs locked npm
dependencies, GitHub CLI, Docker with Compose, and the VS Code extensions used
for TypeScript, GitHub Actions, pull requests, Markdown, and dependency work.

### Create the Codespace

1. Fork the repository if you plan to commit changes outside the source
   organization.
2. Open the repository or your fork on GitHub.
3. Select **Code**, select **Codespaces**, and then select **Create codespace on
   main**.
4. Wait for VS Code and the `npm ci` post-create command to finish.
5. Verify the runtime and development tools from the repository root:

```bash
node --version
npm --version
gh --version
docker version
```

> [!NOTE]
> A new Codespace contains changes pushed to GitHub. It does not contain
> uncommitted files from another computer.

### Start the Application

Start both workspace applications:

```bash
npm run dev
```

When Codespaces detects port `5173`, select **Open in Browser**. The Assessment
page is the entry point. Configure GitHub OAuth before attempting to unlock the
remaining workflow.

### Configure GitHub OAuth in Codespaces

Before creating the Codespace, follow Steps 4 and 5 to create the repository or
organization Codespaces secrets `GHCP_APP_CLIENT_ID`,
`GHCP_APP_CLIENT_SECRET`, `GHCP_ENTERPRISE_BILLING_TOKEN`, and
`GHCP_SESSION_SECRET`. The aliases avoid GitHub's reserved `GITHUB_` secret-name
prefix.

The Codespace name and forwarding domain are available as environment
variables. The server reads the stored aliases and derives the dynamic URLs
automatically. Start the app without mapping the variables manually:

```bash
npm run dev
```

Use the value printed by this command as the callback URL in the GitHub App
settings:

```bash
printf 'https://%s-5173.%s/auth/github/callback\n' \
  "${CODESPACE_NAME}" "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
```

The callback intentionally uses port `5173`. Vite proxies `/auth` to Express,
which keeps the OAuth session cookie on the same browser origin and returns the
user to the React `/` assessment route after authentication.

> [!IMPORTANT]
> Codespaces forwarding requires Vite to remain on port `5173`, accept the
> generated `*.app.github.dev` hostname, and support the relay's IPv6 localhost
> path. The checked-in Vite configuration enforces port `5173`, listens on `::`,
> and adds only this Codespace's derived forwarding hostname to `allowedHosts`.
> Do not replace these settings with an unrestricted host allowlist.

In the Codespaces **Ports** panel:

1. Find port `5173`.
2. Set its visibility to **Public** so GitHub can reach the OAuth callback.
3. Keep port `3001` private because Vite proxies browser requests to it.
4. Open the forwarded port `5173` URL.

> [!CAUTION]
> Public port visibility makes the development UI reachable by anyone who has
> its URL while the Codespace is running. Stop the Codespace when you finish and
> never print client secrets or session secrets in terminal output. VS Code
> remote-agent diagnostics can include injected environment values. Redact
> secrets before sharing logs and rotate any credential exposed in diagnostic
> output.

### Validate the Codespace

Run the health check in a second terminal while the app is running:

```bash
curl http://localhost:3001/healthz
```

Expected response:

```json
{"status":"ok"}
```

Build both packages before committing changes:

```bash
npm run build
```

Commit and push work that must survive deletion of the Codespace. Stop inactive
Codespaces to avoid consuming account quota.

## Local Setup

### Clone and Install

```bash
git clone https://github.com/autocloudarc-digital-services/ghcp-ai-credits-simulator.git
cd ghcp-ai-credits-simulator
npm install
```

If you are working from a fork, replace the clone URL with your fork URL.

### Start Locally

```bash
npm run dev
```

Open <http://localhost:5173>. The Express health endpoint is available at
<http://localhost:3001/healthz>. The application remains on the Assessment step
until GitHub OAuth is configured and a live assessment succeeds.

### Configure GitHub OAuth Locally

The `.env.example` file lists the supported variables, but the server does not
load `.env` files automatically. Export the values into the process environment
or use an approved secret-management tool before running the app.

For Bash:

```bash
export GITHUB_APP_CLIENT_ID="your-client-id"
export GITHUB_APP_CLIENT_SECRET="your-client-secret"
export GHCP_ENTERPRISE_BILLING_TOKEN="your-classic-pat"
export SESSION_SECRET="$(openssl rand -hex 32)"
npm run dev
```

For PowerShell 7:

```powershell
$env:GITHUB_APP_CLIENT_ID = "your-client-id"
$env:GITHUB_APP_CLIENT_SECRET = "your-client-secret"
$env:GHCP_ENTERPRISE_BILLING_TOKEN = "your-classic-pat"
$env:SESSION_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
npm run dev
```

Configure the OAuth application callback URL as
`http://localhost:5173/auth/github/callback` for local development.
Set `CLIENT_ORIGIN` or `CALLBACK_URL` only to override the local defaults.

### Environment Variables

| Runtime variable | Codespaces stored name | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `GITHUB_APP_CLIENT_ID` | `GHCP_APP_CLIENT_ID` | For OAuth | Empty | Client ID used to start GitHub authorization |
| `GITHUB_APP_CLIENT_SECRET` | `GHCP_APP_CLIENT_SECRET` | For OAuth | Empty | Client secret used to exchange the authorization code |
| `GHCP_ENTERPRISE_BILLING_TOKEN` | `GHCP_ENTERPRISE_BILLING_TOKEN` | Enterprise governance data | Empty | Classic PAT with `manage_billing:enterprise`, used only for budgets and cost centers |
| `SESSION_SECRET` | `GHCP_SESSION_SECRET` | Production and OAuth | Insecure development value | Signs session cookies and derives the OAuth token encryption key |
| `CALLBACK_URL` | Derived, not stored | No | `{CLIENT_ORIGIN}/auth/github/callback` | OAuth redirect URI through the Vite proxy |
| `CLIENT_ORIGIN` | Derived, not stored | No | Localhost or Codespaces port `5173` origin | Allowed browser origin for CORS |
| `PORT` | Not stored | No | `3001` | Express server port |
| `NODE_ENV` | Not stored | No | Development | Enables secure cookies and static client serving in production |

The Codespaces stored-name column applies only to GitHub Codespaces, where the
server reads the aliases directly. Local and production processes use the
runtime variable names. Never expose the Client Secret, enterprise billing
token, or session secret through repository variables, client-side Vite
variables, committed files, or command output.

> [!WARNING]
> The built-in `SESSION_SECRET` fallback is for development only. Always set a
> unique secret in any shared, hosted, or production-like environment.

## Application Workflow

1. Connect GitHub Enterprise and complete a live assessment of usage, budgets,
  cost centers, concentration, and governance gaps.
2. Review and confirm simulator assumptions for license counts and population
  tiers. These values are not returned by the assessment APIs, so the form is
  prefilled with planning assumptions that require explicit confirmation.
3. Review Governance Insights for projected credit posture, overage,
  visualizations, and governance readiness.
4. Review prioritized recommendations mapped to the Budget Profile Classes.
5. Preview and download the executive report.

Locked steps remain visible in the navigation with their prerequisite. Direct
navigation to a locked route redirects to the earliest incomplete step. Starting
a new assessment invalidates simulator confirmation and all downstream output.
Disconnecting resets the complete workflow.

Zustand automatically saves assessed data, simulator configuration, and workflow
progress in browser `sessionStorage`. A refresh in the same browser tab restores
progress after the server validates the OAuth session. Closing the tab clears
the browser copy. Assessment jobs, authenticated sessions, and generated reports
remain in server memory.

## API Reference

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/healthz` | No | Return server health |
| `GET` | `/auth/csrf-token` | No | Issue the current session CSRF token |
| `GET` | `/auth/github` | No | Start GitHub OAuth authorization |
| `GET` | `/auth/github/callback` | OAuth callback | Exchange the authorization code and create a session |
| `GET` | `/auth/status` | No | Report whether the current session is connected |
| `POST` | `/auth/logout` | Session | Revoke the token and destroy the session |
| `POST` | `/api/assessment/start` | Yes | Start an asynchronous enterprise assessment |
| `GET` | `/api/assessment/status/:id` | Yes | Poll assessment status |
| `GET` | `/api/assessment/results/:id` | Yes | Retrieve completed assessment results |
| `POST` | `/api/report/generate` | Assessment session | Generate and stream an executive PDF |
| `GET` | `/api/report/download/:id` | Owner session | Download a cached report by identifier |

State-changing requests require the CSRF token returned by
`/auth/csrf-token` in the `X-CSRF-Token` request header. The client configures
this behavior through its Axios CSRF interceptor.

## Security Model

The current implementation includes these development-oriented controls:

* OAuth state validation before exchanging an authorization code
* AES-256-GCM encryption for OAuth tokens stored in the server-side session
* HTTP-only, same-site session cookies with secure cookies in production
* Global request rate limiting and a stricter authentication-route limit
* CSRF protection for state-changing requests
* CORS restricted to `CLIENT_ORIGIN`
* Authentication middleware on assessment and report APIs
* Session ownership checks on assessment jobs and generated reports
* Completed-assessment requirement on report generation
* Generic API error responses with stack details omitted from production output

Secrets and OAuth tokens must never be committed. Review the security model,
GitHub application permissions, session storage, dependency posture, logging,
and data retention before deployment.

## Production Build

Build both workspaces from the repository root:

```bash
npm run build
```

The production Express server serves the compiled client from `client/dist`:

```bash
export NODE_ENV="production"
export SESSION_SECRET="your-production-secret"
export GITHUB_APP_CLIENT_ID="your-client-id"
export GITHUB_APP_CLIENT_SECRET="your-client-secret"
export GHCP_ENTERPRISE_BILLING_TOKEN="your-classic-pat"
export CALLBACK_URL="https://your-host.example/auth/github/callback"
export CLIENT_ORIGIN="https://your-host.example"
npm run start --workspace=server
```

Production hosting also requires TLS, durable session storage, centralized
secret management, observability, dependency scanning, and an explicit scaling
and data-retention design.

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install all npm workspace dependencies |
| `npm run dev` | Start client and server development processes |
| `npm run dev:client` | Start only the Vite client |
| `npm run dev:server` | Start only the Express server |
| `npm run build` | Build client and server |
| `npm run build:client` | Build only the client |
| `npm run build:server` | Build only the server |
| `npm run preview --workspace=client` | Preview the compiled client |
| `npm run start --workspace=server` | Start the compiled Express server |

## Project Layout

```text
ghcp-ai-credits-simulator/
├── client/                         React and Vite single-page application
│   ├── src/components/             Feature and visualization components
│   ├── src/data/                   Budget profile definitions
│   ├── src/engine/                 AI Credit calculation engine
│   ├── src/lib/                    Client infrastructure such as CSRF handling
│   ├── src/pages/                  Application route pages
│   ├── src/store/                  Zustand application state
│   └── src/types/                  Shared type re-exports
├── server/                         Express API and production web host
│   └── src/
│       ├── data/                   Server budget profile definitions
│       ├── middleware/             Authentication middleware
│       ├── routes/                 Auth, assessment, and report routes
│       └── services/               GitHub and PDF integration services
├── shared/                         Cross-workspace TypeScript contracts
├── .devcontainer/                  Codespaces and VS Code container setup
├── .env.example                    Environment variable reference
├── package.json                    Root npm workspace scripts
├── tsconfig.json                   Shared TypeScript defaults
└── LICENSE                         MIT license
```

## Current Limitations

* Express uses its default in-memory session store
* Assessment jobs and generated PDF buffers are process-local and disappear on
  restart
* Browser workflow autosave uses per-tab `sessionStorage` and is not durable
  across closed tabs or browsers
* The application has no database, distributed cache, job queue, or durable
  report storage
* The repository does not currently include an automated test suite
* Live assessment depends on GitHub API availability, permissions, and response
  compatibility

These constraints make the current implementation suitable for development,
demonstration, and design exploration. Address them before multi-user or
production deployment.

## Troubleshooting

### npm Returns a Package Feed 404

If npm requests packages from an internal feed such as
`packagefeedproxy.microsoft.io` and returns `404`, inspect the active registry:

```bash
npm config get registry
npm config get userconfig
```

The repository lockfile resolves public packages from `registry.npmjs.org`.
Follow organization policy before bypassing an internal feed. Use Codespaces
when local endpoint security blocks the public registry and the approved proxy
does not mirror a required package.

### npm Reports EBUSY on Windows

Stop running Node.js development servers, close processes holding files under
`node_modules`, pause sync activity if organization policy permits, and retry.
Avoid deleting locked dependency folders while another process is using them.

### OAuth Returns to the Wrong Port

Use the frontend URL for development callbacks:

```text
http://localhost:5173/auth/github/callback
```

In Codespaces, use the forwarded port `5173` URL with the same callback path.
The production callback should use the public production origin.

### Codespaces Port 5173 Returns an Empty 404

An empty `404` from the forwarded `*.app.github.dev` URL can come from the
Codespaces tunnel before the request reaches Vite. Confirm the application
first:

```bash
netstat -lntp | grep ':5173'
curl --ipv6 http://[::1]:5173/
gh codespace ports -c "${CODESPACE_NAME}"
```

The listener should show `:::5173`, the local request should return the Vite
HTML page, and the port record should use the expected forwarded URL. Port
`5173` must be Public for GitHub OAuth callbacks, while port `3001` remains
Private. If these checks pass but the forwarded URL still returns an empty
`404`, stop and restart the Codespace to recreate its tunnel host connection,
then restart `npm run dev`.

If local IPv4 and IPv6 requests return `200`, Vite accepts the forwarded Host
header, the tunnel reports a connected host and a port record, and recreating
the public port ACL still produces an empty tunnel-cluster `404`, the failure is
in the Codespaces forwarding service rather than this application. Preserve and
push all work before creating a replacement Codespace. A replacement receives a
new hostname, so update the GitHub App callback URL and restart OAuth from the
Assessment page. The dev container includes an SSH server so maintainers can
inspect a replacement with `gh codespace ssh -c <codespace-name>`; rebuild any
Codespace created before that feature was added. Alternatively, open a GitHub
Support case with the Codespace name, tunnel cluster, affected port, response
status, and reproduction time.
Never include tunnel access tokens, GitHub tokens, OAuth secrets, session
secrets, or unredacted VS Code logs in support evidence.

### The 3D Visualization Is Unavailable

Use a browser with WebGL enabled or select the application's 2D fallback. Remote
browser policy and GPU acceleration settings can affect Three.js rendering.

## Contributing

Create a focused branch, keep secrets out of source control, and validate the
full build before opening a pull request:

```bash
git switch -c feature/your-change
npm install
npm run build
git status --short
```

Include setup or behavior documentation when a change affects environment
variables, GitHub permissions, API contracts, calculations, or user workflows.

## License

This project is licensed under the [MIT License](LICENSE).
