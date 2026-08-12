import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { ThemeProvider } from './components/ThemeProvider'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="yapilacaklar-theme">
      <App />
      <Toaster position="top-right" richColors closeButton />
    </ThemeProvider>
  </StrictMode>,
)
