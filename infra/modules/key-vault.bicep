metadata name = 'Private Key Vault'
metadata description = 'Deploys private RBAC-enabled secret storage for the application and migration job.'

import { ResourceTags } from '../types.bicep'

/* Common parameters */

@description('Azure region for Key Vault and its private endpoint.')
param location string

@description('Required ownership and cost-governance tags.')
param tags ResourceTags

/* Identity parameters */

@description('Application managed identity principal ID.')
param applicationPrincipalId string

@description('Deployment service principal object ID.')
param deploymentPrincipalId string

@description('Migration managed identity principal ID.')
param migrationPrincipalId string

/* Networking parameters */

@description('Key Vault private DNS zone resource ID.')
param privateDnsZoneId string

@description('Private endpoints subnet resource ID.')
param privateEndpointSubnetId string

/* Monitoring parameters */

@description('Log Analytics workspace resource ID.')
param logAnalyticsWorkspaceId string

/* Security parameters */

@secure()
@description('Enterprise billing token used by the application.')
param enterpriseBillingToken string

@secure()
@description('Microsoft Entra application client secret used by Container Apps authentication.')
param entraClientSecret string

@secure()
@description('GitHub App client secret.')
param githubAppClientSecret string

@description('Key Vault name.')
param keyVaultName string

@secure()
@description('PostgreSQL administrator password.')
param postgresAdministratorPassword string

@secure()
@description('PostgreSQL authenticator password used by PostgREST.')
param postgresAuthenticatorPassword string

@secure()
@description('Active Register GitHub identity-to-role mapping as JSON.')
param registerAccessJson string

@secure()
@description('Active Register JWT signing secret.')
param registerJwtSecret string

@secure()
@description('Persistent session encryption and cookie-signing secret.')
param sessionSecret string

/* Database parameters */

@description('PostgreSQL application database name.')
param postgresDatabaseName string

@description('PostgreSQL server fully qualified domain name.')
param postgresFullyQualifiedDomainName string

/* Variables */

var keyVaultSecretsOfficerRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
)
var keyVaultSecretsUserRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '4633458b-17de-408a-b874-0445c86b69e6'
)
var postgrestDatabaseUri = 'postgres://register_authenticator:${uriComponent(postgresAuthenticatorPassword)}@${postgresFullyQualifiedDomainName}:5432/${postgresDatabaseName}?sslmode=require'

/* Resources */

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    enablePurgeProtection: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    publicNetworkAccess: 'Disabled'
    sku: {
      family: 'A'
      name: 'standard'
    }
    softDeleteRetentionInDays: 90
    tenantId: tenant().tenantId
  }
}

resource deploymentSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, deploymentPrincipalId, keyVaultSecretsOfficerRoleDefinitionId)
  scope: keyVault
  properties: {
    principalId: deploymentPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultSecretsOfficerRoleDefinitionId
  }
}

resource applicationSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, applicationPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  scope: keyVault
  properties: {
    principalId: applicationPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultSecretsUserRoleDefinitionId
  }
}

resource migrationSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, migrationPrincipalId, keyVaultSecretsUserRoleDefinitionId)
  scope: keyVault
  properties: {
    principalId: migrationPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultSecretsUserRoleDefinitionId
  }
}

resource githubAppClientSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'github-app-client-secret'
  properties: {
    attributes: {
      enabled: true
    }
    value: githubAppClientSecret
  }
  dependsOn: [
    deploymentSecretsOfficer
  ]
}

resource entraClientSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'entra-client-secret'
  properties: {
    attributes: {
      enabled: true
    }
    value: entraClientSecret
  }
  dependsOn: [
    deploymentSecretsOfficer
  ]
}

resource enterpriseBillingTokenResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'enterprise-billing-token'
  properties: {
    attributes: {
      enabled: true
    }
    value: enterpriseBillingToken
  }
  dependsOn: [
    deploymentSecretsOfficer
  ]
}

resource sessionSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'session-secret'
  properties: {
    attributes: {
      enabled: true
    }
    value: sessionSecret
  }
  dependsOn: [
    deploymentSecretsOfficer
  ]
}

resource registerJwtSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'register-jwt-secret'
  properties: {
    attributes: {
      enabled: true
    }
    value: registerJwtSecret
  }
  dependsOn: [
    deploymentSecretsOfficer
  ]
}

resource registerAccessJsonResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'register-access-json'
  properties: {
    attributes: {
      enabled: true
    }
    value: registerAccessJson
  }
  dependsOn: [
    deploymentSecretsOfficer
  ]
}

resource postgresAdministratorPasswordResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'postgres-administrator-password'
  properties: {
    attributes: {
      enabled: true
    }
    value: postgresAdministratorPassword
  }
  dependsOn: [
    deploymentSecretsOfficer
  ]
}

resource postgresAuthenticatorPasswordResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'postgres-authenticator-password'
  properties: {
    attributes: {
      enabled: true
    }
    value: postgresAuthenticatorPassword
  }
  dependsOn: [
    deploymentSecretsOfficer
  ]
}

resource postgrestDatabaseUriResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'postgrest-database-uri'
  properties: {
    attributes: {
      enabled: true
    }
    value: postgrestDatabaseUri
  }
  dependsOn: [
    deploymentSecretsOfficer
  ]
}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: '${keyVault.name}-pe'
  location: location
  tags: tags
  properties: {
    privateLinkServiceConnections: [
      {
        name: '${keyVault.name}-connection'
        properties: {
          groupIds: [
            'vault'
          ]
          privateLinkServiceId: keyVault.id
          requestMessage: 'Private access for the GHCP AI Credits Simulator runtime.'
        }
      }
    ]
    subnet: {
      id: privateEndpointSubnetId
    }
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'key-vault'
        properties: {
          privateDnsZoneId: privateDnsZoneId
        }
      }
    ]
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${keyVault.name}-diagnostics'
  scope: keyVault
  properties: {
    logs: [
      {
        categoryGroup: 'audit'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
    workspaceId: logAnalyticsWorkspaceId
  }
}

/* Outputs */

@description('Enterprise billing token versioned secret URI.')
output enterpriseBillingTokenUri string = enterpriseBillingTokenResource.properties.secretUriWithVersion

@description('Microsoft Entra client secret versioned URI.')
output entraClientSecretUri string = entraClientSecretResource.properties.secretUriWithVersion

@description('GitHub App client secret versioned URI.')
output githubAppClientSecretUri string = githubAppClientSecretResource.properties.secretUriWithVersion

@description('Key Vault resource ID.')
output id string = keyVault.id

@description('Key Vault name.')
output name string = keyVault.name

@description('PostgreSQL administrator credential versioned secret URI.')
output postgresAdminCredentialUri string = postgresAdministratorPasswordResource.properties.secretUriWithVersion

@description('PostgreSQL authenticator credential versioned secret URI.')
output postgresGatewayCredentialUri string = postgresAuthenticatorPasswordResource.properties.secretUriWithVersion

@description('PostgREST database URI versioned secret URI.')
output postgrestDatabaseUri string = postgrestDatabaseUriResource.properties.secretUriWithVersion

@description('Active Register access mapping versioned secret URI.')
output registerAccessJsonUri string = registerAccessJsonResource.properties.secretUriWithVersion

@description('Active Register JWT secret versioned URI.')
output registerJwtSecretUri string = registerJwtSecretResource.properties.secretUriWithVersion

@description('Session secret versioned URI.')
output sessionSecretUri string = sessionSecretResource.properties.secretUriWithVersion