import { supabase } from './supabase';
import { rowToTask, taskToRow } from './task-mapping';
import { categoryToRow, rowToCategory } from './category-mapping';
import type { Category, Task } from './types';

/** Supabase yapılandırılmamışken senkron çağrıldığında atılır. */
export class SyncUnavailableError extends Error {
    constructor() {
        super('Bulut senkronizasyonu yapılandırılmamış.');
        this.name = 'SyncUnavailableError';
    }
}

function client() {
    if (!supabase) throw new SyncUnavailableError();
    return supabase;
}

/**
 * Kullanıcının bulut üzerindeki tüm görevlerini çeker.
 *
 * Tam anlık görüntü alınır: uzaktaki silmeler ancak "yerelde var, uzakta yok"
 * karşılaştırmasıyla anlaşılabildiği için kısmi çekme yeterli olmaz.
 * Bu yaklaşım birkaç bin göreve kadar rahat çalışır; ötesinde artımlı çekme
 * ve sunucu tarafında mezar taşı tablosu gerekir.
 */
export async function fetchRemoteTasks(): Promise<Task[]> {
    const { data, error } = await client().from('tasks').select('*');
    if (error) throw new Error(error.message);
    return data.map(rowToTask);
}

/**
 * Görevleri buluta yazar ve sunucunun kaydettiği hâllerini döner.
 *
 * Dönen satırlar önemlidir: veritabanındaki tetikleyici updated_at alanını
 * kendi saatiyle yeniden yazar. Sunucu sürümü alınmazsa yereldeki damga
 * geride kalır ve bir sonraki turda "uzak daha yeni" sanılıp görev boş yere
 * yeniden indirilir.
 */
export async function pushRemoteTasks(tasks: readonly Task[], userId: string): Promise<Task[]> {
    if (tasks.length === 0) return [];

    const { data, error } = await client()
        .from('tasks')
        .upsert(tasks.map((task) => taskToRow(task, userId)), { onConflict: 'id' })
        .select();

    if (error) throw new Error(error.message);
    return data.map(rowToTask);
}

/** Görevleri buluttan siler. RLS gereği yalnızca kullanıcının kendi satırları etkilenir. */
export async function deleteRemoteTasks(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await client().from('tasks').delete().in('id', ids);
    if (error) throw new Error(error.message);
}

/** Kullanıcının bulut üzerindeki tüm kategorilerini çeker. */
export async function fetchRemoteCategories(): Promise<Category[]> {
    const { data, error } = await client().from('categories').select('*');
    if (error) throw new Error(error.message);
    return data.map(rowToCategory);
}

/**
 * Kategorileri buluta yazar ve sunucunun kaydettiği hâllerini döner.
 *
 * Görevlerden ÖNCE çağrılmalıdır: görev satırındaki category_id bir yabancı
 * anahtardır, kategori henüz yokken görev yazmak 23503 ile reddedilir.
 */
export async function pushRemoteCategories(
    categories: readonly Category[],
    userId: string
): Promise<Category[]> {
    if (categories.length === 0) return [];

    const { data, error } = await client()
        .from('categories')
        .upsert(categories.map((c) => categoryToRow(c, userId)), { onConflict: 'id' })
        .select();

    if (error) throw new Error(error.message);
    return data.map(rowToCategory);
}

/**
 * Kategorileri buluttan siler.
 *
 * Görevler yazıldıktan SONRA çağrılmalıdır. Sıra tersine dönerse, silinen
 * kategoriye bağlı bir görevi aynı turda göndermek yabancı anahtar hatası
 * verirdi. Bağlı görevler silinmez; `on delete set null` yalnızca bağı koparır.
 */
export async function deleteRemoteCategories(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await client().from('categories').delete().in('id', ids);
    if (error) throw new Error(error.message);
}
