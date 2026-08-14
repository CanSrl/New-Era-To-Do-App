import { useEffect, useId, useState } from 'react';
import { Github, Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { features } from '../config/features';
import type { TranslationKey } from '../i18n';
import { cn } from '../lib/utils';
import { useAuth } from './AuthProvider';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from './ui/dialog';

type Mode = 'signin' | 'signup' | 'reset';

const inputClass =
    'flex h-11 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
    const { t } = useTranslation();
    const { signIn, signUp, resetPassword, signInWithGitHub } = useAuth();
    const fieldId = useId();

    const [mode, setMode] = useState<Mode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    /**
     * Hata hazır metin değil, çeviri anahtarı olarak tutulur: dil
     * değiştirildiğinde ekranda duran hata da yeni dile geçsin diye.
     */
    const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [emailSent, setEmailSent] = useState<'confirm' | 'reset' | null>(null);

    // Diyalog her kapandığında formu sıfırla ki bir sonraki açılışta
    // eski hata mesajı veya parola ekranda kalmasın.
    useEffect(() => {
        if (open) return;
        const timer = setTimeout(() => {
            setMode('signin');
            setEmail('');
            setPassword('');
            setErrorKey(null);
            setEmailSent(null);
            setIsSubmitting(false);
            setIsRedirecting(false);
        }, 200);
        return () => clearTimeout(timer);
    }, [open]);

    const switchMode = (next: Mode) => {
        setMode(next);
        setErrorKey(null);
        setEmailSent(null);
    };

    /**
     * Başarılı olduğunda sayfa GitHub'a gider ve bu bileşen sökülür; bu yüzden
     * `isRedirecting` yalnızca hata durumunda geri alınır. Erken sıfırlansaydı
     * yönlendirme başlarken buton bir an tekrar tıklanabilir hale gelirdi.
     */
    const handleGitHub = async () => {
        if (isSubmitting || isRedirecting) return;

        setIsRedirecting(true);
        setErrorKey(null);

        const { errorKey: failure } = await signInWithGitHub();
        if (failure) {
            setIsRedirecting(false);
            setErrorKey(failure);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || isRedirecting) return;

        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setErrorKey('auth.emailRequired');
            return;
        }
        if (mode !== 'reset' && password.length < 6) {
            setErrorKey('auth.passwordTooShort');
            return;
        }

        setIsSubmitting(true);
        setErrorKey(null);

        if (mode === 'reset') {
            const { errorKey: failure } = await resetPassword(trimmedEmail);
            setIsSubmitting(false);
            if (failure) {
                setErrorKey(failure);
                return;
            }
            setEmailSent('reset');
            return;
        }

        if (mode === 'signup') {
            const { errorKey: failure, needsEmailConfirmation } =
                await signUp(trimmedEmail, password);
            setIsSubmitting(false);
            if (failure) {
                setErrorKey(failure);
                return;
            }
            if (needsEmailConfirmation) {
                setEmailSent('confirm');
                return;
            }
            toast.success(t('auth.accountCreated'));
            onOpenChange(false);
            return;
        }

        const { errorKey: failure } = await signIn(trimmedEmail, password);
        setIsSubmitting(false);
        if (failure) {
            setErrorKey(failure);
            return;
        }
        toast.success(t('auth.signedIn'));
        onOpenChange(false);
    };

    const isBusy = isSubmitting || isRedirecting;
    // Sıfırlama modunda sağlayıcı butonu anlamsız: GitHub hesabının parolası
    // burada sıfırlanmaz.
    const showProviders = features.githubAuth && mode !== 'reset';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader className="flex-col items-start gap-1">
                    <DialogTitle>{t(`auth.${mode}.title`)}</DialogTitle>
                    <DialogDescription>{t(`auth.${mode}.description`)}</DialogDescription>
                </DialogHeader>

                {emailSent ? (
                    <div className="p-6 flex flex-col items-center text-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <MailCheck size={26} />
                        </div>
                        <h3 className="font-bold tracking-tight">{t('auth.checkEmailTitle')}</h3>
                        <p className="text-sm text-muted-foreground">
                            {emailSent === 'confirm'
                                ? t('auth.checkEmailConfirm', { email: email.trim() })
                                : t('auth.checkEmailReset', { email: email.trim() })}
                        </p>
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="mt-2 px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                        >
                            {t('common.close')}
                        </button>
                    </div>
                ) : (
                    <>
                        {showProviders && (
                            <div className="px-5 pt-5 flex flex-col gap-4">
                                <button
                                    type="button"
                                    onClick={handleGitHub}
                                    disabled={isBusy}
                                    className="h-11 border border-input rounded-xl font-medium hover:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isRedirecting ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Github size={18} aria-hidden="true" />
                                    )}
                                    {t('auth.github')}
                                </button>

                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                                    {t('auth.orEmail')}
                                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                                </div>
                            </div>
                        )}

                        <form
                            onSubmit={handleSubmit}
                            noValidate
                            className={cn('p-5 flex flex-col gap-4', showProviders && 'pt-4')}
                        >
                            {/*
                              * noValidate: required/minLength nitelikleri erişilebilirlik
                              * için duruyor, ancak doğrulamayı tarayıcının yerelleştirilmiş
                              * balonu değil kendi mesajlarımız yapsın diye native
                              * doğrulama kapatılıyor.
                              */}
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor={`${fieldId}-email`} className="text-sm font-medium">
                                    {t('auth.email')}
                                </label>
                                <input
                                    id={`${fieldId}-email`}
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    required
                                    autoFocus
                                    disabled={isBusy}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('auth.emailPlaceholder')}
                                    className={inputClass}
                                />
                            </div>

                            {mode !== 'reset' && (
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor={`${fieldId}-password`}
                                        className="text-sm font-medium"
                                    >
                                        {t('auth.password')}
                                    </label>
                                    <input
                                        id={`${fieldId}-password`}
                                        type="password"
                                        autoComplete={
                                            mode === 'signup' ? 'new-password' : 'current-password'
                                        }
                                        required
                                        minLength={6}
                                        disabled={isBusy}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={t('auth.passwordPlaceholder')}
                                        className={inputClass}
                                    />
                                </div>
                            )}

                            {errorKey && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2"
                                >
                                    {t(errorKey)}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isBusy}
                                className="h-11 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                                {t(`auth.${mode}.submit`)}
                            </button>

                            <div className="flex flex-col gap-2 text-sm text-center text-muted-foreground">
                                {mode === 'signin' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => switchMode('reset')}
                                            className="hover:text-foreground underline underline-offset-4 transition-colors"
                                        >
                                            {t('auth.forgotPassword')}
                                        </button>
                                        <p>
                                            {t('auth.noAccount')}{' '}
                                            <button
                                                type="button"
                                                onClick={() => switchMode('signup')}
                                                className="text-primary font-medium hover:underline underline-offset-4"
                                            >
                                                {t('auth.createAccount')}
                                            </button>
                                        </p>
                                    </>
                                )}
                                {mode === 'signup' && (
                                    <p>
                                        {t('auth.haveAccount')}{' '}
                                        <button
                                            type="button"
                                            onClick={() => switchMode('signin')}
                                            className="text-primary font-medium hover:underline underline-offset-4"
                                        >
                                            {t('auth.signIn')}
                                        </button>
                                    </p>
                                )}
                                {mode === 'reset' && (
                                    <button
                                        type="button"
                                        onClick={() => switchMode('signin')}
                                        className="hover:text-foreground underline underline-offset-4 transition-colors"
                                    >
                                        {t('auth.backToSignIn')}
                                    </button>
                                )}
                            </div>
                        </form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
