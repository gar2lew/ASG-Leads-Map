import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PinModal } from './PinModal'
import { PinOutcome, reverseGeocode, canCompleteManualHouseNumber } from '../domain'
import type { GeocodingResult, GeocodingComponents } from '../domain'

vi.mock('../domain', async () => {
  const actual = await vi.importActual<typeof import('../domain')>('../domain')
  return {
    ...actual,
    reverseGeocode: vi.fn(() => Promise.resolve({ address: '42 Smith Street, Joondalup WA 6027' })),
  }
})

const COORDS = { latitude: -31.9523, longitude: 115.8613 }

interface SavedPayload {
  outcome?: string
  contactName?: string
  contactPhone?: string
}

function savedPayload(onSave: ReturnType<typeof vi.fn>): SavedPayload | undefined {
  return onSave.mock.calls[0]?.[0] as SavedPayload | undefined
}

async function openModal(onSave: (data: unknown) => void) {
  const user = userEvent.setup()
  render(
    <PinModal
      isOpen
      onClose={vi.fn()}
      onSave={onSave}
      initialCoordinates={COORDS}
    />
  )
  const dialog = await screen.findByRole('dialog', { name: /add property visit/i })
  await waitFor(() => {
    expect(within(dialog).getByLabelText(/^property address \*/i)).toHaveValue('42 Smith Street, Joondalup WA 6027')
  })
  return { user, dialog }
}

describe('PinModal - outcome-specific contact fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses a responsive sheet surface while preserving accessible actions', async () => {
    const { dialog } = await openModal(vi.fn())

    expect(dialog.querySelector('.pin-modal__sheet')).toBeInTheDocument()
    expect(dialog.querySelector('.pin-modal__sheet')).toHaveClass('surface--light')
    expect(within(dialog).getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /save pin/i })).toBeInTheDocument()
  })

  it('hides contact fields and shows Save Pin for non-Lead outcomes', async () => {
    const onSave = vi.fn()
    const { dialog } = await openModal(onSave)

    expect(within(dialog).queryByLabelText(/^name \*$/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/^mobile \*$/i)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /save pin/i })).toBeInTheDocument()
  })

  it('shows Lead Details and Save Lead when Lead is selected', async () => {
    const onSave = vi.fn()
    const { dialog, user } = await openModal(onSave)

    const leadOption = within(dialog).getByLabelText(/^lead$/i)
    await user.click(leadOption)

    expect(within(dialog).getByLabelText(/^name \*$/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^mobile \*$/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /save lead/i })).toBeInTheDocument()
  })

  it('requires name and a valid Australian mobile before a Lead can be saved', async () => {
    const onSave = vi.fn()
    const { dialog } = await openModal(onSave)
    const user = userEvent.setup()

    const leadOption = within(dialog).getByLabelText(/^lead$/i)
    await user.click(leadOption)

    const checkbox = within(dialog).getByLabelText(/^i confirm this is the correct property address$/i)
    await user.click(checkbox)

    const submitButton = within(dialog).getByRole('button', { name: /save lead/i })
    expect(submitButton).toBeDisabled()

    const nameInput = within(dialog).getByLabelText(/^name \*$/i)
    await user.type(nameInput, 'Jane Doe')
    expect(submitButton).toBeDisabled()

    const mobileInput = within(dialog).getByLabelText(/^mobile \*$/i)
    await user.type(mobileInput, '02 1234 5678')
    expect(submitButton).toBeDisabled()

    fireEvent.change(mobileInput, { target: { value: '0412 345 678' } })
    expect(submitButton).toBeEnabled()

    await user.click(submitButton)
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })
    const saved = savedPayload(onSave)
    expect(saved?.outcome).toBe(PinOutcome.Lead)
    expect(saved?.contactName).toBe('Jane Doe')
    expect(saved?.contactPhone).toBe('0412 345 678')
  })

  it('does not require contact details for non-Lead outcomes', async () => {
    const onSave = vi.fn()
    const { dialog } = await openModal(onSave)
    const user = userEvent.setup()

    const checkbox = within(dialog).getByLabelText(/^i confirm this is the correct property address$/i)
    await user.click(checkbox)

    const submitButton = within(dialog).getByRole('button', { name: /save pin/i })
    expect(submitButton).toBeEnabled()

    await user.click(submitButton)
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })
    const saved = savedPayload(onSave)
    expect(saved?.outcome).toBe(PinOutcome.NotKnocked)
    expect(saved?.contactName).toBeUndefined()
  })

  it('retains typed contact data when switching away from and back to Lead', async () => {
    const onSave = vi.fn()
    const { dialog, user } = await openModal(onSave)

    const leadOption = within(dialog).getByLabelText(/^lead$/i)
    await user.click(leadOption)

    const nameInput = within(dialog).getByLabelText(/^name \*$/i)
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } })
    expect(nameInput).toHaveValue('Jane Doe')

    const knockedOption = within(dialog).getByLabelText(/^knocked$/i)
    await user.click(knockedOption)

    expect(within(dialog).queryByLabelText(/^name \*$/i)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /save pin/i })).toBeInTheDocument()

    await user.click(within(dialog).getByLabelText(/^lead$/i))
    expect(within(dialog).getByLabelText(/^name \*$/i)).toHaveValue('Jane Doe')
  })

  it('shows Save Changes when editing an existing pin', async () => {
    const onSave = vi.fn()
    render(
      <PinModal
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        initialPin={{
          id: 'pin-1',
          latitude: COORDS.latitude,
          longitude: COORDS.longitude,
          outcome: PinOutcome.Knocked,
          address: '42 Smith Street, Joondalup WA 6027',
          notes: undefined,
          contactName: undefined,
          contactPhone: undefined,
          contactEmail: undefined,
          createdBy: 'dev-admin',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          synced: false,
          syncAttempts: 0,
        }}
      />
    )
    const dialog = await screen.findByRole('dialog', { name: /edit visit/i })
    expect(within(dialog).getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })
})

describe('PinModal - Property Address Resolution', () => {
  const baseResult: GeocodingResult = {
    address: '17 Melba Place, Westminster, WA, 6061',
    houseNumber: '17',
    street: 'Melba Place',
    suburb: 'Westminster',
    state: 'WA',
    postcode: '6061',
    latitude: COORDS.latitude,
    longitude: COORDS.longitude,
    source: 'direct_reverse',
    confidence: 'direct',
  }

  const directResult: GeocodingResult = { ...baseResult }

  const suggestedResult: GeocodingResult = {
    ...baseResult,
    source: 'nearby_osm',
    confidence: 'nearby_suggested',
    nearbyDistance: 12,
  }

  const highResult: GeocodingResult = {
    ...baseResult,
    source: 'nearby_osm',
    confidence: 'nearby_high',
    nearbyDistance: 6,
  }

  const manualComponents: GeocodingComponents = {
    road: 'Melba Place',
    suburb: 'Westminster',
    city: 'Westminster',
    state: 'WA',
    postcode: '6061',
    country: 'Australia',
  }

  const manualResult: GeocodingResult = {
    ...baseResult,
    houseNumber: undefined,
    address: 'Melba Place, Westminster, WA, 6061',
    components: manualComponents,
    source: 'manual',
    confidence: 'manual',
  }

  const manualNoPostcodeResult: GeocodingResult = {
    ...baseResult,
    houseNumber: undefined,
    address: 'Melba Place, Westminster, WA',
    components: { road: 'Melba Place', suburb: 'Westminster', state: 'WA', country: 'Australia' },
    source: 'manual',
    confidence: 'manual',
  }

  const defaultMockImplementation = () =>
    Promise.resolve({ address: '42 Smith Street, Joondalup WA 6027' } as GeocodingResult)

  beforeEach(() => {
    vi.mocked(reverseGeocode).mockReset()
    vi.mocked(reverseGeocode).mockImplementation(defaultMockImplementation)
  })

  afterEach(() => {
    vi.mocked(reverseGeocode).mockImplementation(defaultMockImplementation)
  })

  async function renderWithResult(result: GeocodingResult, onSave = vi.fn()) {
    vi.mocked(reverseGeocode).mockImplementation(() => Promise.resolve(result))
    const user = userEvent.setup()
    render(
      <PinModal isOpen onClose={vi.fn()} onSave={onSave} initialCoordinates={COORDS} />
    )
    const dialog = await screen.findByRole('dialog', { name: /add property visit/i })
    const isFallback = canCompleteManualHouseNumber(result.components)
    await waitFor(() => {
      if (isFallback) {
        expect(within(dialog).getByLabelText(/^house number$/i)).toBeInTheDocument()
      } else {
        expect(within(dialog).getByLabelText(/^property address \*/i)).toHaveValue(result.address)
      }
    })
    return { user, dialog, onSave }
  }

  it('populates the field with the detected house number for a direct result', async () => {
    const { dialog } = await renderWithResult(directResult)

    expect(within(dialog).getByLabelText(/^property address \*/i)).toHaveValue('17 Melba Place, Westminster, WA, 6061')
    expect(within(dialog).getByText(/automatically detected from pin location/i)).toBeInTheDocument()
  })

  it('renders the suggested-property helper text for a nearby_suggested result', async () => {
    const { dialog } = await renderWithResult(suggestedResult)

    expect(within(dialog).getByText(/suggested nearby property/i)).toBeInTheDocument()
    expect(within(dialog).queryByText(/automatically detected from pin location/i)).not.toBeInTheDocument()
  })

  it('renders the auto-detected helper text for a nearby_high result', async () => {
    const { dialog } = await renderWithResult(highResult)

    expect(within(dialog).getByText(/automatically detected from pin location/i)).toBeInTheDocument()
    expect(within(dialog).queryByText(/suggested nearby property/i)).not.toBeInTheDocument()
  })

  it('allows manual entry when no house number could be identified', async () => {
    const { dialog, user, onSave } = await renderWithResult(manualResult)

    expect(within(dialog).getByText(/house number could not be identified/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /edit full address/i }))

    const addressInput = within(dialog).getByLabelText(/^property address \*/i)
    expect(addressInput).not.toBeDisabled()
    expect(addressInput).toHaveValue('Melba Place, Westminster, WA, 6061')

    await user.clear(addressInput)
    await user.type(addressInput, '17A Melba Place, Westminster WA 6061')
    expect(addressInput).toHaveValue('17A Melba Place, Westminster WA 6061')

    const checkbox = within(dialog).getByLabelText(/^i confirm this is the correct property address$/i)
    await user.click(checkbox)
    await user.click(within(dialog).getByLabelText(/^knocked$/i))
    expect(within(dialog).getByRole('button', { name: /save pin/i })).toBeEnabled()

    await user.click(within(dialog).getByRole('button', { name: /save pin/i }))
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })
    expect((onSave.mock.calls[0]?.[0] as any)?.address).toBe('17A Melba Place, Westminster WA 6061')
  })

  it('shows the house-number fallback when only the number is missing', async () => {
    const { dialog } = await renderWithResult(manualResult)

    expect(within(dialog).getByLabelText(/^house number$/i)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/^property address \*/i)).not.toBeInTheDocument()
    expect(within(dialog).getByText(/melba place/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/westminster wa 6061/i)).toBeInTheDocument()
  })

  it('composes the full address from the house number and saves it', async () => {
    const { dialog, user, onSave } = await renderWithResult(manualResult)

    const houseNumberInput = within(dialog).getByLabelText(/^house number$/i)
    await user.type(houseNumberInput, '17')
    expect(within(dialog).getByText(/composed address: 17 melba place, westminster, wa, 6061/i)).toBeInTheDocument()

    const checkbox = within(dialog).getByLabelText(/^i confirm this is the correct property address$/i)
    await user.click(checkbox)
    await user.click(within(dialog).getByLabelText(/^knocked$/i))
    await user.click(within(dialog).getByRole('button', { name: /save pin/i }))
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })
    expect((onSave.mock.calls[0]?.[0] as any)?.address).toBe('17 Melba Place, Westminster, WA, 6061')
  })

  it.each([
    ['17A', '17A'],
    ['17-19', '17-19'],
    ['2/154', '2/154'],
  ])('preserves unit/alphanumeric house number %s', async (input, expected) => {
    const { dialog, user } = await renderWithResult(manualResult)

    const houseNumberInput = within(dialog).getByLabelText(/^house number$/i)
    await user.type(houseNumberInput, input)
    expect(within(dialog).getByText(new RegExp(`composed address: ${expected} melba place`, 'i'))).toBeInTheDocument()
  })

  it('resets confirmation when the house number changes after confirming', async () => {
    const { dialog, user } = await renderWithResult(manualResult)

    const houseNumberInput = within(dialog).getByLabelText(/^house number$/i)
    await user.type(houseNumberInput, '17')

    const checkbox = within(dialog).getByLabelText(/^i confirm this is the correct property address$/i)
    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    await user.clear(houseNumberInput)
    await user.type(houseNumberInput, '19')

    expect(checkbox).not.toBeChecked()
    expect(within(dialog).getByRole('button', { name: /save pin/i })).toBeDisabled()
  })

  it('does not show the house-number fallback for a direct result', async () => {
    const { dialog } = await renderWithResult(directResult)

    expect(within(dialog).queryByLabelText(/^house number$/i)).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^property address \*/i)).toHaveValue('17 Melba Place, Westminster, WA, 6061')
  })

  it('does not show the house-number fallback for a nearby-suggested result', async () => {
    const { dialog } = await renderWithResult(suggestedResult)

    expect(within(dialog).queryByLabelText(/^house number$/i)).not.toBeInTheDocument()
    expect(within(dialog).getByText(/suggested nearby property/i)).toBeInTheDocument()
  })

  it('keeps the full address input when needed components are unavailable', async () => {
    const { dialog } = await renderWithResult(manualNoPostcodeResult)

    expect(within(dialog).queryByLabelText(/^house number$/i)).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^property address \*/i)).toHaveValue('Melba Place, Westminster, WA')
    expect(within(dialog).getByText(/house number could not be identified/i)).toBeInTheDocument()
  })

  it('never auto-confirms a high-confidence result', async () => {
    const { dialog } = await renderWithResult(highResult)

    const checkbox = within(dialog).getByLabelText(/^i confirm this is the correct property address$/i)
    expect(checkbox).not.toBeChecked()
    expect(within(dialog).getByRole('button', { name: /save pin/i })).toBeDisabled()
  })

  it('resets confirmation when a detected address is edited', async () => {
    const { dialog, user } = await renderWithResult(directResult)

    const checkbox = within(dialog).getByLabelText(/^i confirm this is the correct property address$/i)
    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    const addressInput = within(dialog).getByLabelText(/^property address \*/i)
    await user.clear(addressInput)
    await user.type(addressInput, '17A Melba Place, Westminster WA 6061')

    expect(checkbox).not.toBeChecked()
    expect(within(dialog).getByRole('button', { name: /save pin/i })).toBeDisabled()
  })

  it('does not let a stale geocode overwrite a newer pin', async () => {
    let resolveFirst: (value: GeocodingResult) => void = () => {}
    let resolveSecond: (value: GeocodingResult) => void = () => {}

    vi.mocked(reverseGeocode)
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r }))

    const onSave = vi.fn()
    const { rerender } = render(
      <PinModal
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        initialCoordinates={{ latitude: -31.9505, longitude: 115.8605 }}
      />
    )
    rerender(
      <PinModal
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        initialCoordinates={{ latitude: -31.96, longitude: 115.8701 }}
      />
    )

    await waitFor(() => {
      expect(vi.mocked(reverseGeocode)).toHaveBeenCalledTimes(2)
    })

    resolveFirst({ ...directResult, address: 'Stale Address, Old Suburb WA 6000' })
    resolveSecond({ ...directResult, address: 'Current Address, New Suburb WA 6001' })

    const dialog = await screen.findByRole('dialog', { name: /add property visit/i })
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/^property address \*/i)).toHaveValue('Current Address, New Suburb WA 6001')
    })
    expect(within(dialog).queryByDisplayValue('Stale Address, Old Suburb WA 6000')).not.toBeInTheDocument()
  })
})
