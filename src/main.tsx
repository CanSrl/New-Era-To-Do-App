import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from './components/ThemeProvider'
import { AuthProvider } from './components/AuthProvider'
import { SyncProvider } from './components/SyncProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initMonitoring } from './lib/monitoring'
import { router } from './router'
// i18n yan etkisi olarak kurulur ve ilk render'dan önce hazır olmalı:
// bileşenler t() çağırdığında kaynaklar yüklenmiş olsun diye en üstte durur.
import './i18n'
import './index.css'

// Beklenmez: DSN yoksa hiçbir şey yapmaz, varsa Sentry arka planda yüklenir.
// Yükleme sürerken oluşan hatalar tamponlanır (bkz. lib/monitoring.ts).
void initMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      * Hata sınırı sağlayıcıların DIŞINDA: tema, auth veya senkron
      * sağlayıcısının kendisi çökerse de bir şey gösterebilmeli. İçeride
      * olsaydı o çökmelerde kullanıcı boş bir sayfa görürdü.
      */}
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="yapilacaklar-theme">
        <AuthProvider>
          <SyncProvider>
            <RouterProvider router={router} />
            <Toaster position="top-right" richColors closeButton />
          </SyncProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
