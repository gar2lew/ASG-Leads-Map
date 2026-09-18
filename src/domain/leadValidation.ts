export interface LeadValidationInput {
  address?: string | undefined
  contactName?: string | undefined
  contactPhone?: string | undefined
  contactEmail?: string | undefined
}

export type LeadValidationErrors = Partial<Record<
  'address' | 'contact' | 'contactPhone' | 'contactEmail',
  string
>>

export function normaliseOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidAustralianPhone(phone: string): boolean {
  if (!/^[+\d\s().-]+$/.test(phone)) return false
  const digits = phone.replace(/\D/g, '')
  return /^0[23478]\d{8}$/.test(digits) || /^61[23478]\d{8}$/.test(digits)
}

export function validateLeadInput(input: LeadValidationInput): LeadValidationErrors {
  const errors: LeadValidationErrors = {}
  const address = normaliseOptionalText(input.address)
  const contactName = normaliseOptionalText(input.contactName)
  const contactPhone = normaliseOptionalText(input.contactPhone)
  const contactEmail = normaliseOptionalText(input.contactEmail)

  if (!address) errors.address = 'Address is required'
  if (contactEmail && !isValidEmail(contactEmail)) errors.contactEmail = 'Enter a valid email address'
  if (contactPhone && !isValidAustralianPhone(contactPhone)) {
    errors.contactPhone = 'Enter a valid Australian phone number'
  }
  if (!contactName && !contactPhone && !contactEmail) {
    errors.contact = 'At least one contact detail is required'
  }

  return errors
}

export function firstLeadValidationReason(errors: LeadValidationErrors): string | undefined {
  return errors.address ?? errors.contactEmail ?? errors.contactPhone ?? errors.contact
}
