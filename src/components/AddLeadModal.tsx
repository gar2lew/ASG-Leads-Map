import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ingestLead, validateLeadInput, type LeadValidationErrors, type OfficeId, type Pin } from '../domain'
import './AddLeadModal.css'

interface AddLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (pin: Pin) => void
  userId: string
  officeId: OfficeId | undefined
}

type FormErrors = LeadValidationErrors & { office?: string }

function emptyForm() {
  return {
    address: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    notes: '',
  }
}

export function AddLeadModal({ isOpen, onClose, onCreated, userId, officeId }: AddLeadModalProps) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    addressRef.current?.focus()
    return () => {
      openerRef.current?.focus()
      openerRef.current = null
    }
  }, [isOpen])

  if (!isOpen) return null

  const updateField = (field: keyof ReturnType<typeof emptyForm>, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      const next = { ...current }
      if (field === 'address') delete next.address
      if (field === 'contactName') delete next.contact
      if (field === 'contactPhone') {
        delete next.contact
        delete next.contactPhone
      }
      if (field === 'contactEmail') {
        delete next.contact
        delete next.contactEmail
      }
      return next
    })
  }

  const close = () => {
    setForm(emptyForm())
    setErrors({})
    setIsSubmitting(false)
    onClose()
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (!isSubmitting) {
        event.preventDefault()
        close()
      }
      return
    }
    if (event.key !== 'Tab') return

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? [])
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return

    if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: FormErrors = validateLeadInput(form)
    if (!officeId) nextErrors.office = 'An assigned office is required to create leads'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    if (!officeId) return

    setIsSubmitting(true)
    setErrors({})
    try {
      const result = await ingestLead({ ...form, officeId, source: 'manual' }, userId)
      if (result.status === 'created' && result.pin) {
        onCreated(result.pin)
        close()
        return
      }
      setErrors({
        address: result.status === 'duplicate'
          ? 'A lead already exists for this address.'
          : result.status === 'geocoding-failed'
            ? result.reason ?? 'This address could not be located. Please check it and try again.'
            : result.reason ?? 'Unable to create this lead.',
      })
    } catch (error) {
      console.error('Failed to create lead:', error)
      setErrors({ address: 'Unable to create this lead. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="add-lead-modal-overlay" role="presentation">
      <div ref={dialogRef} className="add-lead-modal add-lead-modal--checklist surface--light" role="dialog" aria-modal="true" aria-labelledby="add-lead-title" onKeyDown={handleDialogKeyDown}>
        <header className="add-lead-modal__header">
          <div>
            <p className="add-lead-modal__eyebrow">Lead intake</p>
            <h2 id="add-lead-title" className="add-lead-modal__title">Add Lead</h2>
          </div>
          <button type="button" className="add-lead-modal__close" onClick={close} disabled={isSubmitting} aria-label="Close add lead form">×</button>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <div className="add-lead-modal__body">
            <div className="form-group">
              <label className="form-label" htmlFor="lead-address">Address <span className="required">*</span></label>
              <input ref={addressRef} id="lead-address" className={`form-input ${errors.address ? 'form-input--error' : ''}`} value={form.address} onChange={(event) => updateField('address', event.target.value)} autoComplete="street-address" required aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? 'lead-address-error' : undefined} />
              {errors.address && <span id="lead-address-error" className="form-error" role="alert">{errors.address}</span>}
            </div>

            <fieldset className="form-group" aria-required="true" aria-describedby={`lead-contact-hint${errors.contact ? ' lead-contact-error' : ''}`}>
              <legend className="form-label">Contact details <span className="required">*</span></legend>
              <p id="lead-contact-hint" className="form-hint">Provide at least one way to contact this lead.</p>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="lead-contact-name">Contact name</label>
                  <input id="lead-contact-name" className="form-input" value={form.contactName} onChange={(event) => updateField('contactName', event.target.value)} autoComplete="name" aria-invalid={Boolean(errors.contact)} aria-describedby={`lead-contact-hint${errors.contact ? ' lead-contact-error' : ''}`} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="lead-contact-phone">Contact phone</label>
                  <input id="lead-contact-phone" className={`form-input ${errors.contactPhone ? 'form-input--error' : ''}`} type="tel" value={form.contactPhone} onChange={(event) => updateField('contactPhone', event.target.value)} autoComplete="tel" aria-invalid={Boolean(errors.contactPhone || errors.contact)} aria-describedby={`lead-contact-hint${errors.contactPhone ? ' lead-contact-phone-error' : ''}${errors.contact ? ' lead-contact-error' : ''}`} />
                  {errors.contactPhone && <span id="lead-contact-phone-error" className="form-error" role="alert">{errors.contactPhone}</span>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="lead-contact-email">Contact email</label>
                <input id="lead-contact-email" className={`form-input ${errors.contactEmail ? 'form-input--error' : ''}`} type="email" value={form.contactEmail} onChange={(event) => updateField('contactEmail', event.target.value)} autoComplete="email" aria-invalid={Boolean(errors.contactEmail || errors.contact)} aria-describedby={`lead-contact-hint${errors.contactEmail ? ' lead-contact-email-error' : ''}${errors.contact ? ' lead-contact-error' : ''}`} />
                {errors.contactEmail && <span id="lead-contact-email-error" className="form-error" role="alert">{errors.contactEmail}</span>}
              </div>
              {errors.contact && <span id="lead-contact-error" className="form-error" role="alert">{errors.contact}</span>}
            </fieldset>

            <div className="form-group">
              <label className="form-label" htmlFor="lead-office">Office <span className="required">*</span></label>
              <select id="lead-office" className={`form-input ${errors.office ? 'form-input--error' : ''}`} value={officeId ?? ''} disabled required aria-invalid={Boolean(errors.office)} aria-describedby={!officeId ? 'lead-office-error' : undefined}>
                {officeId
                  ? <option value={officeId}>{officeId === 'perth' ? 'Perth' : 'Brisbane'}</option>
                  : <option value="">No assigned office</option>}
              </select>
              {!officeId && <span id="lead-office-error" className="form-error" role="alert">An assigned office is required to create leads.</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lead-notes">Notes</label>
              <textarea id="lead-notes" className="form-input form-textarea" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows={3} />
            </div>
          </div>
          <footer className="add-lead-modal__footer">
            <button type="button" className="btn btn--ghost" onClick={close} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting || !officeId}>{isSubmitting ? 'Creating…' : 'Create Lead'}</button>
          </footer>
        </form>
      </div>
    </div>
  )
}
