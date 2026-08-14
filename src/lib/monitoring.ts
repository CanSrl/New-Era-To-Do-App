/**
 * Hata izleme sarmalayıcısı.
 *
 * Uygulama kodu Sentry'yi doğrudan import etmez, yalnızca bu modülü kullanır.
 * İki sebep var: starter kit alıcısı sağlayıcıyı tek dosyada değiştirebilsin
 * ve izleme kapalıyken kodun geri kalanı bundan hiç etkilenmesin.
 *
 * **Varsayılan kapalıdır.** `VITE_SENTRY_DSN` tanımlı değilse hiçbir ağ
 * isteği yapılmaz ve Sentry paketi indirilmez bile — `import()` yalnızca DSN
 * varken çalıştığı için Vite onu ayrı bir parçaya böler.
 */

/** DSN'i olmayan kurulumda izleme tamamen devre dışıdır. */
const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

export const isMonitoringConfigured = Boolean(dsn);

/**
 * Yüklenmiş Sentry modülü. `null` = hiç yapılandırılmadı,
 * bekleyen promise = yükleniyor.
 */
type SentryModule = typeof import('@sentry/react');
let sentry: SentryModule | null = null;
let loading: Promise<SentryModule | null> | null = null;

/**
 * Kullanıcıyı tanımlayan alanları temizler.
 *
 * Görev başlıkları ve e-posta adresleri kişisel veri sayılır; bir hata
 * raporunda bunların bulunması beklenmez. `sendDefaultPii` zaten kapalı ama
 * IP adresi ve çerezler yine de gönderilebiliyor, o yüzden açıkça atılıyorlar.
 */
function scrub<T extends { user?: unknown; request?: { cookies?: unknown } }>(event: T): T {
    delete event.user;
    if (event.request) delete event.request.cookies;
    return event;
}

/**
 * İzlemeyi başlatır. DSN yoksa hiçbir şey yapmaz.
 *
 * Uygulamanın açılışını bloklamaz: çağıran `await` etmek zorunda değildir,
 * yükleme arka planda tamamlanır.
 */
export function initMonitoring(): Promise<SentryModule | null> {
    if (loading) return loading;
    if (!dsn) {
        loading = Promise.resolve(null);
        return loading;
    }

    loading = import('@sentry/react')
        .then((module) => {
            module.init({
                dsn,
                // Ortam adı sürüm/dal ayrımını Sentry arayüzünde görünür kılar.
                environment: import.meta.env.MODE,
                // Kişisel veri varsayılan olarak gönderilmez; scrub ek güvence.
                sendDefaultPii: false,
                beforeSend: scrub,
                // Performans ve oturum tekrarı bilinçli olarak kapalı: ikisi de
                // ücretli kotayı hızla tüketiyor ve bu uygulama için gerekmiyor.
                tracesSampleRate: 0,
            });
            sentry = module;
            return module;
        })
        .catch((error) => {
            // İzlemenin yüklenememesi uygulamayı etkilememeli.
            console.error('Hata izleme başlatılamadı:', error);
            return null;
        });

    return loading;
}

/**
 * Bir hatayı izleme servisine bildirir.
 *
 * İzleme kapalıysa ya da modül henüz yüklenmediyse konsola düşer — hata
 * hiçbir koşulda sessizce yutulmaz.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
    if (sentry) {
        sentry.captureException(error, context ? { extra: context } : undefined);
        return;
    }

    console.error('Yakalanan hata:', error, context ?? '');

    // Yükleme sürerken gelen hata, modül hazır olunca yine gönderilir.
    if (loading) {
        void loading.then((module) => {
            if (!module) return;
            module.captureException(error, context ? { extra: context } : undefined);
        });
    }
}

/** Testler için: modül durumunu sıfırlar. */
export function resetMonitoringForTests(): void {
    sentry = null;
    loading = null;
}
