import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { RouteErrorBoundary } from './components/ErrorBoundary';
import { TasksPage } from './pages/TasksPage';
import { SettingsPage } from './pages/SettingsPage';
import { ClientsPage } from './pages/ClientsPage';
import { DeliveryPage } from './pages/DeliveryPage';
import { TimePage } from './pages/TimePage';
import { SaasTemplate } from './components/ui/saas-template';
import { NICHE_MODULE } from './config/features';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CrashTestPage } from './pages/CrashTestPage';
import { BillingPage } from './pages/BillingPage';
import { RequireAuth } from './components/RequireAuth';
import { features } from './config/features';

/**
 * Rota yolları İngilizce: uygulama Türkçe de olsa starter kit uluslararası
 * alıcıya satılıyor.
 *
 * `/app` altında oturum koruması **yoktur**: uygulama local-first çalışır,
 * giriş isteğe bağlıdır. Koruma ancak hesaba özel sayfalar (faturalama gibi)
 * geldiğinde gerekecek.
 *
 * Her üst düzey rotada `errorElement` var. React Router bir rotanın
 * render'ında oluşan hatayı kendisi yakalar ve kökteki `ErrorBoundary`'ye hiç
 * ulaştırmaz; `errorElement` verilmezse kullanıcı Router'ın ham hata ekranını
 * görür.
 */

/**
 * Kasıtlı olarak çöken rota — yalnızca geliştirmede.
 *
 * `import.meta.env.DEV` derleme zamanı sabiti olduğu için üretim
 * derlemesinde bu dizi boşalır ve rota paketten tamamen elenir.
 */
const devOnlyRoutes: RouteObject[] = import.meta.env.DEV
    ? [{
        path: '/app/__crash',
        element: <CrashTestPage />,
        errorElement: <RouteErrorBoundary />,
    }]
    : [];

/**
 * Niş modülün ekranları — yalnızca bayrak açıkken.
 *
 * Bayrak kapalıyken dizi boşalır, rotalar kaydedilmez ve `/app/clients` ile
 * `/app/delivery` "bulunamadı"ya düşer. Sayfaları yalnızca gezinmeden
 * gizlemek yetmezdi — adresi bilen kullanıcı bayrağın kapattığı özelliği
 * yine açabilirdi.
 *
 * `NICHE_MODULE` bir **derleme zamanı sabiti** (`vite.config.ts` → `define`),
 * yani bu koşul katlanır ve bayrak kapalıyken sayfalar paketten tamamen
 * elenir — güvence hem davranışsal hem boyutsal. Sabitin `features` nesnesine
 * taşınması bunu sessizce bozar; `npm run verify:niche` onu yakalar.
 */
const billingRoutes: RouteObject[] = features.billing
    ? [{
        path: 'billing',
        element: (
            <RequireAuth>
                <BillingPage />
            </RequireAuth>
        ),
        errorElement: <RouteErrorBoundary />,
    }]
    : [];

const nicheRoutes: RouteObject[] = NICHE_MODULE
    ? [
        { path: 'clients', element: <ClientsPage /> },
        { path: 'delivery', element: <DeliveryPage />, errorElement: <RouteErrorBoundary /> },
        { path: 'time', element: <TimePage />, errorElement: <RouteErrorBoundary /> },
    ]
    : [];

export const router = createBrowserRouter([
    {
        /*
         * Kök adres artık pazarlama sayfası; uygulama `/app` altında.
         * Eskiden burası `/app`'e yönlendiriyordu — starter kit satılacak bir
         * ürün olduğu için ziyaretçinin ilk gördüğü şey uygulama kabuğu değil
         * ürünün ne olduğu olmalı.
         *
         * Bunun bir yan etkisi vardı: PWA manifest'inde `start_url`
         * tanımlı değildi, yani varsayılan `/` idi ve kurulu uygulama artık
         * tanıtım sayfasını açardı. `vite.config.ts` içine `start_url: '/app'`
         * eklendi — biri değişirse diğeri de değişmeli.
         */
        path: '/',
        element: <SaasTemplate />,
        errorElement: <RouteErrorBoundary />,
    },
    {
        path: '/app',
        element: <AppLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
            { index: true, element: <TasksPage /> },
            ...nicheRoutes,
            ...billingRoutes,
            { path: 'settings', element: <SettingsPage /> },
        ],
    },
    ...devOnlyRoutes,
    {
        path: '/reset-password',
        element: <ResetPasswordPage />,
        errorElement: <RouteErrorBoundary />,
    },
    {
        path: '/auth/callback',
        element: <AuthCallbackPage />,
        errorElement: <RouteErrorBoundary />,
    },
    {
        path: '*',
        element: <NotFoundPage />,
    },
]);
