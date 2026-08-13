import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useTaskStore } from '../store';
import { runSync } from '../lib/sync';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'disabled';

type SyncProviderState = {
    status: SyncStatus;
    lastSyncedAt: string | null;
    /** Buluta gönderilmeyi bekleyen değişiklik sayısı. */
    pendingCount: number;
    errorMessage: string | null;
    syncNow: () => void;
};

const SyncProviderContext = createContext<SyncProviderState | undefined>(undefined);

/** Değişiklikten sonra senkronu bu kadar bekletip toplu gönderir. */
const DEBOUNCE_MS = 1500;

/**
 * Uygulama açık dururken bu aralıkla uzaktaki değişiklikler çekilir.
 * Realtime aboneliği yerine yoklama tercih edildi: bir görev listesi için
 * saniyelik tazelik gerekmiyor ve yoklamanın hareketli parçası çok daha az.
 */
const POLL_MS = 60_000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const { user, isConfigured } = useAuth();
    const [status, setStatus] = useState<SyncStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const lastSyncedAt = useTaskStore((state) => state.lastSyncedAt);
    const dirtyIds = useTaskStore((state) => state.dirtyIds);
    const tombstones = useTaskStore((state) => state.tombstones);
    const pendingCount = dirtyIds.length + tombstones.length;

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const userId = user?.id ?? null;

    // Etkin kullanıcıyı ref'te tutmak, ağ beklenirken çıkış yapıldığında
    // sonucun yansıtılmasını önler. Ref render sırasında değil efektte
    // güncellenir; bu efekt aşağıdakilerden önce tanımlı olduğu için onlar
    // çalıştığında değer güncel olur.
    const activeUserIdRef = useRef<string | null>(null);
    useEffect(() => {
        activeUserIdRef.current = userId;
    }, [userId]);

    const sync = useCallback(async (targetUserId: string) => {
        setStatus('syncing');
        const result = await runSync(targetUserId);

        // Senkron sürerken çıkış yapıldıysa veya kullanıcı değiştiyse yoksay.
        if (activeUserIdRef.current !== targetUserId) return;

        if (result.status === 'ok') {
            setStatus('idle');
            setErrorMessage(null);
        } else if (result.status === 'error') {
            setStatus('error');
            setErrorMessage(result.message);
        } else if (result.reason === 'offline') {
            setStatus('offline');
        } else if (result.reason === 'unavailable') {
            setStatus('disabled');
        } else {
            // 'busy': başka bir tur zaten çalışıyor, durum onun sonucuyla güncellenecek.
            setStatus('syncing');
        }
    }, []);

    // Giriş yapıldığında yereldeki her şey hesaba aktarılır, sonra senkronlanır.
    // Çıkış durumunda gösterilen değer aşağıda türetilir; burada bir şey
    // sıfırlamaya gerek yok (tekrar girişte ilk iş status 'syncing' olur).
    useEffect(() => {
        if (!userId) return;

        useTaskStore.getState().prepareForSync(userId);
        // set-state-in-effect: sync() ağ isteğini başlatır ve durumu yalnızca
        // istek ilerledikçe günceller. Kural, async fonksiyonun içindeki await
        // sınırını göremediği için burayı senkron setState sanıyor. Dış bir
        // sistemle (bulut) eşitlemeyi başlatmak efektlerin asıl kullanım amacı.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void sync(userId);
    }, [userId, sync]);

    // Bekleyen değişiklik oldukça senkronu tetikler (toplu göndermek için gecikmeli).
    useEffect(() => {
        if (!userId || pendingCount === 0) return;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { void sync(userId); }, DEBOUNCE_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [userId, pendingCount, sync]);

    // Bağlantı geri geldiğinde bekleyenleri gönder; sekmeye dönüldüğünde ve
    // düzenli aralıklarla diğer cihazlardaki değişiklikleri çek.
    useEffect(() => {
        if (!userId) return;

        const syncNow = () => { void sync(userId); };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') syncNow();
        };

        window.addEventListener('online', syncNow);
        document.addEventListener('visibilitychange', handleVisibility);
        const interval = setInterval(syncNow, POLL_MS);

        return () => {
            window.removeEventListener('online', syncNow);
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(interval);
        };
    }, [userId, sync]);

    const value = useMemo<SyncProviderState>(() => ({
        status: userId ? status : (isConfigured ? 'idle' : 'disabled'),
        lastSyncedAt,
        pendingCount,
        errorMessage,
        syncNow: () => { if (userId) void sync(userId); },
    }), [userId, status, isConfigured, lastSyncedAt, pendingCount, errorMessage, sync]);

    return (
        <SyncProviderContext.Provider value={value}>
            {children}
        </SyncProviderContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSync = () => {
    const context = useContext(SyncProviderContext);

    if (context === undefined)
        throw new Error('useSync must be used within a SyncProvider');

    return context;
};
