import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { ThemeProvider } from './components/ThemeProvider'
import { AuthProvider } from './components/AuthProvider'
import { SyncProvider } from './components/SyncProvider'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="yapilacaklar-theme">
      <AuthProvider>
        <SyncProvider>
          <App />
          <Toaster position="top-right" richColors closeButton />
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
