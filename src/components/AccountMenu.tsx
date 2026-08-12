import { LogIn, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useAuth } from './AuthProvider';

interface AccountMenuProps {
    /** 'sidebar' masaüstü kenar çubuğu için, 'compact' mobil üst bar için. */
    variant: 'sidebar' | 'compact';
    onSignInClick: () => void;
}

export function AccountMenu({ variant, onSignInClick }: AccountMenuProps) {
    const { user, isLoading, isConfigured, signOut } = useAuth();

    // Bulut senkronizasyonu yapılandırılmamışsa hesap arayüzü hiç görünmez;
    // uygulama tamamen yerel modda çalışmaya devam eder.
    if (!isConfigured) return null;

    const handleSignOut = async () => {
        const { error } = await signOut();
        if (error) {
            toast.error(error);
            return;
        }
        toast.success('Çıkış yapıldı. Görevlerin bu cihazda duruyor.');
    };

    if (variant === 'compact') {
        if (isLoading) {
            return <div className="w-9 h-9 rounded-full bg-secondary animate-pulse" aria-hidden="true" />;
        }
        return user ? (
            <button
                onClick={handleSignOut}
                className="p-2 rounded-full bg-secondary text-secondary-foreground"
                aria-label={`Çıkış yap (${user.email})`}
                title={user.email}
            >
                <LogOut size={18} />
            </button>
        ) : (
            <button
                onClick={onSignInClick}
                className="p-2 rounded-full bg-secondary text-secondary-foreground"
                aria-label="Giriş yap"
            >
                <LogIn size={18} />
            </button>
        );
    }

    if (isLoading) {
        return <div className="h-11 rounded-lg bg-secondary/50 animate-pulse" aria-hidden="true" />;
    }

    return user ? (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/50">
            <div className="w-7 h-7 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <User size={15} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground leading-tight">Giriş yapıldı</p>
                <p className="text-sm font-medium truncate leading-tight" title={user.email}>
                    {user.email}
                </p>
            </div>
            <button
                onClick={handleSignOut}
                className="p-1.5 shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                aria-label="Çıkış yap"
                title="Çıkış yap"
            >
                <LogOut size={16} />
            </button>
        </div>
    ) : (
        <button
            onClick={onSignInClick}
            className={cn(
                'w-full flex items-center justify-center gap-2 h-11 rounded-lg',
                'bg-secondary text-secondary-foreground font-medium text-sm',
                'hover:bg-secondary/80 transition-colors'
            )}
        >
            <LogIn size={16} />
            Giriş Yap
        </button>
    );
}
