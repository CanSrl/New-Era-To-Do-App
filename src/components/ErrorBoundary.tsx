import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router-dom';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { captureError, isMonitoringConfigured } from '../lib/monitoring';

/**
 * Çökme ekranı.
 *
 * Sınıf bileşeninden ayrı tutuluyor çünkü `useTranslation` bir hook ve sınıf
 * içinde çağrılamaz. Ayrıca router'ın `errorElement`'i de aynı ekranı
 * kullanabiliyor.
 */
function ErrorFallback({ error }: { error: unknown }) {
    const { t } = useTranslation();

    const detail = error instanceof Error ? error.message : String(error);

    return (
        <main
            role="alert"
            className="min-h-screen bg-background text-foreground flex items-center justify-center p-4"
        >
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                    <AlertTriangle size={26} />
                </div>

                <h1 className="text-xl font-bold tracking-tight">{t('crash.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('crash.body')}</p>

                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
                >
                    <RotateCw size={16} />
                    {t('crash.reload')}
                </button>

                <p className="text-xs text-muted-foreground">
                    {isMonitoringConfigured ? t('crash.reported') : t('crash.notReported')}
                </p>

                {/*
                  * Ayrıntı katlanmış duruyor: kullanıcıyı yığın izine boğmadan,
                  * destek isteyen birinin kopyalayabileceği bir yer bırakır.
                  */}
                {detail && (
                    <details className="text-left">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            {t('crash.details')}
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap break-words">
                            {detail}
                        </pre>
                    </details>
                )}
            </div>
        </main>
    );
}

/**
 * Router'ın `errorElement`'i olarak kullanılır.
 *
 * React Router bir rotanın render'ında oluşan hatayı kendi yakalar ve
 * aşağıdaki sınıf bileşenine hiç ulaştırmaz; bu yüzden raporlama burada da
 * ayrıca yapılmak zorunda.
 */
export function RouteErrorBoundary() {
    const error = useRouteError();

    // Raporlama render gövdesinde değil efektte: render iki kez çalışabilir
    // (StrictMode) ve her yeniden render aynı hatayı tekrar gönderirdi.
    useEffect(() => {
        captureError(error, { boundary: 'route' });
    }, [error]);

    return <ErrorFallback error={error} />;
}

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    error: unknown;
}

/**
 * Uygulamanın kökündeki son çare hata sınırı.
 *
 * Router'ın kendi `errorElement`'i rota ağacındaki hataları yakalar; bu sınır
 * onun dışında kalanlar içindir — sağlayıcılar (tema, auth, senkron), router'ın
 * kendisi ve i18n. Oralarda bir hata olursa React bütün ağacı söker ve
 * kullanıcı bomboş beyaz bir sayfa görür.
 *
 * Hook kullanamadığı için sınıf bileşeni: `componentDidCatch` yalnızca sınıf
 * API'sinde var.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        captureError(error, {
            boundary: 'root',
            componentStack: info.componentStack,
        });
    }

    render() {
        if (this.state.error !== null) {
            return <ErrorFallback error={this.state.error} />;
        }
        return this.props.children;
    }
}
