---
title: Contributor Guide
description: Configure local or Codespaces development, run persistence safely, and validate changes before review
author: autocloudarc-digital-services
ms.date: 2026-09-11
ms.topic: tutorial
keywords:
  - contributor
  - node.js
  - docker compose
  - github codespaces
estimated_reading_time: 8
---

## Development Boundary

Local VS Code and GitHub Codespaces are the supported contributor environments.
They use Vite on port `5173`, Express on port `3001`, and a Docker Compose
PostgreSQL/PostgREST stack bound to numeric loopback on port `3302`.

Local Compose is not the production deployment path. Use the protected Azure
workflow described in [Azure Production Deployment](azure-deployment.md) for a
hosted release.

## Prerequisites

Install or provide:

* Node.js 22 and npm
* Docker with Compose support
* Git
* A GitHub App configured for user authorization when testing live assessment
* A classic GitHub token with `manage_billing:enterprise` only when testing the
  billing endpoints that require it

The included dev container supplies Node.js, npm, Docker with Compose, GitHub
CLI, Azure CLI with Bicep, Azure Developer CLI (`azd`), and the VS Code
extensions used by the repository. These Azure CLIs support contributor and
validation work; they do not replace the protected production workflow. The
repository does not define an `azure.yaml` project or support `azd up` for
production.

## Install Dependencies

From the repository root:

```bash
npm clean-install
```

Use `npm install` only when intentionally changing dependency declarations or
the lockfile.

## Start Local Persistence

Create local credentials, start PostgreSQL, apply ordered migrations, and start
PostgREST:

```bash
npm run register:db:up
npm run register:db:status
```

The command creates `.local/register.env` with mode `0600`. Local database data
is stored in the named Docker volume `ghcp-active-register_register_data`.
Repository scripts never remove that volume.

> [!CAUTION]
> Do not run `docker compose down --volumes`, delete the register volume, or
> replace `.local/register.env` while preserving its encrypted data. Back up
> first and confirm the recovery test when changing storage behavior.

## Configure Runtime Values

The server does not load `.env` files automatically. Export runtime values in
the terminal or use an approved local secret manager. The checked-in
`.env.example` lists supported names.

For Bash:

```bash
export GITHUB_APP_CLIENT_ID="your-client-id"
export GITHUB_APP_CLIENT_SECRET="your-client-secret"
export GHCP_ENTERPRISE_BILLING_TOKEN="your-expiring-classic-token"
export SESSION_SECRET="$(openssl rand -hex 32)"
export CLIENT_ORIGIN="http://localhost:5173"
export CALLBACK_URL="http://localhost:5173/auth/github/callback"
```

The database helper reads local gateway credentials from
`.local/register.env`. Active Register access remains deny-by-default. Add only
verified GitHub numeric IDs to `.local/register-access.json` according to
[Active Register](active-register.md); never commit that file.

## Start the Application

Start both workspaces:

```bash
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/auth` and `/api` to Express. Check
liveness directly at <http://localhost:3001/healthz> and storage readiness at
<http://localhost:3001/readyz>.

Use `http://localhost:5173/auth/github/callback` as the local GitHub App callback.

## GitHub Codespaces

Create a Codespace from the repository and wait for the post-create dependency
installation to finish. Store these Codespaces secrets before starting the app:

| Codespaces secret name          | Runtime use                    |
| ------------------------------- | ------------------------------ |
| `GHCP_APP_CLIENT_ID`            | GitHub App client ID           |
| `GHCP_APP_CLIENT_SECRET`        | GitHub App client secret       |
| `GHCP_ENTERPRISE_BILLING_TOKEN` | Enterprise billing token       |
| `GHCP_SESSION_SECRET`           | Session encryption and signing |

Run `npm run register:db:up`, then `npm run dev`. Keep port `3001` private. Port
`5173` must be public only while GitHub needs to reach the development callback.
Print the current callback with:

```bash
printf 'https://%s-5173.%s/auth/github/callback\n' \
  "${CODESPACE_NAME}" "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
```

Stop the Codespace when work is complete. A replacement Codespace has a new
hostname, so update the GitHub App callback before starting a new authorization.

## Validation Commands

Run the checks appropriate to the changed surface:

| Command                                                      | Purpose                                           |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `npm run runtime:test`                                       | Production configuration, auth, probes, lifecycle |
| `npm run register:test`                                      | Active Register unit and API behavior             |
| `npm run register:check`                                     | Governance requirements and executable checks     |
| `npm run persistence:test`                                   | PostgreSQL integration and persistence behavior   |
| `npm run build`                                              | Client and server production compilation          |
| `npm run lint --workspace=client`                            | Client lint                                       |
| `npm audit --omit=dev --workspaces --include-workspace-root` | Production dependency audit                       |
| `npm run container:build`                                    | Application and migration container builds        |

`npm run persistence:test` requires the local stack and sets the integration
flag through the package script. Run the full set before a release or a change
to authentication, persistence, infrastructure, migrations, or deployment.

## Backup and Recovery Test

Create a local custom-format backup:

```bash
npm run register:db:backup
```

Verify container recreation and restore the backup into an isolated temporary
database:

```bash
npm run register:db:verify-recovery
```

Run recovery verification without concurrent application writes. Backups are
stored under `.local/backups` with mode `0600` and must not be committed.

## Migration Changes

Add new migrations under `server/src/register/migrations` with the next ordered
numeric prefix. Do not rewrite an applied migration. Validate a clean database
and a second idempotent migration run, then run register and persistence checks.

Migrations define security boundaries as well as schema. Preserve owner,
authenticator, application-session, application-data, and Active Register role
separation.

## Contribution Checklist

Before opening a pull request:

1. Review `git status --short` and keep unrelated user changes intact.
2. Confirm no `.local` files, tokens, passwords, access maps, database dumps, or
   Azure identifiers were added.
3. Run the focused checks for the changed surface and `npm run build`.
4. Update behavior, environment, API, or operator documentation when its
   contract changes.
5. Describe migration and rollback implications for persistent-data changes.
