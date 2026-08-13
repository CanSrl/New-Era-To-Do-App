import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { TasksPage } from './pages/TasksPage';
import { SettingsPage } from './pages/SettingsPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Rota yolları İngilizce: uygulama şu an Türkçe olsa da starter kit
 * uluslararası alıcıya satılacak ve i18n planlanıyor.
 *
 * `/app` altında oturum koruması **yoktur**: uygulama local-first çalışır,
 * giriş isteğe bağlıdır. Koruma ancak hesaba özel sayfalar (faturalama gibi)
 * geldiğinde gerekecek.
 */
export const router = createBrowserRouter([
    {
        path: '/',
        element: <Navigate to="/app" replace />,
    },
    {
        path: '/app',
        element: <AppLayout />,
        children: [
            { index: true, element: <TasksPage /> },
            { path: 'settings', element: <SettingsPage /> },
        ],
    },
    {
        path: '/reset-password',
        element: <ResetPasswordPage />,
    },
    {
        path: '/auth/callback',
        element: <AuthCallbackPage />,
    },
    {
        path: '*',
        element: <NotFoundPage />,
    },
]);
