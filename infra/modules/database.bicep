metadata name = 'Private PostgreSQL'
metadata description = 'Deploys a single private PostgreSQL 17 Flexible Server and application database.'

import { ResourceTags } from '../types.bicep'

/* Common parameters */

@description('Azure region for PostgreSQL resources.')
param location string

@description('Required ownership and cost-governance tags.')
param tags ResourceTags

/* Database parameters */

@description('PostgreSQL administrator login name.')
param administratorLogin string

@secure()
@description('PostgreSQL administrator password.')
param administratorPassword string

@description('Application database name.')
param databaseName string

@description('PostgreSQL private DNS zone resource ID.')
param privateDnsZoneId string

@description('PostgreSQL Flexible Server name.')
param serverName string

@description('PostgreSQL delegated subnet resource ID.')
param subnetId string

/* Resources */

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B2ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: subnetId
      privateDnsZoneArmResourceId: privateDnsZoneId
      publicNetworkAccess: 'Disabled'
    }
    storage: {
      autoGrow: 'Enabled'
      storageSizeGB: 32
    }
    version: '17'
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: server
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

/* Outputs */

@description('Application database name.')
output databaseName string = database.name

@description('PostgreSQL server fully qualified domain name.')
output fullyQualifiedDomainName string = server.properties.fullyQualifiedDomainName

@description('PostgreSQL server resource ID.')
output id string = server.id

@description('PostgreSQL server name.')
output name string = server.name