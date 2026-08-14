import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { RouteErrorBoundary } from './components/ErrorBoundary';
import { TasksPage } from './pages/TasksPage';
import { SettingsPage } from './pages/SettingsPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CrashTestPage } from './pages/CrashTestPage';

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

export const router = createBrowserRouter([
    {
        path: '/',
        element: <Navigate to="/app" replace />,
    },
    {
        path: '/app',
        element: <AppLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
            { index: true, element: <TasksPage /> },
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
