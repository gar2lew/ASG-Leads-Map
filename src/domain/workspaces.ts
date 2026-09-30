import { hasCapability, isValidRole, type Capability, type CurrentUser } from './roles'

export type WorkspaceId = 'map' | 'import' | 'contacts'

export interface WorkspaceDefinition {
  id: WorkspaceId
  title: string
  description: string
  landingRoute: string
  requiredCapability: Capability
}

const WORKSPACES: WorkspaceDefinition[] = [
  {
    id: 'map',
    title: 'Field Map',
    description: 'View leads and manage field activity on the map.',
    landingRoute: '/map',
    requiredCapability: 'map:view',
  },
  {
    id: 'import',
    title: 'Import',
    description: 'Import leads from a workbook.',
    landingRoute: '/admin/import',
    requiredCapability: 'users:manage',
  },
  {
    id: 'contacts',
    title: 'Call Centre',
    description: 'View and follow up contacts in the call log.',
    landingRoute: '/calls',
    requiredCapability: 'map:view',
  },
]

export function getAvailableWorkspaces(user: CurrentUser | null | undefined): WorkspaceDefinition[] {
  if (!user || user.active !== true || !isValidRole(user.role)) return []
  return WORKSPACES.filter((workspace) => hasCapability(user.role, workspace.requiredCapability))
}

export const DEFAULT_WORKSPACE_STORAGE_KEY = 'asg-default-workspace'

export function getDefaultWorkspaceRoute(user: CurrentUser | null | undefined, savedWorkspace?: string | null): string {
  const selected = getAvailableWorkspaces(user).find(
    (workspace) => workspace.id !== 'import' && workspace.id === savedWorkspace,
  )
  return selected?.landingRoute ?? '/map'
}
