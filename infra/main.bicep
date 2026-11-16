targetScope = 'resourceGroup'

@description('Short environment name.')
param environmentName string = 'dev'

@description('Cosmos DB region.')
param cosmosLocation string = 'canadaeast'

@description('Primary application region.')
param location string = 'canadacentral'

@description('Content Safety region.')
param contentSafetyLocation string = 'canadaeast'

@description('Initial public image used before the API image is pushed.')
param bootstrapImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Address that receives Azure budget notifications.')
param budgetEmail string

@description('First day of the current billing month in UTC.')
param budgetStartDate string

@description('Resource group containing the existing Microsoft Foundry resource.')
param foundryResourceGroup string = 'rg-foundry-models'

@description('Existing Microsoft Foundry resource that hosts Content Understanding.')
param foundryResourceName string = 'fd-resource-dev'

@description('Content Understanding document analyzer identifier.')
param contentUnderstandingDocumentAnalyzerId string = 'refund_evidence_document_classifier'

@description('Content Understanding image analyzer identifier.')
param contentUnderstandingImageAnalyzerId string = 'refund_evidence_image_classifier'

@description('Production Content Understanding API version.')
param contentUnderstandingApiVersion string = '2025-11-01'

@description('Local frontend origin allowed to upload evidence directly to Blob Storage in the dev environment.')
param localFrontendOrigin string = 'http://localhost:3000'

var token = toLower(uniqueString(subscription().id, resourceGroup().id))
var prefix = 'refundflow-${environmentName}'
var storageName = take(replace('st${prefix}${token}', '-', ''), 24)
var cosmosName = take('${prefix}-cosmos-${token}', 44)
var keyVaultName = take('${prefix}-kv-${token}', 24)
var acrName = take(replace('${prefix}acr${token}', '-', ''), 50)
var appName = '${prefix}-api'
var functionName = take('${prefix}-workflow-${token}', 60)
var deploymentContainerName = 'function-releases'

resource foundry 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: foundryResourceName
  scope: resourceGroup(foundryResourceGroup)
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${prefix}-appi'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    DisableLocalAuth: false
    RetentionInDays: 30
  }
}

resource costActionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: '${prefix}-cost-alerts'
  location: 'global'
  properties: {
    groupShortName: 'RefundCost'
    enabled: true
    emailReceivers: [
      {
        name: 'Owner'
        emailAddress: budgetEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

resource monthlyBudget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: '${prefix}-monthly-budget'
  properties: {
    amount: 50
    category: 'Cost'
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: budgetStartDate
      endDate: '2035-12-31T00:00:00Z'
    }
    notifications: {
      Actual50: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: [budgetEmail]
        contactGroups: [costActionGroup.id]
        contactRoles: []
      }
      Actual70: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 70
        thresholdType: 'Actual'
        contactEmails: [budgetEmail]
        contactGroups: [costActionGroup.id]
        contactRoles: []
      }
      Actual90: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 90
        thresholdType: 'Actual'
        contactEmails: [budgetEmail]
        contactGroups: [costActionGroup.id]
        contactRoles: []
      }
      Actual100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: [budgetEmail]
        contactGroups: [costActionGroup.id]
        contactRoles: []
      }
      Forecast90: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 90
        thresholdType: 'Forecasted'
        contactEmails: [budgetEmail]
        contactGroups: [costActionGroup.id]
        contactRoles: []
      }
    }
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    // Browsers upload evidence directly to quarantine with a short-lived grant from the API.
    cors: {
      corsRules: [
        {
          allowedOrigins: concat(environmentName == 'dev' ? [localFrontendOrigin] : [], ['https://${frontend.properties.defaultHostname}'])
          allowedMethods: ['PUT', 'OPTIONS']
          allowedHeaders: ['content-type', 'x-ms-blob-type', 'x-ms-version', 'x-ms-client-request-id']
          exposedHeaders: ['x-ms-request-id', 'etag']
          maxAgeInSeconds: 3600
        }
      ]
    }
  }
}

resource quarantine 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'quarantine'
  properties: {
    publicAccess: 'None'
  }
}

resource evidence 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'evidence'
  properties: {
    publicAccess: 'None'
  }
}

resource functionReleases 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource notificationQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  name: '${storage.name}/default/notifications'
}

resource defenderForStorage 'Microsoft.Security/defenderForStorageSettings@2022-12-01-preview' = {
  scope: storage
  name: 'current'
  properties: {
    isEnabled: true
    overrideSubscriptionLevelSettings: true
    malwareScanning: {
      onUpload: {
        isEnabled: true
        capGBPerMonth: 1
      }
    }
    sensitiveDataDiscovery: {
      isEnabled: false
    }
  }
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: cosmosName
  location: cosmosLocation
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: cosmosLocation
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    publicNetworkAccess: 'Enabled'
    minimalTlsVersion: 'Tls12'
    disableLocalAuth: true
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmos
  name: 'refundflow'
  properties: {
    resource: {
      id: 'refundflow'
    }
  }
}

var containerDefinitions = [
  {
    name: 'claims'
    partitionKey: '/claim_id'
  }
  {
    name: 'work_items'
    partitionKey: '/queue_type'
  }
  {
    name: 'users'
    partitionKey: '/user_id'
  }
  {
    name: 'orders'
    partitionKey: '/customer_id'
  }
  {
    name: 'system'
    partitionKey: '/document_type'
  }
]

resource containers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = [for definition in containerDefinitions: {
  parent: database
  name: definition.name
  properties: {
    resource: {
      id: definition.name
      partitionKey: {
        paths: [definition.partitionKey]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/payload/raw_text/?'
          }
        ]
      }
    }
  }
}]

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    sku: {
      family: 'A'
      name: 'standard'
    }
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource contentSafety 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${prefix}-safety-${token}'
  location: contentSafetyLocation
  kind: 'ContentSafety'
  sku: {
    name: 'F0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: '${prefix}-safety-${token}'
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

resource documentIntelligence 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${prefix}-docs-${token}'
  location: location
  kind: 'FormRecognizer'
  sku: {
    name: 'F0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: '${prefix}-docs-${token}'
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${prefix}-email-${token}'
  location: 'global'
  properties: {
    dataLocation: 'United States'
  }
}

resource emailDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
  }
}

resource communicationService 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: '${prefix}-acs-${token}'
  location: 'global'
  properties: {
    dataLocation: 'United States'
    linkedDomains: [
      emailDomain.id
    ]
  }
}

resource containerEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-aca'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: listKeys(logAnalytics.id, '2023-09-01').primarySharedKey
      }
    }
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerEnvironment.id
    configuration: {
      activeRevisionsMode: 'Multiple'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
    }
    template: {
      containers: [
        {
          name: 'api'
          image: bootstrapImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'APP_ENV', value: environmentName }
            { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
            { name: 'COSMOS_DATABASE', value: 'refundflow' }
            { name: 'STORAGE_ACCOUNT_NAME', value: storage.name }
            { name: 'STORAGE_ACCOUNT_URL', value: storage.properties.primaryEndpoints.blob }
            { name: 'CONTENT_SAFETY_ENDPOINT', value: contentSafety.properties.endpoint }
            { name: 'DOCUMENT_INTELLIGENCE_ENDPOINT', value: documentIntelligence.properties.endpoint }
            { name: 'CONTENT_UNDERSTANDING_ENDPOINT', value: foundry.properties.endpoint }
            { name: 'CONTENT_UNDERSTANDING_DOCUMENT_ANALYZER_ID', value: contentUnderstandingDocumentAnalyzerId }
            { name: 'CONTENT_UNDERSTANDING_IMAGE_ANALYZER_ID', value: contentUnderstandingImageAnalyzerId }
            { name: 'CONTENT_UNDERSTANDING_API_VERSION', value: contentUnderstandingApiVersion }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
            { name: 'ENABLE_INSTRUMENTATION', value: 'true' }
            { name: 'ENABLE_SENSITIVE_DATA', value: 'false' }
            { name: 'AZURE_TRACING_GEN_AI_CONTENT_RECORDING_ENABLED', value: 'false' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health/live'
                port: 8000
              }
              initialDelaySeconds: 15
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health/ready'
                port: 8000
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
  }
}

resource functionPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-flex'
  location: location
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: functionPlan.id
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: {
            type: 'StorageAccountConnectionString'
            storageAccountConnectionStringName: 'AzureWebJobsStorage'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 40
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'python'
        version: '3.11'
      }
    }
    siteConfig: {
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${listKeys(storage.id, storage.apiVersion).keys[0].value};EndpointSuffix=${environment().suffixes.storage}' }
        { name: 'AzureWebJobsStorage__accountName', value: storage.name }
        { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
        { name: 'COSMOS_DATABASE', value: 'refundflow' }
        { name: 'STORAGE_ACCOUNT_NAME', value: storage.name }
        { name: 'STORAGE_ACCOUNT_URL', value: storage.properties.primaryEndpoints.blob }
        { name: 'CONTENT_SAFETY_ENDPOINT', value: contentSafety.properties.endpoint }
        { name: 'DOCUMENT_INTELLIGENCE_ENDPOINT', value: documentIntelligence.properties.endpoint }
        { name: 'CONTENT_UNDERSTANDING_ENDPOINT', value: foundry.properties.endpoint }
        { name: 'CONTENT_UNDERSTANDING_DOCUMENT_ANALYZER_ID', value: contentUnderstandingDocumentAnalyzerId }
        { name: 'CONTENT_UNDERSTANDING_IMAGE_ANALYZER_ID', value: contentUnderstandingImageAnalyzerId }
        { name: 'CONTENT_UNDERSTANDING_API_VERSION', value: contentUnderstandingApiVersion }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'ENABLE_INSTRUMENTATION', value: 'true' }
        { name: 'ENABLE_SENSITIVE_DATA', value: 'false' }
      ]
    }
  }
}

module foundryRoleAssignments 'foundry-role-assignments.bicep' = {
  name: 'foundry-rbac-${token}'
  scope: resourceGroup(foundryResourceGroup)
  params: {
    foundryResourceName: foundryResourceName
    apiPrincipalId: api.identity.principalId
    functionPrincipalId: functionApp.identity.principalId
  }
}

resource frontend 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${prefix}-web'
  location: 'centralus'
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
  }
}

output storageAccountName string = storage.name
output storageAccountUrl string = storage.properties.primaryEndpoints.blob
output cosmosEndpoint string = cosmos.properties.documentEndpoint
output keyVaultName string = keyVault.name
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output apiName string = api.name
output apiPrincipalId string = api.identity.principalId
output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
output functionAppName string = functionApp.name
output functionPrincipalId string = functionApp.identity.principalId
output contentSafetyName string = contentSafety.name
output contentSafetyEndpoint string = contentSafety.properties.endpoint
output documentIntelligenceName string = documentIntelligence.name
output documentIntelligenceEndpoint string = documentIntelligence.properties.endpoint
output appInsightsName string = appInsights.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output staticWebAppName string = frontend.name
output communicationServiceName string = communicationService.name
output communicationServiceEndpoint string = 'https://${communicationService.name}.communication.azure.com'
output emailServiceName string = emailService.name
