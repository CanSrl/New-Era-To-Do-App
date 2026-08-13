import { AlertCircle, Check, CloudOff, RefreshCw } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useSync } from './SyncProvider';

function formatLastSynced(iso: string | null): string | null {
    if (!iso) return null;

    const diffMs = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(diffMs)) return null;

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'az önce';
    if (minutes < 60) return `${minutes} dk önce`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} sa önce`;
    return `${Math.floor(hours / 24)} gün önce`;
}

/**
 * Senkron durumunu gösterir. Yalnızca giriş yapılmışken görünür — misafir
 * kullanımda senkron diye bir kavram yok.
 */
export function SyncIndicator() {
    const { user } = useAuth();
    const { status, lastSyncedAt, pendingCount, errorMessage, syncNow } = useSync();

    if (!user) return null;

    if (status === 'syncing') {
        return (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <RefreshCw size={12} className="animate-spin" />
                Eşitleniyor…
            </p>
        );
    }

    if (status === 'error') {
        return (
            <button
                onClick={syncNow}
                className="flex items-center gap-1.5 text-xs text-destructive hover:underline underline-offset-4"
                title={errorMessage ?? undefined}
            >
                <AlertCircle size={12} />
                Eşitlenemedi — yeniden dene
            </button>
        );
    }

    if (status === 'offline') {
        return (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <CloudOff size={12} />
                {pendingCount > 0
                    ? `Çevrimdışı — ${pendingCount} değişiklik bekliyor`
                    : 'Çevrimdışı'}
            </p>
        );
    }

    if (pendingCount > 0) {
        return (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <RefreshCw size={12} />
                {pendingCount} değişiklik bekliyor
            </p>
        );
    }

    const relative = formatLastSynced(lastSyncedAt);

    return (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Check size={12} className="text-green-500" />
            {relative ? `Eşitlendi · ${relative}` : 'Eşitlendi'}
        </p>
    );
}
