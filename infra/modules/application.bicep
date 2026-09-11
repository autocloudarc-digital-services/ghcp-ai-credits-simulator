metadata name = 'Application Container App'
metadata description = 'Deploys the public HTTPS application with a loopback-only PostgREST sidecar.'

import { ResourceTags, RuntimeConfig } from '../types.bicep'

/* Common parameters */

@description('Azure region for the Container App.')
param location string

@description('Required ownership and cost-governance tags.')
param tags ResourceTags

/* Identity parameters */

@description('Application user-assigned managed identity resource ID.')
param applicationIdentityId string

/* Container parameters */

@minLength(71)
@maxLength(71)
@description('Application image digest in sha256 form.')
param appImageDigest string

@description('Application image repository path.')
param appImageRepository string

@description('Container App name.')
param containerAppName string

@description('Container Apps environment default DNS domain.')
param environmentDefaultDomain string

@description('Container Apps environment resource ID.')
param environmentId string

@minLength(71)
@maxLength(71)
@description('PostgREST sidecar image digest in sha256 form.')
param postgrestImageDigest string

@description('PostgREST sidecar image repository path.')
param postgrestImageRepository string

@description('Container registry login server.')
param registryLoginServer string

@description('Non-secret application runtime configuration.')
param runtime RuntimeConfig

@description('Whether the Container App ingress is reachable outside its environment.')
param shouldEnableExternalIngress bool = false

/* Security parameters */

@description('Enterprise billing token versioned Key Vault secret URI.')
param enterpriseBillingTokenUri string

@description('Microsoft Entra client secret versioned Key Vault secret URI.')
param entraClientSecretUri string

@description('GitHub App client secret versioned Key Vault secret URI.')
param githubAppClientSecretUri string

@description('PostgREST database URI versioned Key Vault secret URI.')
param postgrestDatabaseUri string

@description('Active Register access mapping versioned Key Vault secret URI.')
param registerAccessJsonUri string

@description('Active Register JWT secret versioned Key Vault secret URI.')
param registerJwtSecretUri string

@description('Session secret versioned Key Vault secret URI.')
param sessionSecretUri string

/* Variables */

var appImage = '${registryLoginServer}/${appImageRepository}@${appImageDigest}'
var clientOrigin = 'https://${containerAppName}.${environmentDefaultDomain}'
var postgrestImage = '${registryLoginServer}/${postgrestImageRepository}@${postgrestImageDigest}'

/* Resources */

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${applicationIdentityId}': {}
    }
  }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        allowInsecure: false
        corsPolicy: {
          allowCredentials: true
          allowedHeaders: [
            'Content-Type'
            'X-CSRF-Token'
          ]
          allowedMethods: [
            'DELETE'
            'GET'
            'HEAD'
            'OPTIONS'
            'PATCH'
            'POST'
            'PUT'
          ]
          allowedOrigins: [
            clientOrigin
          ]
          exposeHeaders: []
          maxAge: 3600
        }
        external: shouldEnableExternalIngress
        targetPort: 3001
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
        transport: 'auto'
      }
      registries: [
        {
          identity: applicationIdentityId
          server: registryLoginServer
        }
      ]
      secrets: [
        {
          identity: applicationIdentityId
          keyVaultUrl: enterpriseBillingTokenUri
          name: 'enterprise-billing-token'
        }
        {
          identity: applicationIdentityId
          keyVaultUrl: entraClientSecretUri
          name: 'entra-client-secret'
        }
        {
          identity: applicationIdentityId
          keyVaultUrl: githubAppClientSecretUri
          name: 'github-app-client-secret'
        }
        {
          identity: applicationIdentityId
          keyVaultUrl: postgrestDatabaseUri
          name: 'postgrest-database-uri'
        }
        {
          identity: applicationIdentityId
          keyVaultUrl: registerAccessJsonUri
          name: 'register-access-json'
        }
        {
          identity: applicationIdentityId
          keyVaultUrl: registerJwtSecretUri
          name: 'register-jwt-secret'
        }
        {
          identity: applicationIdentityId
          keyVaultUrl: sessionSecretUri
          name: 'session-secret'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'app'
          image: appImage
          env: [
            {
              name: 'CALLBACK_URL'
              value: '${clientOrigin}/auth/github/callback'
            }
            {
              name: 'CLIENT_ORIGIN'
              value: clientOrigin
            }
            {
              name: 'GHCP_ENTERPRISE_BILLING_TOKEN'
              secretRef: 'enterprise-billing-token'
            }
            {
              name: 'GITHUB_APP_CLIENT_ID'
              value: runtime.githubAppClientId
            }
            {
              name: 'GITHUB_APP_CLIENT_SECRET'
              secretRef: 'github-app-client-secret'
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3001'
            }
            {
              name: 'REGISTER_ACCESS_JSON'
              secretRef: 'register-access-json'
            }
            {
              name: 'REGISTER_GATEWAY_URL'
              value: 'http://127.0.0.1:3000'
            }
            {
              name: 'REGISTER_JWT_SECRET'
              secretRef: 'register-jwt-secret'
            }
            {
              name: 'SESSION_SECRET'
              secretRef: 'session-secret'
            }
          ]
          probes: [
            {
              failureThreshold: 3
              httpGet: {
                path: '/healthz'
                port: 3001
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 5
              type: 'Liveness'
            }
            {
              failureThreshold: 3
              httpGet: {
                path: '/readyz'
                port: 3001
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 10
              timeoutSeconds: 5
              type: 'Readiness'
            }
            {
              failureThreshold: 30
              httpGet: {
                path: '/healthz'
                port: 3001
                scheme: 'HTTP'
              }
              initialDelaySeconds: 1
              periodSeconds: 2
              timeoutSeconds: 2
              type: 'Startup'
            }
          ]
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
        }
        {
          name: 'postgrest'
          image: postgrestImage
          env: [
            {
              name: 'PGRST_DB_MAX_ROWS'
              value: '10000'
            }
            {
              name: 'PGRST_DB_SCHEMAS'
              value: 'register'
            }
            {
              name: 'PGRST_DB_URI'
              secretRef: 'postgrest-database-uri'
            }
            {
              name: 'PGRST_JWT_SECRET'
              secretRef: 'register-jwt-secret'
            }
            {
              name: 'PGRST_SERVER_HOST'
              value: '127.0.0.1'
            }
            {
              name: 'PGRST_SERVER_PORT'
              value: '3000'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        maxReplicas: 1
        minReplicas: 1
      }
      terminationGracePeriodSeconds: 30
    }
  }
}

resource authConfig 'Microsoft.App/containerApps/authConfigs@2025-01-01' = {
  parent: containerApp
  name: 'current'
  properties: {
    globalValidation: {
      excludedPaths: [
        '/healthz'
        '/readyz'
      ]
      redirectToProvider: 'azureActiveDirectory'
      unauthenticatedClientAction: 'RedirectToLoginPage'
    }
    httpSettings: {
      requireHttps: true
      routes: {
        apiPrefix: '/.auth'
      }
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: runtime.entraClientId
          clientSecretSettingName: 'entra-client-secret'
          openIdIssuer: '${environment().authentication.loginEndpoint}${tenant().tenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [
            runtime.entraClientId
          ]
          defaultAuthorizationPolicy: {
            allowedPrincipals: {
              groups: [
                runtime.entraAllowedGroupObjectId
              ]
            }
          }
        }
      }
    }
    login: {
      tokenStore: {
        enabled: false
      }
    }
    platform: {
      enabled: true
    }
  }
}

/* Outputs */

@description('Container App public HTTPS origin.')
output clientOrigin string = clientOrigin

@description('Container App fully qualified domain name.')
output fullyQualifiedDomainName string = containerApp.properties.configuration.ingress.fqdn

@description('Container App resource ID.')
output id string = containerApp.id

@description('Container App name.')
output name string = containerApp.name