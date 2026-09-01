import { useState, useEffect, useRef, useCallback } from 'react'
import type { FormEvent } from 'react'
import type { Pin, PinOutcome } from '../domain'
import type { CreatePinInput, UpdatePinInput, AddressConfidence, GeocodingComponents } from '../domain'
import {
  pinOutcomeOrder,
  pinOutcomeLabel,
  pinOutcomeColor,
  DEFAULT_PIN_OUTCOME,
  reverseGeocode,
  requiresContactDetails,
  isValidAustralianMobile,
  outcomeNote,
  canCompleteManualHouseNumber,
  houseNumberFallbackParts,
  composeAustralianAddress,
} from '../domain'
import './PinModal.css'

interface PinModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (pin: { latitude: number; longitude: number; outcome: PinOutcome; address?: string; notes?: string; contactName?: string; contactPhone?: string; contactEmail?: string; id?: string }) => void
  initialPin?: Pin | null
  initialCoordinates?: { latitude: number; longitude: number } | null
  isLoading?: boolean
}

export function PinModal({
  isOpen,
  onClose,
  onSave,
  initialPin = null,
  initialCoordinates = null,
  isLoading = false,
}: PinModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [outcome, setOutcome] = useState<PinOutcome>(DEFAULT_PIN_OUTCOME)
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodingError, setGeocodingError] = useState<string | null>(null)
  const [addressConfirmed, setAddressConfirmed] = useState(false)
  const [addressSource, setAddressSource] = useState<'reverse-geocode' | 'manual' | ''>('')
  const [addressConfidence, setAddressConfidence] = useState<AddressConfidence | ''>('')
  const [manualComponents, setManualComponents] = useState<GeocodingComponents | null>(null)
  const [houseNumber, setHouseNumber] = useState('')
  const [showFullAddressEdit, setShowFullAddressEdit] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const geocodeRequestIdRef = useRef(0)

  const isEditing = initialPin !== null

  const handleAddressChange = useCallback((value: string) => {
    setAddress(value)
    if (addressConfirmed) {
      setAddressConfirmed(false)
    }
    if (addressSource === 'reverse-geocode') {
      setAddressSource('manual')
    }
  }, [addressConfirmed, addressSource])

  const handleHouseNumberChange = useCallback((value: string) => {
    setHouseNumber(value)
    if (manualComponents) {
      setAddress(composeAustralianAddress(value, manualComponents))
    }
    if (addressConfirmed) {
      setAddressConfirmed(false)
    }
    if (addressSource === 'reverse-geocode') {
      setAddressSource('manual')
    }
  }, [manualComponents, addressConfirmed, addressSource])

  const switchToFullAddressEdit = useCallback(() => {
    setShowFullAddressEdit(true)
    if (addressSource === 'reverse-geocode') {
      setAddressSource('manual')
    }
  }, [addressSource])

  const handleConfirmChange = useCallback((confirmed: boolean) => {
    setAddressConfirmed(confirmed)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      if (initialPin) {
        setOutcome(initialPin.outcome)
        setAddress(initialPin.address ?? '')
        setNotes(initialPin.notes ?? '')
        setContactName(initialPin.contactName ?? '')
        setContactPhone(initialPin.contactPhone ?? '')
        setContactEmail(initialPin.contactEmail ?? '')
        setAddressSource('manual')
        setAddressConfidence('')
        setManualComponents(null)
        setHouseNumber('')
        setShowFullAddressEdit(false)
      } else {
        setOutcome(DEFAULT_PIN_OUTCOME)
        setAddress('')
        setNotes('')
        setContactName('')
        setContactPhone('')
        setContactEmail('')
        setAddressSource('')
        setAddressConfidence('')
        setManualComponents(null)
        setHouseNumber('')
        setShowFullAddressEdit(false)
      }
      setErrors({})
      setAddressConfirmed(false)
      setGeocodingError(null)

      if (!isEditing && initialCoordinates) {
        const requestId = ++geocodeRequestIdRef.current
        abortControllerRef.current = new AbortController()
        setIsGeocoding(true)

        reverseGeocode(initialCoordinates.latitude, initialCoordinates.longitude, abortControllerRef.current.signal)
          .then((result) => {
            if (requestId === geocodeRequestIdRef.current) {
              const resolvedAddress = result && typeof result.address === 'string' && result.address.length > 0
                ? result.address
                : 'Address not found'
              setAddress(resolvedAddress)
              setAddressSource('reverse-geocode')
              setAddressConfidence(result.confidence ?? 'direct')
              setManualComponents(
                canCompleteManualHouseNumber(result.components) ? (result.components ?? null) : null
              )
              setHouseNumber('')
              setShowFullAddressEdit(false)
              setIsGeocoding(false)
              setGeocodingError(null)
            }
          })
          .catch((error) => {
            if (requestId === geocodeRequestIdRef.current && error.name !== 'AbortError') {
              setGeocodingError('Address could not be detected automatically. Enter the property address below.')
              setIsGeocoding(false)
            }
          })
      }

      setTimeout(() => firstInputRef.current?.focus(), 100)
    } else {
      document.body.style.overflow = ''
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
    return () => {
      document.body.style.overflow = ''
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [isOpen, initialPin, initialCoordinates, isEditing])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const validateForm = (): boolean => {
    const addressValue = typeof address === 'string' ? address : ''
    const newErrors: Record<string, string> = {}
    const isLead = requiresContactDetails(outcome)
    if (isLead) {
      if (!contactName.trim()) {
        newErrors['contactName'] = 'Contact name is required'
      }
      if (!contactPhone.trim()) {
        newErrors['contactPhone'] = 'Mobile number is required'
      } else if (!isValidAustralianMobile(contactPhone.trim())) {
        newErrors['contactPhone'] = 'Enter a valid Australian mobile number, e.g. 0412 345 678'
      }
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        newErrors['contactEmail'] = 'Enter a valid email address'
      }
    }
    if (!addressValue.trim()) {
      newErrors['address'] = 'Address is required'
    }
    if (!addressConfirmed) {
      newErrors['addressConfirmed'] = 'Please confirm the address is correct'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const addressValue = typeof address === 'string' ? address : ''
    const baseData = {
      latitude: initialCoordinates?.latitude ?? initialPin?.latitude ?? 0,
      longitude: initialCoordinates?.longitude ?? initialPin?.longitude ?? 0,
      outcome,
      address: addressValue.trim() || undefined,
      notes: notes.trim() || undefined,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
    }

    let data: CreatePinInput | UpdatePinInput
    if (isEditing && initialPin) {
      data = { ...baseData, id: initialPin.id } as UpdatePinInput
    } else {
      data = baseData as CreatePinInput
    }

    onSave(data as { latitude: number; longitude: number; outcome: PinOutcome; address?: string; notes?: string; contactName?: string; contactPhone?: string; contactEmail?: string; id?: string })
  }

  const addressValue = typeof address === 'string' ? address : ''
  const isLead = requiresContactDetails(outcome)
  const manualFallbackParts = manualComponents ? houseNumberFallbackParts(manualComponents) : null
  const showHouseNumberFallback =
    !isEditing &&
    !showFullAddressEdit &&
    manualFallbackParts !== null &&
    addressConfidence === 'manual' &&
    !isGeocoding &&
    !geocodingError
  const houseNumberPreview = houseNumber.trim()
    ? composeAustralianAddress(houseNumber, manualComponents ?? undefined)
    : null
  const isSubmitDisabled =
    isLoading ||
    !addressValue.trim() ||
    !addressConfirmed ||
    (isLead && (!contactName.trim() || !contactPhone.trim() || !isValidAustralianMobile(contactPhone.trim())))

  if (!isOpen) return null

  return (
    <div
      className="pin-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
    >
      <div className="pin-modal pin-modal__sheet" ref={modalRef}>
        <header className="pin-modal__header">
          <h2 id="pin-modal-title" className="pin-modal__title">
            {isEditing ? 'Edit Visit' : 'Add Property Visit'}
          </h2>
          <button
            className="pin-modal__close"
            onClick={onClose}
            aria-label="Close modal"
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="pin-modal__form" noValidate>
          <div className="pin-modal__body">
            {/* Outcome Selector */}
            <fieldset className="form-group">
              <legend className="form-label">Outcome <span className="required">*</span></legend>
              <div className="outcome-selector" role="radiogroup" aria-label="Select visit outcome">
                {pinOutcomeOrder.map((o) => (
                  <label
                    key={o}
                    className={`outcome-option ${outcome === o ? 'outcome-option--selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="outcome"
                      value={o}
                      checked={outcome === o}
                      onChange={() => setOutcome(o)}
                      className="outcome-option__input"
                      aria-describedby={`${o}-label`}
                    />
                    <div
                      className="outcome-option__content"
                      style={{ borderColor: pinOutcomeColor(o) }}
                    >
                      <span
                        className="outcome-option__color"
                        style={{ backgroundColor: pinOutcomeColor(o) }}
                        aria-hidden="true"
                      />
                      <span id={`${o}-label`} className="outcome-option__label">
                        {pinOutcomeLabel(o)}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              {outcomeNote(outcome) && (
                <p className="form-hint" id="outcome-note">
                  {outcomeNote(outcome)}
                </p>
              )}
            </fieldset>

            {/* Property Address */}
            <div className="form-group">
              <label htmlFor="address" className="form-label">
                Property Address <span className="required">*</span>
              </label>
              <div className="address-field-wrapper">
                {isGeocoding ? (
                  <div className="address-display">
                    <span className="form-hint form-hint--loading">
                      <span className="spinner" aria-hidden="true"></span>
                      Finding address…
                    </span>
                  </div>
                ) : showHouseNumberFallback && manualFallbackParts ? (
                  <div className="house-number-fallback" data-testid="house-number-fallback">
                    <div className="house-number-fallback__row">
                      <label htmlFor="houseNumber" className="form-label">
                        House Number
                      </label>
                      <input
                        ref={firstInputRef}
                        type="text"
                        id="houseNumber"
                        className="form-input"
                        value={houseNumber}
                        onChange={(e) => handleHouseNumberChange(e.target.value)}
                        placeholder="e.g. 17, 17A or 2/154"
                        autoComplete="off"
                        aria-describedby="house-number-hint"
                      />
                    </div>
                    <div className="house-number-fallback__address">
                      <span className="house-number-fallback__street">{manualFallbackParts.street}</span>
                      <span className="house-number-fallback__locality">{manualFallbackParts.locality}</span>
                    </div>
                    {houseNumberPreview && (
                      <span className="form-hint form-hint--success house-number-fallback__preview">
                        Composed address: {houseNumberPreview}
                      </span>
                    )}
                    <p id="house-number-hint" className="form-hint form-hint--info">
                      House number could not be identified automatically. Enter the house number if known.
                    </p>
                    <button
                      type="button"
                      className="house-number-fallback__edit"
                      onClick={switchToFullAddressEdit}
                    >
                      Edit full address
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={firstInputRef}
                      type="text"
                      id="address"
                      className={`form-input ${errors['address'] ? 'form-input--error' : ''}`}
                      value={address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      placeholder="Enter address or landmark"
                      autoComplete="street-address"
                      aria-invalid={!!errors['address']}
                      aria-describedby={errors['address'] ? 'address-error' : (addressSource ? 'address-source' : undefined)}
                      disabled={isGeocoding}
                    />
                    {geocodingError && !isGeocoding && (
                      <span id="address-error" className="form-error" role="alert">
                        {geocodingError}
                      </span>
                    )}
                    {addressSource === 'reverse-geocode' && !isGeocoding && !geocodingError && addressConfidence === 'nearby_suggested' && (
                      <span id="address-source" className="form-hint form-hint--info address-source-badge address-source-badge--suggested">
                        <svg className="address-source-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        Suggested nearby property — please verify
                      </span>
                    )}
                    {addressSource === 'reverse-geocode' && !isGeocoding && !geocodingError && addressConfidence === 'manual' && (
                      <span id="address-source" className="form-hint form-hint--info address-source-badge address-source-badge--missing">
                        <svg className="address-source-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        House number could not be identified. Please enter the correct property address.
                      </span>
                    )}
                    {addressSource === 'reverse-geocode' && !isGeocoding && !geocodingError && addressConfidence !== 'nearby_suggested' && addressConfidence !== 'manual' && (
                      <span id="address-source" className="form-hint form-hint--success address-source-badge">
                        <svg className="address-source-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 12l2 2 4-4" />
                        </svg>
                        Automatically detected from pin location
                      </span>
                    )}
                    {addressSource === 'manual' && !isGeocoding && (
                      <span id="address-source" className="form-hint form-hint--info address-source-badge address-source-badge--manual">
                        <svg className="address-source-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Address edited manually
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Address Confirmation */}
            <div className="form-group address-confirmation-group">
              <label
                htmlFor="addressConfirmed"
                className={`address-confirmation-row ${addressConfirmed ? 'address-confirmation-row--confirmed' : ''}`}
              >
                <input
                  type="checkbox"
                  id="addressConfirmed"
                  className="checkbox-input"
                  checked={addressConfirmed}
                  onChange={(e) => handleConfirmChange(e.target.checked)}
                  disabled={!addressValue.trim() || isGeocoding}
                  aria-describedby="address-confirm-hint"
                />
                <span className="checkbox-text">
                  {addressConfirmed ? '✓ Address confirmed' : 'I confirm this is the correct property address'}
                </span>
              </label>
              {errors['addressConfirmed'] && (
                <span id="address-confirm-hint" className="form-error" role="alert">
                  {errors['addressConfirmed']}
                </span>
              )}
            </div>

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="notes" className="form-label">
                Notes
              </label>
              <textarea
                id="notes"
                className="form-input form-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this visit..."
                rows={3}
              />
            </div>

            {/* Contact Details - only for Lead outcome */}
            {isLead && (
              <fieldset className="form-group">
                <legend className="form-label">Lead Details</legend>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="contactName" className="form-label">
                      Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="contactName"
                      className={`form-input ${errors['contactName'] ? 'form-input--error' : ''}`}
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Contact name"
                      autoComplete="name"
                      aria-invalid={!!errors['contactName']}
                      aria-describedby={errors['contactName'] ? 'contactName-error' : undefined}
                    />
                    {errors['contactName'] && (
                      <span id="contactName-error" className="form-error" role="alert">
                        {errors['contactName']}
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="contactPhone" className="form-label">
                      Mobile <span className="required">*</span>
                    </label>
                    <input
                      type="tel"
                      id="contactPhone"
                      className={`form-input ${errors['contactPhone'] ? 'form-input--error' : ''}`}
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="04XX XXX XXX"
                      autoComplete="tel"
                      aria-invalid={!!errors['contactPhone']}
                      aria-describedby={errors['contactPhone'] ? 'contactPhone-error' : undefined}
                    />
                    {errors['contactPhone'] && (
                      <span id="contactPhone-error" className="form-error" role="alert">
                        {errors['contactPhone']}
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="contactEmail" className="form-label">
                    Email
                  </label>
                  <input
                    type="email"
                    id="contactEmail"
                    className={`form-input ${errors['contactEmail'] ? 'form-input--error' : ''}`}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contact@example.com"
                    autoComplete="email"
                    aria-invalid={!!errors['contactEmail']}
                    aria-describedby={errors['contactEmail'] ? 'contactEmail-error' : undefined}
                  />
                  {errors['contactEmail'] && (
                    <span id="contactEmail-error" className="form-error" role="alert">
                      {errors['contactEmail']}
                    </span>
                  )}
                </div>
              </fieldset>
            )}

            {/* Coordinates - only for new pins */}
            {!isEditing && initialCoordinates && (
              <div className="pin-modal__coordinates">
                <span className="pin-modal__coordinates-label">Location:</span>
                <span className="pin-modal__coordinates-value">
                  {initialCoordinates.latitude.toFixed(6)}, {initialCoordinates.longitude.toFixed(6)}
                </span>
              </div>
            )}
          </div>

          <footer className="pin-modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitDisabled}>
              {isLoading ? 'Saving…' : isEditing ? 'Save Changes' : isLead ? 'Save Lead' : 'Save Pin'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
