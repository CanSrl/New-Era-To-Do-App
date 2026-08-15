import { supabase } from './supabase';
import { rowToTask, taskToRow } from './task-mapping';
import { categoryToRow, rowToCategory } from './category-mapping';
import { clientToRow, projectToRow, rowToClient, rowToProject } from './niche-mapping';
import type { Category, Client, Project, Task } from './types';

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

// ---------------------------------------------------------------------------
// Niş modül: müşteriler ve projeler
// ---------------------------------------------------------------------------
//
// Bu blok yalnızca `features.nicheModule` açıkken çağrılır. Kapalıyken hiç
// çağrılmaması şart: modülü çıkarmış bir kurulumda `clients` tablosu yoktur ve
// sorgu "relation does not exist" ile düşerek GÖREV senkronunu da götürürdü.

/** Kullanıcının bulut üzerindeki tüm müşterilerini çeker. */
export async function fetchRemoteClients(): Promise<Client[]> {
    const { data, error } = await client().from('clients').select('*');
    if (error) throw new Error(error.message);
    return data.map(rowToClient);
}

/**
 * Müşterileri buluta yazar ve sunucunun kaydettiği hâllerini döner.
 *
 * Yazma zincirinin EN BAŞINDA çağrılmalıdır: hem `projects.client_id` hem
 * `tasks.client_id` buraya bileşik yabancı anahtarla bağlı.
 */
export async function pushRemoteClients(
    clients: readonly Client[],
    userId: string
): Promise<Client[]> {
    if (clients.length === 0) return [];

    const { data, error } = await client()
        .from('clients')
        .upsert(clients.map((c) => clientToRow(c, userId)), { onConflict: 'id' })
        .select();

    if (error) throw new Error(error.message);
    return data.map(rowToClient);
}

/**
 * Müşterileri buluttan siler.
 *
 * Silme zincirinin EN SONUNDA çağrılmalıdır. Sunucuda bu silme iki şey
 * tetikler: `clients_clear_tasks` bağlı görevlerin iki alanını da boşaltır,
 * ardından cascade projeleri siler. Bu yüzden silinen müşterinin projeleri
 * için ayrıca silme isteği gönderilmez — store da onlar için mezar taşı
 * bırakmıyor.
 */
export async function deleteRemoteClients(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await client().from('clients').delete().in('id', ids);
    if (error) throw new Error(error.message);
}

/** Kullanıcının bulut üzerindeki tüm projelerini çeker. */
export async function fetchRemoteProjects(): Promise<Project[]> {
    const { data, error } = await client().from('projects').select('*');
    if (error) throw new Error(error.message);
    return data.map(rowToProject);
}

/**
 * Projeleri buluta yazar. Müşterilerden SONRA, görevlerden ÖNCE çağrılmalıdır:
 * projeler müşterilere, görevler de projelere yabancı anahtarla bağlı.
 */
export async function pushRemoteProjects(
    projects: readonly Project[],
    userId: string
): Promise<Project[]> {
    if (projects.length === 0) return [];

    const { data, error } = await client()
        .from('projects')
        .upsert(projects.map((p) => projectToRow(p, userId)), { onConflict: 'id' })
        .select();

    if (error) throw new Error(error.message);
    return data.map(rowToProject);
}

/**
 * Projeleri buluttan siler.
 *
 * Görevler yazıldıktan SONRA çağrılmalıdır; bağlı görevler silinmez,
 * `on delete set null (project_id)` yalnızca proje bağını koparır.
 */
export async function deleteRemoteProjects(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await client().from('projects').delete().in('id', ids);
    if (error) throw new Error(error.message);
}
