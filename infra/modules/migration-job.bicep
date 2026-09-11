metadata name = 'Database migration job'
metadata description = 'Deploys a manually triggered private job that applies ordered PostgreSQL migrations.'

import { ResourceTags } from '../types.bicep'

/* Common parameters */

@description('Azure region for the migration job.')
param location string

@description('Required ownership and cost-governance tags.')
param tags ResourceTags

/* Identity parameters */

@description('Migration user-assigned managed identity resource ID.')
param migrationIdentityId string

/* Job parameters */

@description('PostgreSQL application database name.')
param databaseName string

@description('PostgreSQL server fully qualified domain name.')
param databaseServerHost string

@description('PostgreSQL administrator login name.')
param databaseUser string

@description('Migration Container Apps job name.')
param jobName string

@minLength(71)
@maxLength(71)
@description('Migration image digest in sha256 form.')
param migrationImageDigest string

@description('Migration image repository path.')
param migrationImageRepository string

@description('Container Apps environment resource ID.')
param environmentId string

@description('Container registry login server.')
param registryLoginServer string

/* Security parameters */

@description('PostgreSQL administrator credential versioned Key Vault secret URI.')
param postgresAdminCredentialUri string

@description('PostgreSQL authenticator credential versioned Key Vault secret URI.')
param postgresGatewayCredentialUri string

/* Variables */

var migrationImage = '${registryLoginServer}/${migrationImageRepository}@${migrationImageDigest}'

/* Resources */

resource migrationJob 'Microsoft.App/jobs@2024-03-01' = {
  name: jobName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${migrationIdentityId}': {}
    }
  }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          identity: migrationIdentityId
          server: registryLoginServer
        }
      ]
      replicaRetryLimit: 1
      replicaTimeout: 600
      secrets: [
        {
          identity: migrationIdentityId
          keyVaultUrl: postgresAdminCredentialUri
          name: 'postgres-admin-credential'
        }
        {
          identity: migrationIdentityId
          keyVaultUrl: postgresGatewayCredentialUri
          name: 'postgres-gateway-credential'
        }
      ]
      triggerType: 'Manual'
    }
    template: {
      containers: [
        {
          name: 'migration'
          image: migrationImage
          env: [
            {
              name: 'PGDATABASE'
              value: databaseName
            }
            {
              name: 'PGHOST'
              value: databaseServerHost
            }
            {
              name: 'PGPASSWORD'
              secretRef: 'postgres-admin-credential'
            }
            {
              name: 'PGPORT'
              value: '5432'
            }
            {
              name: 'PGUSER'
              value: databaseUser
            }
            {
              name: 'REGISTER_AUTHENTICATOR_PASSWORD'
              secretRef: 'postgres-gateway-credential'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
    }
  }
}

/* Outputs */

@description('Migration job resource ID.')
output id string = migrationJob.id

@description('Migration job name.')
output name string = migrationJob.name