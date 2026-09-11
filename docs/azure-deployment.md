---
title: Azure Production Deployment
description: Provision and operate the approved lean Azure deployment through the protected GitHub Actions workflow
author: autocloudarc-digital-services
ms.date: 2026-09-11
ms.topic: how-to
keywords:
  - azure container apps
  - postgresql flexible server
  - microsoft entra
  - github actions oidc
estimated_reading_time: 14
---

## Supported Production Path

The protected `Azure production deployment` GitHub Actions workflow is the
supported production deployment path. It validates, previews, migrates, and
deploys the complete Azure topology from `infra/subscription.bicep`.

> [!IMPORTANT]
> Do not deploy the Bicep files directly for a production release. The workflow
> contains mandatory identity, authority, cost, migration, and internal-ingress
> gates that a direct deployment would bypass.

The deployment does not copy a contributor's local PostgreSQL volume or `.local`
files to Azure. Production starts with a new database and applies the ordered
migrations in `server/src/register/migrations`.

## Approved Lean Topology

The first production deployment is fixed to these cost and reliability choices:

| Surface               | Approved configuration                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| Region                | `eastus2`                                                              |
| Container Apps        | Consumption environment with one always-on replica                     |
| Application container | `1` vCPU and `2 GiB`                                                   |
| PostgREST sidecar     | `0.25` vCPU and `0.5 GiB`, bound to numeric loopback                   |
| PostgreSQL            | Version 17, Burstable `Standard_B2ms`, 32 GiB, 7-day retention         |
| Database availability | No high availability or geo-redundant backup                           |
| Container registry    | Basic, authenticated public endpoint, no admin or anonymous access     |
| Key Vault             | Standard, RBAC, private endpoint, purge protection, 90-day soft delete |
| Networking            | Delegated app and database subnets plus a private-endpoint subnet      |
| Monitoring            | Log Analytics, 30-day retention, 1 GiB daily ingestion cap             |
| Runtime scale         | One minimum replica and one maximum replica                            |

The public-retail estimate recorded for this topology is `$144.31` per month
when Container Apps consumption is idle and `$209.51` per month when the single
replica is fully active for the month. The estimate excludes negotiated
discounts and variable overages such as outbound data transfer, excess backup,
and ingestion beyond the configured cap.

Every dispatch requires a current negotiated monthly estimate greater than zero
and no more than `$209.51`, plus an exact acknowledgement of the `$209.51`
public-retail ceiling. Premium ACR, PostgreSQL high availability, geo-replication,
larger SKUs, additional replicas, or a dedicated Container Apps workload profile
require a separate cost review and approval.

## Identity Boundaries

Production uses three independent identity systems:

| Boundary                  | Identity and purpose                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| Azure deployment          | GitHub Actions OIDC service principal provisions and assigns Azure RBAC |
| Application admission     | Single-tenant Microsoft Entra app admits one assigned security group    |
| GitHub data authorization | GitHub App user flow authorizes enterprise and organization API calls   |

The runtime has separate user-assigned managed identities for the application
and migration job. Both can pull from ACR and read only their required Key Vault
secrets. The application does not receive the database owner password. The
migration job receives owner credentials only while an explicitly started job
execution is running.

## Authority Prerequisites

Configure the GitHub Actions OIDC service principal before provisioning:

* Add a federated credential restricted to this repository and the protected
  `production` environment.
* Grant either `Owner`, or `Contributor` plus `User Access Administrator` or
  `Role Based Access Control Administrator`, at subscription scope.
* Make the service principal an owner of the application-admission Entra app.
* Grant Microsoft Graph application permission
  `Application.ReadWrite.OwnedBy` with tenant admin consent. The workflow also
  accepts `Application.ReadWrite.All`, but the owned-by permission has a smaller
  authority boundary.
* Grant enough Microsoft Graph read authority to resolve the dedicated security
  group and inspect enterprise-app assignments. The preflight proves these calls
  rather than inferring directory authority from Azure RBAC.

The workflow verifies that `DEPLOYMENT_PRINCIPAL_ID` is the object ID of
`AZURE_CLIENT_ID`, the principal is enabled, its Graph application-write role is
present, and it owns the admission app when using
`Application.ReadWrite.OwnedBy`.

## Microsoft Entra Admission

Create a separate single-tenant app registration for Container Apps admission:

1. Set supported account types to accounts in this organizational directory
   only (`AzureADMyOrg`).
2. Create a client secret and retain its value only long enough to store it as
   the protected `ENTRA_CLIENT_SECRET` environment secret.
3. Set **Assignment required** to **Yes** on the enterprise application.
4. Create or select a dedicated security-enabled group.
5. Assign that group to the enterprise application.
6. Make the deployment OIDC service principal an owner of the app registration.

The generated Container Apps hostname is unknown until the foundation exists.
After the internal environment is created, the workflow adds this redirect URI
to the app registration:

```text
https://<container-app>.<environment-domain>/.auth/login/aad/callback
```

The application is deployed with internal ingress first. The workflow checks
that platform authentication is enabled, HTTPS is required, unauthenticated
requests redirect to Microsoft Entra, and the dedicated group is the allowed
principal before external ingress is enabled. Only `/healthz` and `/readyz` are
anonymous.

## GitHub Production Environment

Create a GitHub environment named `production` and configure required reviewers.
Restrict deployment branches or tags according to the repository release policy.
The environment approval records the change reason and protects all production
variables and secrets.

### Environment Variables

| Variable                          | Purpose                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `APP_IMAGE_REPOSITORY`            | ACR repository for the Node application image            |
| `APPLICATION_IDENTITY_NAME`       | Application managed identity name                        |
| `AZURE_CLIENT_ID`                 | GitHub Actions OIDC application client ID                |
| `AZURE_LOCATION`                  | Must be `eastus2` for the approved topology              |
| `AZURE_RESOURCE_GROUP_NAME`       | Production resource group name                           |
| `AZURE_SUBSCRIPTION_ID`           | Target Azure subscription ID                             |
| `AZURE_TENANT_ID`                 | Target Microsoft Entra tenant ID                         |
| `CONTAINER_APP_NAME`              | Public application name                                  |
| `CONTAINER_APPS_ENVIRONMENT_NAME` | Container Apps environment name                          |
| `CONTAINER_APPS_SUBNET_NAME`      | Delegated Container Apps subnet name                     |
| `CONTAINER_APPS_SUBNET_PREFIX`    | Delegated Container Apps subnet CIDR                     |
| `CONTAINER_REGISTRY_NAME`         | Globally unique ACR name                                 |
| `COST_CENTER`                     | Required resource cost-center tag                        |
| `DEPLOYMENT_PRINCIPAL_ID`         | OIDC service principal object ID                         |
| `ENTRA_ALLOWED_GROUP_OBJECT_ID`   | Dedicated admission security-group object ID             |
| `ENTRA_CLIENT_ID`                 | Application-admission Entra app client ID                |
| `GH_APP_CLIENT_ID`                | GitHub App client ID                                     |
| `KEY_VAULT_NAME`                  | Globally unique Key Vault name                           |
| `LOG_ANALYTICS_WORKSPACE_NAME`    | Log Analytics workspace name                             |
| `MIGRATION_IDENTITY_NAME`         | Migration managed identity name                          |
| `MIGRATION_IMAGE_REPOSITORY`      | ACR repository for the migration image                   |
| `MIGRATION_JOB_NAME`              | Manual Container Apps migration job name                 |
| `OWNER`                           | Required operational-owner tag                           |
| `POSTGRES_ADMINISTRATOR_LOGIN`    | PostgreSQL owner login name                              |
| `POSTGRES_DATABASE_NAME`          | Application database name                                |
| `POSTGRES_SERVER_NAME`            | Globally unique PostgreSQL server name                   |
| `POSTGRES_SUBNET_NAME`            | Delegated PostgreSQL subnet name                         |
| `POSTGRES_SUBNET_PREFIX`          | Delegated PostgreSQL subnet CIDR                         |
| `POSTGREST_IMAGE_REPOSITORY`      | ACR repository for the PostgREST image                   |
| `POSTGREST_SOURCE_IMAGE`          | Trusted PostgREST source image pinned by `sha256` digest |
| `PRIVATE_ENDPOINTS_SUBNET_NAME`   | Private-endpoint subnet name                             |
| `PRIVATE_ENDPOINTS_SUBNET_PREFIX` | Private-endpoint subnet CIDR                             |
| `VIRTUAL_NETWORK_NAME`            | Production virtual network name                          |
| `VIRTUAL_NETWORK_PREFIX`          | Production virtual network CIDR                          |

Use nonoverlapping CIDRs. ACR, Key Vault, PostgreSQL, and Container App names
must meet Azure naming rules and be available at deployment time.

### Environment Secrets

| Secret                            | Purpose                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| `ENTRA_CLIENT_SECRET`             | Admission app credential used by Container Apps authentication |
| `GH_APP_CLIENT_SECRET`            | GitHub App user-authorization credential                       |
| `GH_ENTERPRISE_BILLING_TOKEN`     | Expiring token for unsupported enterprise billing endpoints    |
| `POSTGRES_ADMINISTRATOR_PASSWORD` | Database owner credential used by the migration job            |
| `POSTGRES_AUTHENTICATOR_PASSWORD` | Restricted PostgREST database credential                       |
| `REGISTER_ACCESS_JSON`            | Verified GitHub numeric-ID to tenant-role mapping              |
| `REGISTER_JWT_SECRET`             | Short-lived PostgREST role-token signing key                   |
| `SESSION_SECRET`                  | Session encryption and cookie-signing secret                   |

Use independently generated values. `REGISTER_JWT_SECRET` and `SESSION_SECRET`
must contain at least 32 characters. Do not place secret values in variables,
workflow inputs, committed parameter files, issue comments, or chat.

## Pre-Provision Checks

The workflow stops before creating resources unless all checks pass:

* Release tests, builds, lint, dependency audit, Bicep compilation, and both
  production container builds
* Exact cost-ceiling acknowledgement and an in-ceiling negotiated estimate
* OIDC sign-in to the expected enabled tenant and subscription
* Required Azure resource-provider registration
* Subscription RBAC and role-assignment authority
* OIDC principal identity, Graph application-write permission, and app ownership
* Single-tenant admission app, enabled assignment-required enterprise app,
  security-enabled group, and group assignment
* PostgreSQL 17 and `Standard_B2ms` availability in `eastus2`
* Cost Management budget read access and absence of blocking read-only locks
* Immutable PostgREST source digest and complete protected settings
* Successful client-credential exchange for the admission app
* Subscription-level Azure what-if for the final externally reachable topology

Treat a missing permission, unreadable check, unknown SKU, unexpected what-if
change, or unverified price as a failure. Do not bypass the check by deploying
from a workstation.

## Run a Deployment

1. Open **Actions** and select **Azure production deployment**.
2. Select the reviewed commit or release branch.
3. Enter `209.51` for the approved public-retail ceiling.
4. Enter the current negotiated monthly estimate in USD.
5. Enter a concise change reason.
6. Start the workflow and review the validation job.
7. Inspect the complete what-if output before approving the `production`
   environment deployment.
8. Confirm that the final readiness check succeeds and that the environment URL
   resolves through Microsoft Entra admission.

The workflow deploys in this order:

1. Foundation resources without application or migration compute
2. Microsoft Entra callback update
3. Digest-pinned images in ACR
4. Private migration job and ordered database migrations
5. Application with internal ingress
6. Platform-authentication and group-policy verification
7. External ingress and final health, readiness, and traffic checks

## Database Migration

Migrations are ordered SQL files and must be additive or explicitly compatible
with the currently deployed application. The migration image runs `psql` with
TLS certificate verification and stops at the first error. The workflow does not
deploy the application when migration execution fails.

Do not edit an already applied migration. Add the next numbered migration and
verify both a clean database and a repeated migration run before release.

## Backup and Restore

PostgreSQL retains seven days of point-in-time backups. Configure any additional
retention, export, or compliance process outside this lean baseline and include
its cost in the approved estimate.

To recover within the retention window:

1. Disable external ingress or otherwise stop application writes.
2. Record the source server, UTC restore point, and current image digests.
3. Restore to a new server name in the same region and resource group.
4. Validate the restored database privately.
5. Change `POSTGRES_SERVER_NAME` to the restored server and run the protected
   workflow so Bicep, Key Vault URIs, migrations, and application configuration
   converge on that server.
6. Retain the old server until recovery is accepted, then remove it through an
   approved change.

Example restore command:

```bash
az postgres flexible-server restore \
  --resource-group "$AZURE_RESOURCE_GROUP_NAME" \
  --name "$RESTORED_POSTGRES_SERVER_NAME" \
  --source-server "$POSTGRES_SERVER_NAME" \
  --restore-time "$RESTORE_TIME_UTC"
```

Restoring a server creates billable resources. Obtain cost approval before the
operation. Test the procedure periodically without using production secrets in
logs or command output.

## Application Rollback

Images are deployed by immutable digest. To roll back application code, dispatch
the protected workflow from the last accepted commit and use a change reason
that identifies the failed release. The workflow republishes that source,
rechecks the full topology, applies only idempotent migrations, and shifts all
traffic after readiness succeeds.

Database migrations are forward-only. When a release changes the data contract,
prepare a compatible forward repair or use point-in-time restore. Do not assume
that reverting the application digest also reverts database state.

## Interrupted Deployments

Production deployments use one noncanceling concurrency group. A failed run can
leave a subset of foundation resources, images, or a completed migration. Bicep
and ordered migrations are designed for convergence. Investigate the failed step,
preserve its logs, and rerun the same reviewed commit after correcting the cause.

Do not delete the resource group to recover from an interrupted deployment.
Running assessments are marked failed during graceful application shutdown and
must be started again by the user.

## Teardown

Teardown is a separate destructive change and is not part of the deployment
workflow.

1. Export required reports and database backups.
2. Confirm data-retention and legal requirements.
3. Disable application access and remove the Entra group assignment.
4. Delete the Azure resource group under a separately approved change.
5. Remove the generated Entra redirect URI and rotate or delete the admission
   app secret.
6. Remove production GitHub secrets, variables, and OIDC federation when the
   environment will not be recreated.

Key Vault purge protection and soft delete intentionally outlive resource-group
deletion. Account for retained names and recovery policy before teardown.
