import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MapFeedback } from './MapFeedback'

afterEach(() => vi.useRealTimers())

describe('MapFeedback', () => {
  it('automatically dismisses success messages after three seconds', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<MapFeedback feedback={{ kind: 'success', message: 'Pin saved' }} onDismiss={onDismiss} />)

    expect(screen.getByRole('status')).toBeVisible()
    act(() => vi.advanceTimersByTime(2999))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('keeps errors visible until dismissed', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<MapFeedback feedback={{ kind: 'error', message: 'Save failed' }} onDismiss={onDismiss} />)
    act(() => vi.advanceTimersByTime(5000))
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
