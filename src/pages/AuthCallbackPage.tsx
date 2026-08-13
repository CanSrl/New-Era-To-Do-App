import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

/**
 * E-posta doğrulama ve OAuth yönlendirmelerinin indiği sayfa.
 *
 * Supabase istemcisi adresteki kodu arka planda oturuma çevirir; burada
 * yapılan tek şey bunun tamamlanmasını bekleyip uygulamaya yönlendirmek.
 */
export function AuthCallbackPage() {
    const { user, isLoading, isConfigured } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isLoading) return;
        if (!isConfigured || user) {
            void navigate('/app', { replace: true });
        }
    }, [isLoading, isConfigured, user, navigate]);

    if (!isLoading && isConfigured && !user) {
        return (
            <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 text-center space-y-4">
                    <h1 className="text-xl font-bold tracking-tight">Bağlantı doğrulanamadı</h1>
                    <p className="text-sm text-muted-foreground">
                        Bağlantı geçersiz ya da süresi dolmuş olabilir. Görevlerinize bu cihazdan
                        erişmeye devam edebilirsiniz.
                    </p>
                    <Link
                        to="/app"
                        className="inline-block text-primary font-medium hover:underline underline-offset-4"
                    >
                        Görevlere dön
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
            <p className="text-sm">Giriş tamamlanıyor…</p>
        </main>
    );
}
