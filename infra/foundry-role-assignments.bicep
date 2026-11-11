targetScope = 'resourceGroup'

@description('Existing Microsoft Foundry resource that hosts Content Understanding.')
param foundryResourceName string

@description('Managed identity principal ID for the API workload.')
param apiPrincipalId string

@description('Managed identity principal ID for the Durable Functions workload.')
param functionPrincipalId string

var cognitiveServicesUserRoleId = 'a97b65f3-24c7-4388-baec-2e347c3135b3'

resource foundry 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: foundryResourceName
}

resource apiRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundry.id, apiPrincipalId, cognitiveServicesUserRoleId)
  scope: foundry
  properties: {
    principalId: apiPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
  }
}

resource functionRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundry.id, functionPrincipalId, cognitiveServicesUserRoleId)
  scope: foundry
  properties: {
    principalId: functionPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
  }
}
