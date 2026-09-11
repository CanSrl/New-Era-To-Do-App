/**
 * Öncelik dile bağımsız anahtarlarla tutulur.
 *
 * Eskiden istemcide Türkçe etiketlerdi (`'Düşük'|'Orta'|'Yüksek'`) ve
 * veritabanı sınırında çevriliyordu. i18n bunu sürdürülemez kıldı: etiket
 * hem tipin kendisi hem de ekranda görünen metin olamaz. Görünen karşılıklar
 * artık çeviri dosyalarında (`task.priority.*`).
 */
export type Priority = 'low' | 'medium' | 'high';

/**
 * Kullanıcı tanımlı görev kategorisi.
 *
 * Eskiden dört değerli sabit bir union'dı. Artık kullanıcıya ait bir kayıt:
 * adı ve rengi düzenlenebilir, silinebilir, yenisi eklenebilir.
 */
export interface Category {
    id: string;
    name: string;
    /** '#rrggbb' — veritabanı kısıtı da bu biçimi zorunlu tutar. */
    color: string;
    /** Kullanıcı tanımlı sıralama anahtarı; küçük değer listede önde. */
    position: number;
    /** ISO 8601 zaman damgası. */
    createdAt: string;
    /** ISO 8601 zaman damgası; çakışma bu alana göre çözülür. */
    updatedAt: string;
}

/**
 * Niş modül: kullanıcının müşterisi.
 *
 * Renk alanı bilinçli olarak yok: görev satırında zaten kategori renk rozeti
 * var, ikinci renkli rozet gürültü olurdu.
 */
export interface Client {
    id: string;
    name: string;
    /**
     * Arşivlenmiş kayıt seçicilerde gizlenir ama geçmiş görevlerin bağı
     * korunur. Silme tek seçenek olsaydı iki yıllık müşteri geçmişi ya
     * birikir ya da görev bağlarını koparırdı.
     */
    archived: boolean;
    /** Kullanıcı tanımlı sıralama anahtarı; küçük değer listede önde. */
    position: number;
    /**
     * Saatlik ücret. Zorunlu ve varsayılanı 0 — "ücret girilmemiş" ile
     * "ücretsiz" arasında müşteri seviyesinde ayrım yapılmıyor; ayrım
     * projedeki null/0 farkında yaşıyor.
     */
    hourlyRate: number;
    /** ISO 4217, üç harf. Dönüşüm yapılmaz; toplamlar para birimi başına alınır. */
    currency: string;
    /** ISO 8601 zaman damgası. */
    createdAt: string;
    /** ISO 8601 zaman damgası; çakışma bu alana göre çözülür. */
    updatedAt: string;
}

/**
 * Niş modül: bir müşteriye ait proje.
 *
 * `Client`'ı genişletmez: `hourlyRate`'i `number`'dan `number | null`'a
 * daraltmak TypeScript'te geçersizdir. Bunun yerine `Client`'ın o alan
 * dışındaki gövdesi üzerine kurulur.
 */
export interface Project extends Omit<Client, 'hourlyRate'> {
    /** Her proje bir müşteriye aittir; şemada da `not null`. */
    clientId: string;
    /**
     * Müşteriyi ezen opsiyonel ücret. `null` = miras, `0` = bu proje
     * ücretsiz. İkisi FARKLIDIR; çözerken `??` kullanılır, `||` değil.
     */
    hourlyRate: number | null;
}

/** Niş modül: bir müşteri/proje/göreve bağlı zaman kaydı. */
export interface TimeLog {
    id: string;
    /** Bağlı görev; opsiyonel — bağımsız (görevsiz) zaman kaydı da mümkün. */
    taskId: string | null;
    /** Zorunlu — müşterisiz zaman kaydı şemada da imkânsız. */
    clientId: string;
    /**
     * Bağlı proje. Doluysa projenin müşterisi `clientId` ile aynıdır; bunu
     * `time_logs_project_id_client_id_user_id_fkey` üçlüsü garanti eder.
     * (`Task`'takinin aksine burada ayrı bir "proje varsa müşteri de olmalı"
     * check'i yok — `client_id` zaten `not null`.)
     */
    projectId: string | null;
    /** ISO 8601 zaman damgası: kaydın başlangıcı. */
    startedAt: string;
    /** Veritabanı kısıtıyla aynı tavan: `TIME_LOG_MAX_MINUTES`. */
    durationMinutes: number;
    note: string | null;
    /** ISO 8601 zaman damgası. */
    createdAt: string;
    /** ISO 8601 zaman damgası; çakışma bu alana göre çözülür. */
    updatedAt: string;
}

/**
 * O an çalışan sayaç. Ayrı bir tip: `TimeLog`'un aksine `durationMinutes`
 * henüz yok, `startedAt`'ten türetilir (bkz. `elapsedMinutes`).
 */
export interface ActiveTimer {
    taskId: string | null;
    clientId: string;
    projectId: string | null;
    startedAt: string;
    note: string | null;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    /**
     * Takvim tarihi, 'YYYY-MM-DD' biçiminde. Bilinçli olarak Date değil:
     * bitiş tarihi bir güne işaret eder, bir ana değil. Date kullanmak
     * saat dilimine göre günün kaymasına yol açıyordu.
     */
    dueDate?: string;
    priority: Priority;
    completed: boolean;
    /**
     * Bağlı kategori. `null` "Kategorisiz" demektir — kategori silindiğinde
     * görev silinmez, bu alan boşalır (veritabanında `on delete set null`).
     */
    categoryId: string | null;
    /**
     * Bağlı müşteri. `projectId` doluysa bu da dolu olmak zorundadır —
     * şemadaki `tasks_project_requires_client` kısıtının istemci karşılığı.
     */
    clientId: string | null;
    /**
     * Bağlı proje. Doluysa projenin müşterisi `clientId` ile aynıdır; bunu
     * `tasks_project_id_client_id_user_id_fkey` üçlüsü garanti eder.
     */
    projectId: string | null;
    /** ISO 8601 zaman damgası. */
    createdAt: string;
    /**
     * ISO 8601 zaman damgası; her değişiklikte tazelenir.
     * Senkronizasyonda çakışma bu alana göre çözülür (son yazan kazanır).
     */
    updatedAt: string;
    /** Kullanıcı tanımlı sıralama anahtarı; küçük değer listede üstte. */
    position: number;
}

export type FilterStatus = 'all' | 'active' | 'completed';

export const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high'];

export const FILTERS: readonly FilterStatus[] = ['all', 'active', 'completed'];

/** Faturalama planı. `is_pro` SQL fonksiyonunun istemci ikizi. */
export type PlanStatus = 'free' | 'pro' | 'pastDue';

/**
 * `subscriptions` satırının istemci görünümü. Salt okunur — yazan webhook.
 * Durum metni sağlayıcıdan geldiği gibi saklanır.
 */
export interface Subscription {
    userId: string;
    provider: string;
    providerSubscriptionId: string;
    providerCustomerId: string | null;
    status: string;
    variantId: string | null;
    renewsAt: string | null;
    endsAt: string | null;
    trialEndsAt: string | null;
    testMode: boolean;
    createdAt: string;
    updatedAt: string;
}
