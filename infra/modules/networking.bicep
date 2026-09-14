metadata name = 'Private networking'
metadata description = 'Deploys the VNet, delegated subnets, and private DNS zones for the lean runtime.'

import { NetworkConfig, ResourceTags } from '../types.bicep'

/* Common parameters */

@description('Azure region for networking resources.')
param location string

@description('Required ownership and cost-governance tags.')
param tags ResourceTags

/* Networking parameters */

@description('CIDR and subnet naming configuration.')
param network NetworkConfig

@description('Virtual network name.')
param virtualNetworkName string

/* Variables */

var keyVaultPrivateDnsZoneName = 'privatelink.vaultcore.azure.net'
var postgresPrivateDnsZoneName = 'private.postgres.database.azure.com'

/* Resources */

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: virtualNetworkName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        network.virtualNetworkPrefix
      ]
    }
    // Keep subnet writes in one VNet operation to avoid AnotherOperationInProgress
    // and preserve the subnets when the foundation is redeployed.
    subnets: [
      {
        name: network.containerAppsSubnetName
        properties: {
          addressPrefix: network.containerAppsSubnetPrefix
          delegations: [
            {
              name: 'container-apps-environments'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: network.postgresSubnetName
        properties: {
          addressPrefix: network.postgresSubnetPrefix
          delegations: [
            {
              name: 'postgres-flexible-server'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
          serviceEndpoints: [
            {
              service: 'Microsoft.Storage'
            }
          ]
        }
      }
      {
        name: network.privateEndpointsSubnetName
        properties: {
          addressPrefix: network.privateEndpointsSubnetPrefix
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource containerAppsSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: virtualNetwork
  name: network.containerAppsSubnetName
}

resource postgresSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: virtualNetwork
  name: network.postgresSubnetName
}

resource privateEndpointsSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: virtualNetwork
  name: network.privateEndpointsSubnetName
}

resource keyVaultPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: keyVaultPrivateDnsZoneName
  location: 'global'
  tags: tags
}

resource keyVaultDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: keyVaultPrivateDnsZone
  name: '${virtualNetwork.name}-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetwork.id
    }
  }
}

resource postgresPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: postgresPrivateDnsZoneName
  location: 'global'
  tags: tags
}

resource postgresDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: postgresPrivateDnsZone
  name: '${virtualNetwork.name}-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetwork.id
    }
  }
}

/* Outputs */

@description('Container Apps delegated subnet resource ID.')
output containerAppsSubnetId string = containerAppsSubnet.id

@description('Key Vault private DNS zone name.')
output keyVaultPrivateDnsZoneName string = keyVaultPrivateDnsZone.name

@description('Key Vault private DNS zone resource ID.')
output keyVaultPrivateDnsZoneId string = keyVaultPrivateDnsZone.id

@description('PostgreSQL delegated subnet resource ID.')
output postgresSubnetId string = postgresSubnet.id

@description('PostgreSQL private DNS zone resource ID.')
output postgresPrivateDnsZoneId string = postgresPrivateDnsZone.id

@description('Private endpoints subnet resource ID.')
output privateEndpointsSubnetId string = privateEndpointsSubnet.id

@description('Virtual network resource ID.')
output virtualNetworkId string = virtualNetwork.id