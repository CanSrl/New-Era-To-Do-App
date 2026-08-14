import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Trans, useTranslation } from 'react-i18next';
import { useAuth } from '../components/AuthProvider';
import type { TranslationKey } from '../i18n';

const inputClass =
    'flex h-11 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Parola sıfırlama bağlantısının indiği sayfa.
 *
 * Supabase, adresteki kodu okuyup geçici bir oturum kurar; bu oturumla yeni
 * parola belirlenebilir. Oturum kurulmamışsa bağlantı geçersiz ya da süresi
 * dolmuş demektir.
 */
export function ResetPasswordPage() {
    const { t } = useTranslation();
    const { user, isLoading, isConfigured, updatePassword } = useAuth();
    const navigate = useNavigate();
    const fieldId = useId();

    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (password.length < 6) {
            setErrorKey('auth.passwordTooShort');
            return;
        }
        if (password !== confirmation) {
            setErrorKey('auth.resetPage.mismatch');
            return;
        }

        setIsSubmitting(true);
        setErrorKey(null);

        const { errorKey: failure } = await updatePassword(password);
        setIsSubmitting(false);

        if (failure) {
            setErrorKey(failure);
            return;
        }

        toast.success(t('auth.resetPage.success'));
        void navigate('/app', { replace: true });
    };

    return (
        <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                <div className="p-5 border-b border-border bg-muted/30">
                    <h1 className="text-xl font-bold tracking-tight">{t('auth.resetPage.title')}</h1>
                </div>

                {!isConfigured ? (
                    <div className="p-6 text-center space-y-4">
                        <p className="text-sm text-muted-foreground">
                            {t('auth.resetPage.notConfigured')}
                        </p>
                        <Link to="/app" className="text-primary font-medium hover:underline underline-offset-4">
                            {t('common.backToTasks')}
                        </Link>
                    </div>
                ) : isLoading ? (
                    <div className="p-10 flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 size={24} className="animate-spin" />
                        <p className="text-sm">{t('auth.resetPage.verifying')}</p>
                    </div>
                ) : !user ? (
                    <div className="p-6 text-center space-y-4">
                        <p className="font-medium">{t('auth.resetPage.invalidTitle')}</p>
                        <p className="text-sm text-muted-foreground">
                            {t('auth.resetPage.invalidBody')}
                        </p>
                        <Link to="/app" className="inline-block text-primary font-medium hover:underline underline-offset-4">
                            {t('common.backToTasks')}
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="p-5 flex flex-col gap-4">
                        {/*
                          * Trans: cümlenin içinde vurgulanan bir parça var ve
                          * o parçanın yeri dile göre değişiyor. Metni ikiye
                          * bölmek yerine bileşen yer tutucusu kullanılır.
                          */}
                        <p className="text-sm text-muted-foreground">
                            <Trans
                                i18nKey="auth.resetPage.intro"
                                values={{ email: user.email }}
                                components={[<span className="font-medium text-foreground" />]}
                            />
                        </p>

                        <div className="flex flex-col gap-1.5">
                            <label htmlFor={`${fieldId}-password`} className="text-sm font-medium">
                                {t('auth.resetPage.newPassword')}
                            </label>
                            <input
                                id={`${fieldId}-password`}
                                type="password"
                                autoComplete="new-password"
                                autoFocus
                                required
                                minLength={6}
                                disabled={isSubmitting}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('auth.passwordPlaceholder')}
                                className={inputClass}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label htmlFor={`${fieldId}-confirm`} className="text-sm font-medium">
                                {t('auth.resetPage.confirmPassword')}
                            </label>
                            <input
                                id={`${fieldId}-confirm`}
                                type="password"
                                autoComplete="new-password"
                                required
                                disabled={isSubmitting}
                                value={confirmation}
                                onChange={(e) => setConfirmation(e.target.value)}
                                placeholder={t('auth.resetPage.confirmPlaceholder')}
                                className={inputClass}
                            />
                        </div>

                        {errorKey && (
                            <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                                {t(errorKey)}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="h-11 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                            {t('auth.resetPage.submit')}
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}
