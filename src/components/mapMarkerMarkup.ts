import type { PinOutcome } from '../domain'
import { pinOutcomeColor } from '../domain'

export function createMapMarkerMarkup(outcome: PinOutcome): string {
  const color = pinOutcomeColor(outcome)
  return `<span class="map-pin__body" style="--marker-color:${color}"><span class="map-pin__core" aria-hidden="true"></span></span>`
}
