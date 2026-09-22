import type { AuthService, UserAdminService } from '../types'
import { createDevAuthService } from './devAuthService'
import { createFirebaseAuthService } from './firebaseAuthService'
import { createDevUserAdminService } from './devUserAdminService'
import { createFirebaseUserAdminService } from './firebaseUserAdminService'

/**
 * Selects the auth implementation.
 *
 * The dev harness is an isolated in-memory stand-in (localStorage-sessioned).
 * It is opt-in for production testing via VITE_USE_DEV_AUTH=true and must not
 * be enabled on a real production rollout.
 */
function shouldUseDevHarness(): boolean {
  return import.meta.env['VITE_USE_DEV_AUTH'] === 'true' || (import.meta.env.DEV && import.meta.env['VITE_USE_DEV_AUTH'] !== 'false')
}

export function isDevAuthActive(): boolean {
  return shouldUseDevHarness()
}

let authService: AuthService | null = null

export function getAuthService(): AuthService {
  if (!authService) {
    authService = shouldUseDevHarness() ? createDevAuthService() : createFirebaseAuthService()
  }
  return authService
}

let userAdminService: UserAdminService | null = null

export function getUserAdminService(): UserAdminService {
  if (!userAdminService) {
    if (shouldUseDevHarness()) {
      userAdminService = createDevUserAdminService()
    } else {
      userAdminService = createFirebaseUserAdminService(() => getAuthService().getAccessToken())
    }
  }
  return userAdminService
}
