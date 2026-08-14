import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../components/AuthProvider';
import { parseAuthCallbackError } from '../lib/auth-callback';

/**
 * E-posta doğrulama ve OAuth yönlendirmelerinin indiği sayfa.
 *
 * Başarılı durumda Supabase istemcisi adresteki kodu arka planda oturuma
 * çevirir; burada yapılan tek şey bunun tamamlanmasını bekleyip uygulamaya
 * yönlendirmek. Başarısız durumda ise sağlayıcı hatayı yine bu adrese
 * ekleyerek döner — o yüzden adres bir kez, ilk render'da okunur (Supabase
 * istemcisi URL'i temizleyebildiği için sonrası güvenilmez).
 */
export function AuthCallbackPage() {
    const { t } = useTranslation();
    const { user, isLoading, isConfigured } = useAuth();
    const navigate = useNavigate();

    const [callbackError] = useState(() =>
        parseAuthCallbackError(window.location.search, window.location.hash)
    );

    useEffect(() => {
        if (isLoading || callbackError) return;
        if (!isConfigured || user) {
            void navigate('/app', { replace: true });
        }
    }, [isLoading, isConfigured, user, navigate, callbackError]);

    if (callbackError || (!isLoading && isConfigured && !user)) {
        return (
            <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 text-center space-y-4">
                    <h1 className="text-xl font-bold tracking-tight">
                        {callbackError
                            ? t('auth.callback.failedTitle')
                            : t('auth.callback.invalidTitle')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {callbackError
                            ? t(callbackError.messageKey)
                            : t('auth.callback.invalidBody')}
                    </p>
                    <Link
                        to="/app"
                        className="inline-block text-primary font-medium hover:underline underline-offset-4"
                    >
                        {t('common.backToTasks')}
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main
            className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-3 text-muted-foreground"
            role="status"
        >
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">{t('auth.callback.completing')}</p>
        </main>
    );
}
