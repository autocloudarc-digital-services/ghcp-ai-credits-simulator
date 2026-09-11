metadata name = 'Runtime identities'
metadata description = 'Deploys separate least-privilege identities for the application and migration job.'

import { ResourceTags } from '../types.bicep'

/* Common parameters */

@description('Azure region for managed identities.')
param location string

@description('Required ownership and cost-governance tags.')
param tags ResourceTags

/* Identity parameters */

@description('Application user-assigned managed identity name.')
param applicationIdentityName string

@description('Migration user-assigned managed identity name.')
param migrationIdentityName string

/* Resources */

resource applicationIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: applicationIdentityName
  location: location
  tags: tags
}

resource migrationIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: migrationIdentityName
  location: location
  tags: tags
}

/* Outputs */

@description('Application identity client ID.')
output applicationClientId string = applicationIdentity.properties.clientId

@description('Application identity principal ID.')
output applicationPrincipalId string = applicationIdentity.properties.principalId

@description('Application identity resource ID.')
output applicationResourceId string = applicationIdentity.id

@description('Migration identity client ID.')
output migrationClientId string = migrationIdentity.properties.clientId

@description('Migration identity principal ID.')
output migrationPrincipalId string = migrationIdentity.properties.principalId

@description('Migration identity resource ID.')
output migrationResourceId string = migrationIdentity.id