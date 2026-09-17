metadata name = 'GHCP AI Credits Simulator deployment types'
metadata description = 'Shared configuration contracts for the lean Azure deployment.'

@export()
@sealed()
@description('Resource names supplied by the adopter for the production deployment.')
type ResourceNames = {
  @description('Azure Container Registry name.')
  containerRegistry: string

  @description('Container App name.')
  containerApp: string

  @description('Container Apps environment name.')
  containerEnvironment: string

  @description('Application user-assigned managed identity name.')
  applicationIdentity: string

  @description('Key Vault name.')
  keyVault: string

  @description('Log Analytics workspace name.')
  logAnalytics: string

  @minLength(2)
  @maxLength(32)
  @description('Migration Container Apps job name: lowercase letters, digits, or hyphens; starts with a letter, ends with a letter or digit, and has no consecutive hyphens.')
  migrationJob: string

  @description('Migration user-assigned managed identity name.')
  migrationIdentity: string

  @description('PostgreSQL database name.')
  postgresDatabase: string

  @description('PostgreSQL Flexible Server name.')
  postgresServer: string

  @description('Virtual network name.')
  virtualNetwork: string
}

@export()
@sealed()
@description('CIDR ranges for the virtual network and its isolated subnets.')
type NetworkConfig = {
  @description('CIDR range delegated to the Container Apps environment.')
  containerAppsSubnetPrefix: string

  @description('Name of the subnet delegated to the Container Apps environment.')
  containerAppsSubnetName: string

  @description('CIDR range reserved for private endpoints.')
  privateEndpointsSubnetPrefix: string

  @description('Name of the subnet reserved for private endpoints.')
  privateEndpointsSubnetName: string

  @description('CIDR range delegated to PostgreSQL Flexible Server.')
  postgresSubnetPrefix: string

  @description('Name of the subnet delegated to PostgreSQL Flexible Server.')
  postgresSubnetName: string

  @description('CIDR range for the virtual network.')
  virtualNetworkPrefix: string
}

@export()
@sealed()
@description('Immutable image digests deployed from the private registry.')
type ImageDigests = {
  @description('Application image digest in sha256 form.')
  app: string

  @description('Migration image digest in sha256 form.')
  migration: string

  @description('PostgREST sidecar image digest in sha256 form.')
  postgrest: string
}

@export()
@sealed()
@description('Repository paths used for images in the private registry.')
type ImageRepositories = {
  @description('Application image repository path.')
  app: string

  @description('Migration image repository path.')
  migration: string

  @description('PostgREST sidecar image repository path.')
  postgrest: string
}

@export()
@sealed()
@description('Non-secret runtime settings for GitHub and Active Register authorization.')
type RuntimeConfig = {
  @description('Microsoft Entra security group object ID allowed through platform authentication.')
  entraAllowedGroupObjectId: string

  @description('Microsoft Entra application client ID used by platform authentication.')
  entraClientId: string

  @description('GitHub App client identifier.')
  githubAppClientId: string

  @description('PostgreSQL administrator login name.')
  postgresAdministratorLogin: string
}

@export()
@sealed()
@description('Required resource tags for ownership and cost governance.')
type ResourceTags = {
  @description('Cost center responsible for Azure charges.')
  costCenter: string

  @description('Deployment environment name.')
  environment: 'prod'

  @description('Operational owner for the deployment.')
  owner: string

  @description('Workload identifier.')
  workload: 'ghcp-ai-credits-simulator'
}