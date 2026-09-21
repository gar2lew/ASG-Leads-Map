import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export interface PinCredentials {
  pinHash: string
  pinSalt: string
}

export function isSixDigitPin(value: unknown): value is string {
  return typeof value === 'string' && /^\d{6}$/.test(value)
}

export function createPinCredentials(pin: string): PinCredentials {
  const salt = randomBytes(16)
  return {
    pinHash: scryptSync(pin, salt, 32).toString('base64'),
    pinSalt: salt.toString('base64'),
  }
}

export function matchesPin(pin: string, credentials: PinCredentials): boolean {
  try {
    const expected = Buffer.from(credentials.pinHash, 'base64')
    const actual = scryptSync(pin, Buffer.from(credentials.pinSalt, 'base64'), 32)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
