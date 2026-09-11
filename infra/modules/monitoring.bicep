metadata name = 'Monitoring'
metadata description = 'Deploys the cost-capped Log Analytics workspace used by the lean runtime.'

import { ResourceTags } from '../types.bicep'

/* Common parameters */

@description('Azure region for monitoring resources.')
param location string

@description('Required ownership and cost-governance tags.')
param tags ResourceTags

/* Monitoring parameters */

@description('Log Analytics workspace name.')
param workspaceName string

/* Resources */

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
    workspaceCapping: {
      dailyQuotaGb: 1
    }
  }
}

/* Outputs */

@description('Log Analytics workspace resource ID.')
output id string = workspace.id

@description('Log Analytics workspace name.')
output name string = workspace.name