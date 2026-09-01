import './MapFeedback.css'

export interface MapFeedbackValue {
  kind: 'success' | 'error'
  message: string
}

interface MapFeedbackProps {
  feedback: MapFeedbackValue | null
  onDismiss: () => void
}

export function MapFeedback({ feedback, onDismiss }: MapFeedbackProps) {
  if (!feedback) return null

  return (
    <div
      className={`map-feedback map-feedback--${feedback.kind}`}
      role={feedback.kind === 'error' ? 'alert' : 'status'}
      aria-live={feedback.kind === 'error' ? 'assertive' : 'polite'}
    >
      <span className="map-feedback__message">{feedback.message}</span>
      <button
        type="button"
        className="map-feedback__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss message"
      >
        ×
      </button>
    </div>
  )
}
