import type { Task } from './types';
import type { Tombstone } from '../store';

export interface MergeInput {
    /** Cihazdaki görevler. */
    local: readonly Task[];
    /** Buluttan çekilen tam anlık görüntü. */
    remote: readonly Task[];
    /** Buluta itilmeyi bekleyen yerel görev id'leri. */
    dirtyIds: readonly string[];
    /** Buluttan silinmeyi bekleyen yerel silmeler. */
    tombstones: readonly Tombstone[];
}

export interface MergePlan {
    /** Birleştirme sonrası cihazda olması gereken görevler. */
    tasks: Task[];
    /** Buluta yazılacak görevler. Dirty bayrağı ancak yazma başarılıysa silinir. */
    toPush: Task[];
    /** Buluttan silinecek görev id'leri. Mezar taşı ancak silme başarılıysa atılır. */
    toDelete: string[];
    /**
     * Çakışmayı kaybettiği için yerel sürümü atılan görevler. Bunların dirty
     * bayrağı hemen temizlenir; aksi halde her turda yeniden denenip her
     * seferinde kaybederek sonsuza dek dirty kalırlardı.
     */
    discardedIds: string[];
    /**
     * Bulutta karşılığı olmayan mezar taşları. Silinecek bir şey yok; doğrudan
     * atılabilirler.
     */
    obsoleteTombstoneIds: string[];
}

/**
 * Yerel ve uzak durumu birleştirir ve ne yapılacağının planını üretir.
 *
 * Kurallar:
 * - Yalnızca yerelde olan, dirty görev: buluta gönderilir.
 * - Yalnızca yerelde olan, dirty OLMAYAN görev: bir önceki turda senkronlanmıştı
 *   ve artık bulutta yok demektir; başka cihazda silinmiş, cihazdan kaldırılır.
 * - Yalnızca uzakta olan görev: cihaza indirilir. Mezar taşı varsa indirilmez,
 *   bulutta silinir.
 * - İki tarafta da olan görev: updatedAt'i yeni olan kazanır. Eşitlikte uzak
 *   taraf kazanır; böylece bütün cihazlar aynı sonuca varır.
 *
 * Fonksiyon saftır — ağ çağrısı yapmaz. Senkronun en riskli kısmı bu sayede
 * ağ olmadan test edilebilir.
 */
export function mergeTasks({ local, remote, dirtyIds, tombstones }: MergeInput): MergePlan {
    const dirty = new Set(dirtyIds);
    const deleted = new Set(tombstones.map((t) => t.id));
    const remoteById = new Map(remote.map((t) => [t.id, t]));
    const localIds = new Set(local.map((t) => t.id));

    const tasks: Task[] = [];
    const toPush: Task[] = [];
    const toDelete: string[] = [];
    const discardedIds: string[] = [];

    for (const localTask of local) {
        // Silinmiş görev listede kalmamalı; mezar taşı silme emrini taşır.
        if (deleted.has(localTask.id)) continue;

        const remoteTask = remoteById.get(localTask.id);

        if (!remoteTask) {
            if (dirty.has(localTask.id)) {
                tasks.push(localTask);
                toPush.push(localTask);
            }
            // Aksi halde başka cihazda silinmiş: cihazdan da düşer.
            continue;
        }

        if (dirty.has(localTask.id)) {
            if (localTask.updatedAt > remoteTask.updatedAt) {
                tasks.push(localTask);
                toPush.push(localTask);
            } else {
                tasks.push(remoteTask);
                discardedIds.push(localTask.id);
            }
        } else {
            tasks.push(remoteTask);
        }
    }

    for (const remoteTask of remote) {
        if (localIds.has(remoteTask.id)) continue;

        if (deleted.has(remoteTask.id)) {
            toDelete.push(remoteTask.id);
            continue;
        }

        tasks.push(remoteTask);
    }

    const obsoleteTombstoneIds = tombstones
        .filter((t) => !remoteById.has(t.id))
        .map((t) => t.id);

    return { tasks, toPush, toDelete, discardedIds, obsoleteTombstoneIds };
}
