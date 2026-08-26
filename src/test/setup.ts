import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return {
    ...actual,
    useId: () => 'test-id',
  }
})