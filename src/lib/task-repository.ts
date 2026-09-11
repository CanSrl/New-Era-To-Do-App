import { supabase } from './supabase';
import { rowToTask, taskToRow } from './task-mapping';
import { categoryToRow, rowToCategory } from './category-mapping';
import {
    clientToRow,
    projectToRow,
    rowToClient,
    rowToProject,
    rowToTimeLog,
    timeLogToRow,
} from './niche-mapping';
import type { Category, Client, Project, Subscription, Task, TimeLog } from './types';
import type { TranslationKey } from '../i18n';
import { classifySyncError, toSyncError } from './sync-errors';

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
 * PostgREST tek yanıtta en fazla bu kadar satır döndürür (Supabase'in
 * `max-rows` varsayılanı). Sınır **sessizdir**: 1000 satır dönerse bunun
 * "hepsi bu" mu yoksa "kırpıldı" mı olduğu yanıttan anlaşılmaz.
 */
const PAGE_SIZE = 1000;

/**
 * Bir turda çekilebilecek toplam satır tavanı.
 *
 * Sayfalama olmadan senkron sessizce yanlış çalışırdı: 1000'inci satırdan
 * sonrası "uzakta yok" sayılır, birleştirme motoru da onları **yerelden
 * silinmiş** kabul edip gerçekten silerdi. Yani veri kaybı, hata değil.
 *
 * Tavan bunun yerine açık bir hata üretir. Tam anlık görüntü modeli
 * (`fetchRemoteTasks` açıklamasına bakınız) bu ölçekten sonra zaten
 * sürdürülemez; artımlı çekme + sunucu tarafı mezar taşı gerekir.
 */
const MAX_ROWS = 10_000;

/** Bulut verisi tek turda çekilemeyecek kadar büyüdüğünde atılır. */
export class SyncTooLargeError extends Error {
    // Alan açıkça tanımlanıyor: `tsconfig` `erasableSyntaxOnly` kullanıyor,
    // yani constructor parametre özelliği (`public readonly table`) yasak.
    readonly table: string;

    constructor(table: string) {
        super(`"${table}" tablosu tek turda çekme sınırını (${MAX_ROWS}) aştı.`);
        this.name = 'SyncTooLargeError';
        this.table = table;
    }
}

/**
 * Bir tabloyu sayfa sayfa, sonuna kadar çeker.
 *
 * `order('id')` şart: PostgREST'te sıralamasız `range()` sayfalar arasında
 * tutarlı bir düzen garanti etmez, yani aynı satır iki sayfada birden
 * gelebilir ya da hiç gelmeyebilir.
 */
async function fetchAllRows<Row>(
    table: string,
    query: (from: number, to: number) => PromiseLike<{
        data: Row[] | null;
        error: { message: string } | null;
    }>
): Promise<Row[]> {
    const rows: Row[] = [];

    for (let from = 0; ; from += PAGE_SIZE) {
        if (from >= MAX_ROWS) throw new SyncTooLargeError(table);

        const { data, error } = await query(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);

        const page = data ?? [];
        rows.push(...page);

        // Dolu olmayan sayfa son sayfadır.
        if (page.length < PAGE_SIZE) return rows;
    }
}

/**
 * Kullanıcının bulut üzerindeki tüm görevlerini çeker.
 *
 * Tam anlık görüntü alınır: uzaktaki silmeler ancak "yerelde var, uzakta yok"
 * karşılaştırmasıyla anlaşılabildiği için kısmi çekme yeterli olmaz.
 * Bu yaklaşım birkaç bin göreve kadar rahat çalışır; ötesinde artımlı çekme
 * ve sunucu tarafında mezar taşı tablosu gerekir — `MAX_ROWS` o eşiği
 * sessiz veri kaybı yerine açık hataya çevirir.
 */
export async function fetchRemoteTasks(): Promise<Task[]> {
    const rows = await fetchAllRows('tasks', (from, to) =>
        client().from('tasks').select('*').order('id').range(from, to)
    );
    return rows.map(rowToTask);
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
    const rows = await fetchAllRows('categories', (from, to) =>
        client().from('categories').select('*').order('id').range(from, to)
    );
    return rows.map(rowToCategory);
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
    const rows = await fetchAllRows('clients', (from, to) =>
        client().from('clients').select('*').order('id').range(from, to)
    );
    return rows.map(rowToClient);
}

export interface BlockedPush {
    id: string;
    code: string;
    messageKey: TranslationKey;
}

export interface IsolatedPush<T> {
    written: T[];
    blocked: BlockedPush[];
}

/**
 * Müşterileri buluta yazar ve sunucunun kaydettiği hâllerini döner.
 *
 * Yazma zincirinin EN BAŞINDA çağrılmalıdır: hem `projects.client_id` hem
 * `tasks.client_id` buraya bileşik yabancı anahtarla bağlı.
 *
 * Toplu upsert kalıcı bir hata alırsa satır satır yeniden denenir: PostgREST
 * hangi satırın suçlu olduğunu söylemez. Geçici hatada tur düşer.
 */
export async function pushRemoteClients(
    clients: readonly Client[],
    userId: string
): Promise<IsolatedPush<Client>> {
    if (clients.length === 0) return { written: [], blocked: [] };

    const rows = clients.map((c) => clientToRow(c, userId));
    const { data, error } = await client()
        .from('clients')
        .upsert(rows, { onConflict: 'id' })
        .select();

    if (!error) return { written: (data ?? []).map(rowToClient), blocked: [] };

    const classified = classifySyncError(toSyncError(error));
    if (classified.kind !== 'terminal') throw toSyncError(error);

    const written: Client[] = [];
    const blocked: BlockedPush[] = [];
    for (const c of clients) {
        const one = await client()
            .from('clients')
            .upsert(clientToRow(c, userId), { onConflict: 'id' })
            .select()
            .single();
        if (!one.error && one.data) {
            written.push(rowToClient(one.data));
            continue;
        }
        const syncError = toSyncError(one.error ?? { message: 'unknown', code: '' });
        const kind = classifySyncError(syncError);
        if (kind.kind === 'terminal') {
            blocked.push({ id: c.id, code: syncError.code, messageKey: kind.messageKey });
        } else {
            throw syncError;
        }
    }
    return { written, blocked };
}

export function rowToSubscription(row: {
    user_id: string;
    provider: string;
    provider_subscription_id: string;
    provider_customer_id: string | null;
    status: string;
    variant_id: string | null;
    renews_at: string | null;
    ends_at: string | null;
    trial_ends_at: string | null;
    test_mode: boolean;
    created_at: string;
    updated_at: string;
}): Subscription {
    return {
        userId: row.user_id,
        provider: row.provider,
        providerSubscriptionId: row.provider_subscription_id,
        providerCustomerId: row.provider_customer_id,
        status: row.status,
        variantId: row.variant_id,
        renewsAt: row.renews_at,
        endsAt: row.ends_at,
        trialEndsAt: row.trial_ends_at,
        testMode: row.test_mode,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/** Kullanıcının abonelik satırı. Yoksa null — ücretsiz plan. */
export async function fetchRemoteSubscription(): Promise<Subscription | null> {
    const { data, error } = await client()
        .from('subscriptions')
        .select('*')
        .maybeSingle();
    if (error) throw toSyncError(error);
    return data ? rowToSubscription(data) : null;
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
    const rows = await fetchAllRows('projects', (from, to) =>
        client().from('projects').select('*').order('id').range(from, to)
    );
    return rows.map(rowToProject);
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

/** Kullanıcının bulut üzerindeki tüm zaman kayıtlarını çeker. */
export async function fetchRemoteTimeLogs(): Promise<TimeLog[]> {
    const rows = await fetchAllRows('time_logs', (from, to) =>
        client().from('time_logs').select('*').order('id').range(from, to)
    );
    return rows.map(rowToTimeLog);
}

/**
 * Zaman kayıtlarını buluta yazar ve sunucunun kaydettiği hâllerini döner.
 *
 * Yazma zincirinin EN SONUNDA çağrılmalıdır: kayıt üç tabloya birden bağlı
 * (`tasks`, `clients`, `projects`) ve hepsinin hedefi önce var olmalı. Aynı
 * turda oluşturulmuş bir göreve bağlı kaydı görevden önce göndermek 23503 ile
 * reddedilir ve o turdaki bütün senkron onunla düşer.
 */
export async function pushRemoteTimeLogs(
    logs: readonly TimeLog[],
    userId: string
): Promise<TimeLog[]> {
    if (logs.length === 0) return [];

    const { data, error } = await client()
        .from('time_logs')
        .upsert(logs.map((l) => timeLogToRow(l, userId)), { onConflict: 'id' })
        .select();

    if (error) throw new Error(error.message);
    return data.map(rowToTimeLog);
}

/**
 * Zaman kayıtlarını buluttan siler.
 *
 * Silme zincirinin EN BAŞINDA çağrılmalıdır: kayıt referans veren taraftır,
 * referans verdiği görev/proje/müşteriden önce gitmelidir.
 */
export async function deleteRemoteTimeLogs(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await client().from('time_logs').delete().in('id', ids);
    if (error) throw new Error(error.message);
}
