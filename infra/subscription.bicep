targetScope = 'subscription'

metadata name = 'GHCP AI Credits Simulator subscription deployment'
metadata description = 'Creates the production resource group and deploys the approved lean topology.'

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
@description('Approved Azure region for the resource group and regional resources.')
param location string = 'eastus2'

@description('Adopter-supplied names for all Azure resources.')
param names ResourceNames

@description('Production resource group name.')
param resourceGroupName string

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

/* Resources */

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

/* Modules */

module workload './main.bicep' = {
  scope: resourceGroup
  params: {
    deploymentPrincipalId: deploymentPrincipalId
    enterpriseBillingToken: enterpriseBillingToken
    entraClientSecret: entraClientSecret
    githubAppClientSecret: githubAppClientSecret
    imageDigests: imageDigests
    imageRepositories: imageRepositories
    location: location
    names: names
    network: network
    postgresAdministratorPassword: postgresAdministratorPassword
    postgresAuthenticatorPassword: postgresAuthenticatorPassword
    registerAccessJson: registerAccessJson
    registerJwtSecret: registerJwtSecret
    runtime: runtime
    sessionSecret: sessionSecret
    shouldDeployApplication: shouldDeployApplication
    shouldDeployMigrationJob: shouldDeployMigrationJob
    shouldEnableExternalIngress: shouldEnableExternalIngress
    tags: tags
  }
}

/* Outputs */

@description('Public HTTPS origin of the deployed application.')
output applicationOrigin string? = workload.outputs.?applicationOrigin

@description('Production resource group resource ID.')
output resourceGroupId string = resourceGroup.id

@description('Production resource group name.')
output resourceGroupName string = resourceGroup.name