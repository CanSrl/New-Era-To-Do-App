import { useTaskStore } from '../store';
import { mergeTasks } from './sync-merge';
import { deleteRemoteTasks, fetchRemoteTasks, pushRemoteTasks, SyncUnavailableError } from './task-repository';

export type SyncOutcome =
    | { status: 'ok'; pushed: number; pulled: number; deleted: number }
    | { status: 'skipped'; reason: 'unavailable' | 'offline' | 'busy' }
    | { status: 'error'; message: string };

/**
 * Aynı anda birden fazla senkron turu çalışmasın. İki tur çakışırsa biri
 * diğerinin yazdığı durumu eski verinin üzerine geri yazabilir.
 */
let inFlight = false;

function translateError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
        return 'Sunucuya ulaşılamadı.';
    }
    if (lower.includes('jwt') || lower.includes('token')) {
        return 'Oturumun süresi dolmuş. Tekrar giriş yapın.';
    }
    return 'Senkronizasyon başarısız oldu.';
}

/**
 * Bir senkron turu çalıştırır: uzaktaki durumu çeker, yerelle birleştirir,
 * farkları buluta yazar ve sonucu store'a uygular.
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
        const remote = await fetchRemoteTasks();

        // Ağ beklenirken kullanıcı değişiklik yapmış olabilir; durum tam da
        // birleştirme anında okunur.
        const { tasks: local, dirtyIds, tombstones } = useTaskStore.getState();

        const plan = mergeTasks({ local, remote, dirtyIds, tombstones });

        const pushedTasks = await pushRemoteTasks(plan.toPush, userId);
        await deleteRemoteTasks(plan.toDelete);

        // Sunucunun döndürdüğü sürümler (tetikleyici tarafından tazelenmiş
        // updated_at ile) yerel kopyaların yerine geçer.
        const pushedById = new Map(pushedTasks.map((task) => [task.id, task]));
        const tasks = plan.tasks.map((task) => pushedById.get(task.id) ?? task);

        useTaskStore.getState().applySyncResult({
            tasks,
            syncedIds: [...plan.toPush.map((t) => t.id), ...plan.discardedIds],
            clearedTombstoneIds: [...plan.toDelete, ...plan.obsoleteTombstoneIds],
            syncedAt: new Date().toISOString(),
        });

        return {
            status: 'ok',
            pushed: plan.toPush.length,
            pulled: remote.length,
            deleted: plan.toDelete.length,
        };
    } catch (error) {
        if (error instanceof SyncUnavailableError) {
            return { status: 'skipped', reason: 'unavailable' };
        }
        return { status: 'error', message: translateError(error) };
    } finally {
        inFlight = false;
    }
}

/** Testler arasında kilidi sıfırlamak için. */
export function resetSyncLock() {
    inFlight = false;
}
