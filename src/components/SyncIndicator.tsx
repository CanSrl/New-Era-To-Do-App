import { AlertCircle, Check, CloudOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAuth } from './AuthProvider';
import { useSync } from './SyncProvider';

/**
 * "az önce", "5 dk önce" gibi göreli süre. Intl.RelativeTimeFormat yerine
 * çeviri anahtarları kullanılıyor: bu dört basamak için ek bir API yüzeyi
 * taşımaya değmiyor ve çoğullama i18next tarafında zaten çözülü.
 */
function formatLastSynced(iso: string | null, t: TFunction): string | null {
    if (!iso) return null;

    const diffMs = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(diffMs)) return null;

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return t('sync.justNow');
    if (minutes < 60) return t('sync.minutesAgo', { count: minutes });

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('sync.hoursAgo', { count: hours });
    return t('sync.daysAgo', { count: Math.floor(hours / 24) });
}

/**
 * Senkron durumunu gösterir. Yalnızca giriş yapılmışken görünür — misafir
 * kullanımda senkron diye bir kavram yok.
 */
export function SyncIndicator() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { status, lastSyncedAt, pendingCount, errorMessageKey, syncNow } = useSync();

    if (!user) return null;

    if (status === 'syncing') {
        return (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <RefreshCw size={12} className="animate-spin" />
                {t('sync.syncing')}
            </p>
        );
    }

    if (status === 'error') {
        return (
            <button
                onClick={syncNow}
                className="flex items-center gap-1.5 text-xs text-destructive hover:underline underline-offset-4"
                title={errorMessageKey ? t(errorMessageKey) : undefined}
            >
                <AlertCircle size={12} />
                {t('sync.failed')}
            </button>
        );
    }

    if (status === 'offline') {
        return (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <CloudOff size={12} />
                {pendingCount > 0
                    ? t('sync.offlinePending', { count: pendingCount })
                    : t('sync.offline')}
            </p>
        );
    }

    if (pendingCount > 0) {
        return (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <RefreshCw size={12} />
                {t('sync.pending', { count: pendingCount })}
            </p>
        );
    }

    const relative = formatLastSynced(lastSyncedAt, t);

    return (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Check size={12} className="text-green-500" />
            {relative ? t('sync.syncedAt', { relative }) : t('sync.synced')}
        </p>
    );
}
