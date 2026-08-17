import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthProvider';
import { pendingChangeCount, useTaskStore } from '../store';
import { runSync } from '../lib/sync';
// i18n doğrudan import ediliyor, `useTranslation` ile değil: `t` bir hook'tan
// gelseydi dil değişiminde kimliği değişir, `sync` useCallback'i yenilenir ve
// ona bağlı üç efekt yeniden çalışarak dil değiştirmeyi senkron tetikleyicisine
// çevirirdi. Bildirim zaten anlık; o andaki dil doğru dildir.
import i18n, { type TranslationKey } from '../i18n';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'disabled';

type SyncProviderState = {
    status: SyncStatus;
    lastSyncedAt: string | null;
    /** Buluta gönderilmeyi bekleyen değişiklik sayısı. */
    pendingCount: number;
    /** Çeviri anahtarı; metin arayüzde üretilir. */
    errorMessageKey: TranslationKey | null;
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
    const [errorMessageKey, setErrorMessageKey] = useState<TranslationKey | null>(null);

    const lastSyncedAt = useTaskStore((state) => state.lastSyncedAt);
    /**
     * HER kayıt türü sayılmak zorunda: senkron yalnızca bu sayı değişince
     * tetikleniyor. Bir tür sayılmazsa o türdeki ekleme/silme bir sonraki
     * yoklamaya (dakikada bir) kadar buluta hiç gitmez — kategorilerde bir kez
     * gerçekten yaşandı ve sessizce başarısız oldu.
     *
     * Toplam bu yüzden burada elle yazılmıyor: `pendingChangeCount` store'un
     * bekleyen alanlarının tamamını dolaşır ve `index.test.ts` listenin eksik
     * kalmadığını doğrular. Seçici bir sayı döndürüyor, dolayısıyla yeni bir
     * alan eklendiğinde burada değişiklik gerekmez.
     */
    const pendingCount = useTaskStore(pendingChangeCount);

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
            setErrorMessageKey(null);

            // Çakışmayı kaybeden yerel değişiklikler artık sessizce gitmiyor.
            // Son yazan kazanır kuralı korunuyor — değişen tek şey, kullanıcının
            // ne olduğunu öğrenmesi.
            if (result.discarded > 0) {
                toast.warning(i18n.t('sync.discarded', { count: result.discarded }));
            }
        } else if (result.status === 'error') {
            setStatus('error');
            setErrorMessageKey(result.messageKey);
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
        errorMessageKey,
        syncNow: () => { if (userId) void sync(userId); },
    }), [userId, status, isConfigured, lastSyncedAt, pendingCount, errorMessageKey, sync]);

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
