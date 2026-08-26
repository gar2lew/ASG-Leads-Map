import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import type { Pin, PinOutcome } from '../domain'
import type { CreatePinInput, UpdatePinInput } from '../domain'
import { pinOutcomeOrder, pinOutcomeLabel, pinOutcomeColor, DEFAULT_PIN_OUTCOME } from '../domain'
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

  const isEditing = initialPin !== null

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
      } else {
        setOutcome(DEFAULT_PIN_OUTCOME)
        setAddress('')
        setNotes('')
        setContactName('')
        setContactPhone('')
        setContactEmail('')
      }
      setErrors({})
      setTimeout(() => firstInputRef.current?.focus(), 100)
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen, initialPin])

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
    const newErrors: Record<string, string> = {}
    if (!contactName.trim()) {
      newErrors['contactName'] = 'Contact name is required'
    }
    if (contactPhone && !/^[\d\s\-+()]{10,}$/.test(contactPhone)) {
      newErrors['contactPhone'] = 'Enter a valid phone number'
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      newErrors['contactEmail'] = 'Enter a valid email address'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const baseData = {
      latitude: initialCoordinates?.latitude ?? initialPin?.latitude ?? 0,
      longitude: initialCoordinates?.longitude ?? initialPin?.longitude ?? 0,
      outcome,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      contactName: contactName.trim(),
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

  if (!isOpen) return null

  return (
    <div
      className="pin-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
    >
      <div className="pin-modal" ref={modalRef}>
        <header className="pin-modal__header">
          <h2 id="pin-modal-title" className="pin-modal__title">
            {isEditing ? 'Edit Pin' : 'Add New Pin'}
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
            <fieldset className="form-group">
              <legend className="form-label">Outcome <span className="required">*</span></legend>
              <div className="outcome-selector" role="radiogroup" aria-label="Select pin outcome">
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
            </fieldset>

            <div className="form-group">
              <label htmlFor="address" className="form-label">
                Address
              </label>
              <input
                ref={firstInputRef}
                type="text"
                id="address"
                className="form-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter address or landmark"
                autoComplete="street-address"
              />
            </div>

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

            <fieldset className="form-group">
              <legend className="form-label">Contact Details</legend>

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
                    Phone
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
            <button type="submit" className="btn btn--primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Pin'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}