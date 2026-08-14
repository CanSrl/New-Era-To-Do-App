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
    /** ISO 8601 zaman damgası. */
    createdAt: string;
    /** ISO 8601 zaman damgası; çakışma bu alana göre çözülür. */
    updatedAt: string;
}

/** Niş modül: bir müşteriye ait proje. */
export interface Project extends Client {
    /** Her proje bir müşteriye aittir; şemada da `not null`. */
    clientId: string;
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
