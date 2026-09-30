import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { migrateLeadRecord } from '../../domain/leadRegister'
import { QuickCapturePanel } from './QuickCapturePanel'

const draft = migrateLeadRecord({ id: 'draft', leadName: '', address: '' })

describe('QuickCapturePanel', () => {
  it('requires a lead name or address before submitting', () => {
    const onSubmit = vi.fn()
    render(<QuickCapturePanel mode="lead" draft={draft} onChange={vi.fn()} onSubmit={onSubmit} onModeChange={vi.fn()} isOpen onToggle={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /save lead/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/lead name or property address/i)).toBeInTheDocument()
  })

  it('switches between lead, call, and door-knock capture modes', () => {
    const onModeChange = vi.fn()
    render(<QuickCapturePanel mode="lead" draft={draft} onChange={vi.fn()} onSubmit={vi.fn()} onModeChange={onModeChange} isOpen onToggle={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /log door knock/i }))
    expect(onModeChange).toHaveBeenCalledWith('door_knock')
  })

  it('keeps the capture form intentionally collapsed when closed', () => {
    render(<QuickCapturePanel mode="call" draft={draft} onChange={vi.fn()} onSubmit={vi.fn()} onModeChange={vi.fn()} isOpen={false} onToggle={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Open capture' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Lead name')).not.toBeInTheDocument()
  })
})
