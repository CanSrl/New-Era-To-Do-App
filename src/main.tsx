import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from './components/ThemeProvider'
import { AuthProvider } from './components/AuthProvider'
import { SyncProvider } from './components/SyncProvider'
import { router } from './router'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="yapilacaklar-theme">
      <AuthProvider>
        <SyncProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors closeButton />
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
