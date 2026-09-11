targetScope = 'resourceGroup'

metadata name = 'GHCP AI Credits Simulator'
metadata description = 'Orchestrates the approved lean Azure production topology in one resource group.'

import {
  ImageDigests
  ImageRepositories
  NetworkConfig
  ResourceNames
  ResourceTags
  RuntimeConfig
} from './types.bicep'

/* Common parameters */

@allowed([
  'eastus2'
])
@description('Approved Azure region for all regional resources.')
param location string = 'eastus2'

@description('Adopter-supplied names for all Azure resources.')
param names ResourceNames

@description('Required ownership and cost-governance tags.')
param tags ResourceTags

/* Identity parameters */

@description('Microsoft Entra object ID for the protected deployment service principal.')
param deploymentPrincipalId string

/* Networking parameters */

@description('CIDR and subnet naming configuration.')
param network NetworkConfig

/* Compute parameters */

@description('Immutable sha256 image digests.')
param imageDigests ImageDigests

@description('Private registry repository paths.')
param imageRepositories ImageRepositories

@description('Non-secret application runtime configuration.')
param runtime RuntimeConfig

@description('Whether to deploy or update the public application.')
param shouldDeployApplication bool = true

@description('Whether to deploy or update the private migration job.')
param shouldDeployMigrationJob bool = true

@description('Whether to make application ingress reachable outside the Container Apps environment.')
param shouldEnableExternalIngress bool = false

/* Security parameters */

@secure()
@minLength(1)
@description('Enterprise billing token used by the application.')
param enterpriseBillingToken string

@secure()
@minLength(1)
@description('Microsoft Entra application client secret used by Container Apps authentication.')
param entraClientSecret string

@secure()
@minLength(1)
@description('GitHub App client secret.')
param githubAppClientSecret string

@secure()
@minLength(8)
@description('PostgreSQL administrator password.')
param postgresAdministratorPassword string

@secure()
@minLength(8)
@description('PostgreSQL authenticator password used by PostgREST.')
param postgresAuthenticatorPassword string

@secure()
@minLength(2)
@description('Active Register GitHub identity-to-role mapping as JSON.')
param registerAccessJson string

@secure()
@minLength(32)
@description('Active Register JWT signing secret.')
param registerJwtSecret string

@secure()
@minLength(32)
@description('Persistent session encryption and cookie-signing secret.')
param sessionSecret string

/* Modules */

module monitoring './modules/monitoring.bicep' = {
  params: {
    location: location
    tags: tags
    workspaceName: names.logAnalytics
  }
}

module identities './modules/identities.bicep' = {
  params: {
    applicationIdentityName: names.applicationIdentity
    location: location
    migrationIdentityName: names.migrationIdentity
    tags: tags
  }
}

module networking './modules/networking.bicep' = {
  params: {
    location: location
    network: network
    tags: tags
    virtualNetworkName: names.virtualNetwork
  }
}

module registry './modules/registry.bicep' = {
  params: {
    applicationPrincipalId: identities.outputs.applicationPrincipalId
    deploymentPrincipalId: deploymentPrincipalId
    location: location
    migrationPrincipalId: identities.outputs.migrationPrincipalId
    registryName: names.containerRegistry
    tags: tags
  }
}

module database './modules/database.bicep' = {
  params: {
    administratorLogin: runtime.postgresAdministratorLogin
    administratorPassword: postgresAdministratorPassword
    databaseName: names.postgresDatabase
    location: location
    privateDnsZoneId: networking.outputs.postgresPrivateDnsZoneId
    serverName: names.postgresServer
    subnetId: networking.outputs.postgresSubnetId
    tags: tags
  }
}

module containerEnvironment './modules/container-environment.bicep' = {
  params: {
    infrastructureSubnetId: networking.outputs.containerAppsSubnetId
    location: location
    logAnalyticsWorkspaceName: monitoring.outputs.name
    managedEnvironmentName: names.containerEnvironment
    tags: tags
  }
}

module keyVault './modules/key-vault.bicep' = {
  params: {
    applicationPrincipalId: identities.outputs.applicationPrincipalId
    deploymentPrincipalId: deploymentPrincipalId
    enterpriseBillingToken: enterpriseBillingToken
    entraClientSecret: entraClientSecret
    githubAppClientSecret: githubAppClientSecret
    keyVaultName: names.keyVault
    location: location
    logAnalyticsWorkspaceId: monitoring.outputs.id
    migrationPrincipalId: identities.outputs.migrationPrincipalId
    postgresAdministratorPassword: postgresAdministratorPassword
    postgresAuthenticatorPassword: postgresAuthenticatorPassword
    postgresDatabaseName: database.outputs.databaseName
    postgresFullyQualifiedDomainName: database.outputs.fullyQualifiedDomainName
    privateDnsZoneId: networking.outputs.keyVaultPrivateDnsZoneId
    privateEndpointSubnetId: networking.outputs.privateEndpointsSubnetId
    registerAccessJson: registerAccessJson
    registerJwtSecret: registerJwtSecret
    sessionSecret: sessionSecret
    tags: tags
  }
}

module application './modules/application.bicep' = if (shouldDeployApplication) {
  params: {
    appImageDigest: imageDigests.app
    appImageRepository: imageRepositories.app
    applicationIdentityId: identities.outputs.applicationResourceId
    containerAppName: names.containerApp
    enterpriseBillingTokenUri: keyVault.outputs.enterpriseBillingTokenUri
    entraClientSecretUri: keyVault.outputs.entraClientSecretUri
    environmentDefaultDomain: containerEnvironment.outputs.defaultDomain
    environmentId: containerEnvironment.outputs.id
    githubAppClientSecretUri: keyVault.outputs.githubAppClientSecretUri
    location: location
    postgrestDatabaseUri: keyVault.outputs.postgrestDatabaseUri
    postgrestImageDigest: imageDigests.postgrest
    postgrestImageRepository: imageRepositories.postgrest
    registerAccessJsonUri: keyVault.outputs.registerAccessJsonUri
    registerJwtSecretUri: keyVault.outputs.registerJwtSecretUri
    registryLoginServer: registry.outputs.loginServer
    runtime: runtime
    sessionSecretUri: keyVault.outputs.sessionSecretUri
    shouldEnableExternalIngress: shouldEnableExternalIngress
    tags: tags
  }
}

module migrationJob './modules/migration-job.bicep' = if (shouldDeployMigrationJob) {
  params: {
    databaseName: database.outputs.databaseName
    databaseServerHost: database.outputs.fullyQualifiedDomainName
    databaseUser: runtime.postgresAdministratorLogin
    environmentId: containerEnvironment.outputs.id
    jobName: names.migrationJob
    location: location
    migrationIdentityId: identities.outputs.migrationResourceId
    migrationImageDigest: imageDigests.migration
    migrationImageRepository: imageRepositories.migration
    postgresAdminCredentialUri: keyVault.outputs.postgresAdminCredentialUri
    postgresGatewayCredentialUri: keyVault.outputs.postgresGatewayCredentialUri
    registryLoginServer: registry.outputs.loginServer
    tags: tags
  }
}

/* Outputs */

@description('Public HTTPS origin of the deployed application.')
output applicationOrigin string? = application.?outputs.?clientOrigin

@description('Container App resource ID.')
output containerAppId string? = application.?outputs.?id

@description('Container registry login server.')
output containerRegistryLoginServer string = registry.outputs.loginServer

@description('Key Vault name.')
output keyVaultName string = keyVault.outputs.name

@description('Migration job resource ID.')
output migrationJobId string? = migrationJob.?outputs.?id

@description('PostgreSQL Flexible Server resource ID.')
output postgresServerId string = database.outputs.id