import { describe, expect, it } from 'vitest'
import { PinOutcome } from '../domain'
import { createMapMarkerMarkup } from './mapMarkerMarkup'

describe('createMapMarkerMarkup', () => {
  it('renders a solid outcome-coloured body without a default pulse', () => {
    const markup = createMapMarkerMarkup(PinOutcome.NotInterested)

    expect(markup).toContain('class="map-pin__body"')
    expect(markup).toContain('--marker-color:#EF4444')
    expect(markup).not.toContain('pulse')
  })
})
