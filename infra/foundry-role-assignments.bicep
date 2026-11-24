targetScope = 'resourceGroup'

@description('Existing Microsoft Foundry resource that hosts Content Understanding.')
param foundryResourceName string

@description('Managed identity principal ID for the API workload.')
param apiPrincipalId string

@description('Managed identity principal ID for the Durable Functions workload.')
param functionPrincipalId string

@description('Service principal object ID for the weekly Foundry evaluation workflow.')
param evaluationPrincipalId string = ''

@description('Name of a pre-existing role assignment granting the API identity Cognitive Services User on the Foundry resource. Set this to adopt an assignment created outside this template instead of creating a new one, so redeploys update it in place rather than deleting and recreating it (which would briefly revoke access the running app has no retry logic for). Leave empty to let Bicep compute a deterministic name for a fresh assignment.')
param apiRoleAssignmentName string = ''

@description('Name of a pre-existing role assignment granting the Function identity Cognitive Services User on the Foundry resource. Same adoption behavior as apiRoleAssignmentName.')
param functionRoleAssignmentName string = ''

var cognitiveServicesUserRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908'

resource foundry 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: foundryResourceName
}

resource apiRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: empty(apiRoleAssignmentName) ? guid(foundry.id, apiPrincipalId, cognitiveServicesUserRoleId) : apiRoleAssignmentName
  scope: foundry
  properties: {
    principalId: apiPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
  }
}

resource functionRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: empty(functionRoleAssignmentName) ? guid(foundry.id, functionPrincipalId, cognitiveServicesUserRoleId) : functionRoleAssignmentName
  scope: foundry
  properties: {
    principalId: functionPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
  }
}

resource evaluationRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(evaluationPrincipalId)) {
  name: guid(foundry.id, evaluationPrincipalId, cognitiveServicesUserRoleId)
  scope: foundry
  properties: {
    principalId: evaluationPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesUserRoleId)
  }
}
