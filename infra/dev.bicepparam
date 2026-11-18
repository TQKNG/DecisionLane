using './main.bicep'

param environmentName = 'dev'
param location = 'canadacentral'
param contentSafetyLocation = 'canadaeast'
param budgetEmail = 'khanhnguyen.trq@gmail.com'
param budgetStartDate = '2026-10-01T00:00:00Z'
// Adopts role assignments created on 2026-11-02 for the dev API and Function
// managed identities, so redeploys update them in place instead of deleting
// and recreating the grant (which would briefly revoke Foundry access).
param apiFoundryRoleAssignmentName = 'eafd6291-293c-47c1-a95a-1c08c31e13f2'
param functionFoundryRoleAssignmentName = '53c6e000-257b-4f1b-b591-5dda9cd49145'
