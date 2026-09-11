import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthProvider';
import { AuthDialog } from './AuthDialog';
import { useState } from 'react';

/**
 * Yalnızca `/app/billing` için. `/app`'in geri kalanı local-first kalır.
 *
 * `isLoading` ile `session === null` ayrıdır: ayrılmazsa sayfa her açılışta
 * bir kare giriş istemi gösterip sonra içeriğe atlar.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const { user, isLoading, isConfigured } = useAuth();
    const [authOpen, setAuthOpen] = useState(false);

    if (isLoading) {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                {t('billing.requireAuth.loading')}
            </p>
        );
    }

    if (!isConfigured || !user) {
        return (
            <div className="max-w-md space-y-4">
                <h2 className="text-2xl font-bold tracking-tight">{t('billing.requireAuth.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('billing.requireAuth.body')}</p>
                <button
                    type="button"
                    onClick={() => setAuthOpen(true)}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium"
                >
                    {t('billing.requireAuth.signIn')}
                </button>
                <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
            </div>
        );
    }

    return children;
}
