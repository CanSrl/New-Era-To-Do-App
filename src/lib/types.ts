export type Priority = 'Düşük' | 'Orta' | 'Yüksek';

export type Category = 'İş' | 'Kişisel' | 'Alışveriş' | 'Okul';

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
    category: Category;
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

export type FilterStatus = 'Tüm Görevler' | 'Aktif' | 'Tamamlandı';

export const PRIORITIES: readonly Priority[] = ['Düşük', 'Orta', 'Yüksek'];

export const CATEGORIES: readonly Category[] = ['İş', 'Kişisel', 'Alışveriş', 'Okul'];
