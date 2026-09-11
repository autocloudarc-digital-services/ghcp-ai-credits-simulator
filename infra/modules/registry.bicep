metadata name = 'Container registry'
metadata description = 'Deploys a Basic registry and grants pull access to the two runtime identities.'

import { ResourceTags } from '../types.bicep'

/* Common parameters */

@description('Azure region for the container registry.')
param location string

@description('Required ownership and cost-governance tags.')
param tags ResourceTags

/* Registry parameters */

@description('Application managed identity principal ID.')
param applicationPrincipalId string

@description('Deployment service principal object ID.')
param deploymentPrincipalId string

@description('Migration managed identity principal ID.')
param migrationPrincipalId string

@description('Container registry name.')
param registryName string

/* Variables */

var acrPullRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)
var acrPushRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '8311e382-0749-4cb8-b61a-304f252e45ec'
)

/* Resources */

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    dataEndpointEnabled: false
    networkRuleBypassOptions: 'AzureServices'
    publicNetworkAccess: 'Enabled'
    zoneRedundancy: 'Disabled'
  }
}

resource applicationAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, applicationPrincipalId, acrPullRoleDefinitionId)
  scope: registry
  properties: {
    principalId: applicationPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleDefinitionId
  }
}

resource migrationAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, migrationPrincipalId, acrPullRoleDefinitionId)
  scope: registry
  properties: {
    principalId: migrationPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleDefinitionId
  }
}

resource deploymentAcrPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, deploymentPrincipalId, acrPushRoleDefinitionId)
  scope: registry
  properties: {
    principalId: deploymentPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPushRoleDefinitionId
  }
}

/* Outputs */

@description('Container registry resource ID.')
output id string = registry.id

@description('Container registry login server.')
output loginServer string = registry.properties.loginServer

@description('Container registry name.')
output name string = registry.name