metadata name = 'Container Apps environment'
metadata description = 'Deploys a VNet-integrated Consumption environment connected to Log Analytics.'

import { ResourceTags } from '../types.bicep'

/* Common parameters */

@description('Azure region for Container Apps resources.')
param location string

@description('Required ownership and cost-governance tags.')
param tags ResourceTags

/* Environment parameters */

@description('Container Apps delegated subnet resource ID.')
param infrastructureSubnetId string

@description('Log Analytics workspace name.')
param logAnalyticsWorkspaceName string

@description('Container Apps environment name.')
param managedEnvironmentName string

/* Existing resources */

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

/* Resources */

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: managedEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: infrastructureSubnetId
      internal: false
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
    zoneRedundant: false
  }
}

/* Outputs */

@description('Container Apps environment default DNS domain.')
output defaultDomain string = managedEnvironment.properties.defaultDomain

@description('Container Apps environment resource ID.')
output id string = managedEnvironment.id

@description('Container Apps environment name.')
output name string = managedEnvironment.name