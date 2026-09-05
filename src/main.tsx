import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline Firestore data remains available even when shell caching fails.
    })
  })
}
import App from './App.tsx'
import { initialiseTheme } from './theme'

initialiseTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
