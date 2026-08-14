import type { TranslationKey } from '../i18n';
import { useTaskStore } from '../store';
import { mergeCategories, mergeTasks, remapTaskCategories } from './sync-merge';
import {
    deleteRemoteCategories,
    deleteRemoteTasks,
    fetchRemoteCategories,
    fetchRemoteTasks,
    pushRemoteCategories,
    pushRemoteTasks,
    SyncUnavailableError,
} from './task-repository';

export type SyncOutcome =
    | { status: 'ok'; pushed: number; pulled: number; deleted: number }
    | { status: 'skipped'; reason: 'unavailable' | 'offline' | 'busy' }
    | { status: 'error'; messageKey: TranslationKey };

/**
 * Aynı anda birden fazla senkron turu çalışmasın. İki tur çakışırsa biri
 * diğerinin yazdığı durumu eski verinin üzerine geri yazabilir.
 */
let inFlight = false;

/** Ham hatayı çeviri anahtarına indirger; metin arayüz katmanında üretilir. */
function errorKeyFor(error: unknown): TranslationKey {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
        return 'sync.error.network';
    }
    if (lower.includes('jwt') || lower.includes('token')) {
        return 'sync.error.expiredSession';
    }
    return 'sync.error.unknown';
}

/**
 * Bir senkron turu çalıştırır: uzaktaki durumu çeker, yerelle birleştirir,
 * farkları buluta yazar ve sonucu store'a uygular.
 *
 * **Sıra yabancı anahtar yüzünden serbest değildir.** `tasks.category_id`,
 * `categories` tablosuna bileşik bir FK ile bağlıdır:
 *
 *   1. Kategoriler önce yazılır — henüz var olmayan bir kategoriye bağlı görev
 *      göndermek 23503 ile reddedilir.
 *   2. Görevler yazılır ve silinir.
 *   3. Kategoriler en sonda silinir — bağlı görevler önce güncellensin diye.
 *
 * Yerel store birincil kaynaktır; bu fonksiyon başarısız olsa bile kullanıcının
 * verisi cihazda durur ve uygulama çalışmaya devam eder.
 */
export async function runSync(userId: string): Promise<SyncOutcome> {
    if (inFlight) return { status: 'skipped', reason: 'busy' };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return { status: 'skipped', reason: 'offline' };
    }

    inFlight = true;
    try {
        const [remoteCategories, remoteTasks] = await Promise.all([
            fetchRemoteCategories(),
            fetchRemoteTasks(),
        ]);

        // Ağ beklenirken kullanıcı değişiklik yapmış olabilir; durum tam da
        // birleştirme anında okunur.
        const state = useTaskStore.getState();

        const categoryPlan = mergeCategories({
            local: state.categories,
            remote: remoteCategories,
            dirtyIds: state.dirtyCategoryIds,
            tombstones: state.categoryTombstones,
        });

        const pushedCategories = await pushRemoteCategories(categoryPlan.toPush, userId);
        const pushedCategoryById = new Map(pushedCategories.map((c) => [c.id, c]));
        const categories = categoryPlan.categories.map((c) => pushedCategoryById.get(c.id) ?? c);

        // Görevlerin bağları, kategoriler kesinleştikten sonra çözülür:
        // tekilleştirilenler bulut id'sine taşınır, kalmayanlar boşaltılır.
        const validCategoryIds = new Set(categories.map((c) => c.id));
        const localTasks = remapTaskCategories(
            state.tasks,
            categoryPlan.idRemap,
            validCategoryIds
        );

        const plan = mergeTasks({
            local: localTasks,
            remote: remoteTasks,
            dirtyIds: state.dirtyIds,
            tombstones: state.tombstones,
        });

        const pushedTasks = await pushRemoteTasks(plan.toPush, userId);
        await deleteRemoteTasks(plan.toDelete);

        // Kategoriler en sonda silinir: bağlı görevler artık güncellendi.
        await deleteRemoteCategories(categoryPlan.toDelete);

        // Sunucunun döndürdüğü sürümler (tetikleyici tarafından tazelenmiş
        // updated_at ile) yerel kopyaların yerine geçer.
        const pushedById = new Map(pushedTasks.map((task) => [task.id, task]));
        const tasks = remapTaskCategories(
            plan.tasks.map((task) => pushedById.get(task.id) ?? task),
            categoryPlan.idRemap,
            validCategoryIds
        );

        useTaskStore.getState().applySyncResult({
            tasks,
            categories,
            syncedIds: [...plan.toPush.map((t) => t.id), ...plan.discardedIds],
            clearedTombstoneIds: [...plan.toDelete, ...plan.obsoleteTombstoneIds],
            syncedCategoryIds: [
                ...categoryPlan.toPush.map((c) => c.id),
                ...categoryPlan.discardedIds,
            ],
            clearedCategoryTombstoneIds: [
                ...categoryPlan.toDelete,
                ...categoryPlan.obsoleteTombstoneIds,
            ],
            syncedAt: new Date().toISOString(),
        });

        return {
            status: 'ok',
            pushed: plan.toPush.length + categoryPlan.toPush.length,
            pulled: remoteTasks.length,
            deleted: plan.toDelete.length + categoryPlan.toDelete.length,
        };
    } catch (error) {
        if (error instanceof SyncUnavailableError) {
            return { status: 'skipped', reason: 'unavailable' };
        }
        return { status: 'error', messageKey: errorKeyFor(error) };
    } finally {
        inFlight = false;
    }
}

/** Testler arasında kilidi sıfırlamak için. */
export function resetSyncLock() {
    inFlight = false;
}
