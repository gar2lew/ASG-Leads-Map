import type { Pin } from '../domain/pin'

/**
 * Lead integration boundary.
 *
 * Intended pipeline (future):
 *
 *   Lead saved
 *     -> Lead persistence succeeds
 *     -> submitLeadIntegration(...)
 *     -> Jotform
 *     -> existing leads spreadsheet automation
 *
 * Status: prepared but not connected.
 * Jotform submission is NOT yet implemented and is deliberately not faked.
 */

const integrationStatus = { configured: false }

export function isLeadIntegrationConfigured(): boolean {
  return integrationStatus.configured
}

/**
 * Submit a saved Lead pin to the external lead integration.
 *
 * Currently throws whenever it is invoked so callers never get a fake
 * success signal. Wire this after persistence once a Jotform integration
 * exists.
 */
export async function submitLead(_pin: Pin): Promise<void> {
  if (!integrationStatus.configured) {
    throw new Error('Lead integration not configured. Jotform submission is not yet implemented.')
  }
  throw new Error('Lead integration not implemented.')
}