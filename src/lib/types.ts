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
