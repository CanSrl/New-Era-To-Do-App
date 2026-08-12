import { useEffect, useId, useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from './ui/dialog';

type Mode = 'signin' | 'signup' | 'reset';

const COPY: Record<Mode, { title: string; description: string; submit: string }> = {
    signin: {
        title: 'Giriş Yap',
        description: 'Görevlerini tüm cihazlarında eşitlemek için giriş yap.',
        submit: 'Giriş Yap',
    },
    signup: {
        title: 'Hesap Oluştur',
        description: 'Ücretsiz hesap oluştur, görevlerin güvende kalsın.',
        submit: 'Hesap Oluştur',
    },
    reset: {
        title: 'Parolamı Unuttum',
        description: 'Kayıtlı e-posta adresine sıfırlama bağlantısı gönderelim.',
        submit: 'Sıfırlama Bağlantısı Gönder',
    },
};

const inputClass =
    'flex h-11 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
    const { signIn, signUp, resetPassword } = useAuth();
    const fieldId = useId();

    const [mode, setMode] = useState<Mode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emailSent, setEmailSent] = useState<'confirm' | 'reset' | null>(null);

    // Diyalog her kapandığında formu sıfırla ki bir sonraki açılışta
    // eski hata mesajı veya parola ekranda kalmasın.
    useEffect(() => {
        if (open) return;
        const timer = setTimeout(() => {
            setMode('signin');
            setEmail('');
            setPassword('');
            setError(null);
            setEmailSent(null);
            setIsSubmitting(false);
        }, 200);
        return () => clearTimeout(timer);
    }, [open]);

    const switchMode = (next: Mode) => {
        setMode(next);
        setError(null);
        setEmailSent(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError('E-posta adresi gerekli.');
            return;
        }
        if (mode !== 'reset' && password.length < 6) {
            setError('Parola en az 6 karakter olmalı.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        if (mode === 'reset') {
            const { error } = await resetPassword(trimmedEmail);
            setIsSubmitting(false);
            if (error) {
                setError(error);
                return;
            }
            setEmailSent('reset');
            return;
        }

        if (mode === 'signup') {
            const { error, needsEmailConfirmation } = await signUp(trimmedEmail, password);
            setIsSubmitting(false);
            if (error) {
                setError(error);
                return;
            }
            if (needsEmailConfirmation) {
                setEmailSent('confirm');
                return;
            }
            toast.success('Hesabın oluşturuldu. Hoş geldin!');
            onOpenChange(false);
            return;
        }

        const { error } = await signIn(trimmedEmail, password);
        setIsSubmitting(false);
        if (error) {
            setError(error);
            return;
        }
        toast.success('Giriş yapıldı.');
        onOpenChange(false);
    };

    const copy = COPY[mode];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader className="flex-col items-start gap-1">
                    <DialogTitle>{copy.title}</DialogTitle>
                    <DialogDescription>{copy.description}</DialogDescription>
                </DialogHeader>

                {emailSent ? (
                    <div className="p-6 flex flex-col items-center text-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <MailCheck size={26} />
                        </div>
                        <h3 className="font-bold tracking-tight">E-postanı kontrol et</h3>
                        <p className="text-sm text-muted-foreground">
                            {emailSent === 'confirm'
                                ? `${email.trim()} adresine bir doğrulama bağlantısı gönderdik. Hesabını etkinleştirmek için bağlantıya tıkla.`
                                : `${email.trim()} adresine parola sıfırlama bağlantısı gönderdik.`}
                        </p>
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="mt-2 px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                        >
                            Kapat
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="p-5 flex flex-col gap-4">
                        {/*
                          * noValidate: required/minLength nitelikleri erişilebilirlik
                          * için duruyor, ancak doğrulamayı tarayıcının yerelleştirilmiş
                          * balonu değil kendi Türkçe mesajlarımız yapsın diye native
                          * doğrulama kapatılıyor.
                          */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor={`${fieldId}-email`} className="text-sm font-medium">
                                E-posta
                            </label>
                            <input
                                id={`${fieldId}-email`}
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                required
                                autoFocus
                                disabled={isSubmitting}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ornek@eposta.com"
                                className={inputClass}
                            />
                        </div>

                        {mode !== 'reset' && (
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor={`${fieldId}-password`} className="text-sm font-medium">
                                    Parola
                                </label>
                                <input
                                    id={`${fieldId}-password`}
                                    type="password"
                                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                    required
                                    minLength={6}
                                    disabled={isSubmitting}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="En az 6 karakter"
                                    className={inputClass}
                                />
                            </div>
                        )}

                        {error && (
                            <p
                                role="alert"
                                className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2"
                            >
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="h-11 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                            {copy.submit}
                        </button>

                        <div className="flex flex-col gap-2 text-sm text-center text-muted-foreground">
                            {mode === 'signin' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => switchMode('reset')}
                                        className="hover:text-foreground underline underline-offset-4 transition-colors"
                                    >
                                        Parolamı unuttum
                                    </button>
                                    <p>
                                        Hesabın yok mu?{' '}
                                        <button
                                            type="button"
                                            onClick={() => switchMode('signup')}
                                            className="text-primary font-medium hover:underline underline-offset-4"
                                        >
                                            Hesap oluştur
                                        </button>
                                    </p>
                                </>
                            )}
                            {mode === 'signup' && (
                                <p>
                                    Zaten hesabın var mı?{' '}
                                    <button
                                        type="button"
                                        onClick={() => switchMode('signin')}
                                        className="text-primary font-medium hover:underline underline-offset-4"
                                    >
                                        Giriş yap
                                    </button>
                                </p>
                            )}
                            {mode === 'reset' && (
                                <button
                                    type="button"
                                    onClick={() => switchMode('signin')}
                                    className="hover:text-foreground underline underline-offset-4 transition-colors"
                                >
                                    Girişe dön
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
