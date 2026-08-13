import type { Category, Task } from './types';
import type { Tombstone } from '../store';
import { categoryKey } from './categories';

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

export interface CategoryMergeInput {
    local: readonly Category[];
    remote: readonly Category[];
    dirtyIds: readonly string[];
    tombstones: readonly Tombstone[];
}

export interface CategoryMergePlan {
    categories: Category[];
    toPush: Category[];
    toDelete: string[];
    discardedIds: string[];
    obsoleteTombstoneIds: string[];
    /**
     * Ada göre tekilleştirilen kategorilerin yerel id'sinden bulut id'sine
     * eşleme. Bu kategorilere bağlı görevlerin `categoryId` alanı gönderilmeden
     * önce yeniden yazılmalıdır.
     */
    idRemap: Record<string, string>;
}

/**
 * Kategorileri birleştirir. Kurallar `mergeTasks` ile aynıdır, üstüne bir
 * tanesi eklenir: **ada göre tekilleştirme**.
 *
 * Neden gerekli: her cihaz ilk açılışta kendi başlangıç kategorilerini
 * kendi id'leriyle oluşturur. Misafirken görev eklemiş bir kullanıcı, başka
 * cihazdan zaten kurulmuş bir hesaba giriş yaptığında yerel "İş" ile buluttaki
 * "İş" farklı id'ler taşır ve ikisi de korunursa listede aynı kategori iki
 * kez görünür. Bu yüzden buluta karşılığı olmayan yerel bir kategori, aynı
 * adı taşıyan bir bulut kategorisi varsa ona katlanır ve id'si `idRemap`
 * üzerinden görevlere yansıtılır.
 *
 * Tekilleştirme yalnızca id'si bulutta BULUNMAYAN yerel kategorilere
 * uygulanır. Bulutta karşılığı olan bir kategori yeniden adlandırılıp başka
 * bir kategoriyle aynı ada gelirse birleştirilmez — bu bir çakışma değil,
 * kullanıcının bilinçli düzenlemesidir.
 *
 * Fonksiyon saftır; ağ çağrısı yapmaz.
 */
export function mergeCategories({
    local,
    remote,
    dirtyIds,
    tombstones,
}: CategoryMergeInput): CategoryMergePlan {
    const dirty = new Set(dirtyIds);
    const deleted = new Set(tombstones.map((t) => t.id));
    const remoteById = new Map(remote.map((c) => [c.id, c]));
    const localIds = new Set(local.map((c) => c.id));

    // Bulutta aynı ad birden fazla kez varsa (kısıt yok, mümkün) ilk görülen
    // kazanır; böylece bütün cihazlar aynı hedefte buluşur.
    const remoteByName = new Map<string, Category>();
    for (const remoteCategory of remote) {
        const key = categoryKey(remoteCategory.name);
        if (!remoteByName.has(key)) remoteByName.set(key, remoteCategory);
    }

    const categories: Category[] = [];
    const toPush: Category[] = [];
    const toDelete: string[] = [];
    const discardedIds: string[] = [];
    const idRemap: Record<string, string> = {};

    for (const localCategory of local) {
        if (deleted.has(localCategory.id)) continue;

        const remoteCategory = remoteById.get(localCategory.id);

        if (!remoteCategory) {
            const twin = remoteByName.get(categoryKey(localCategory.name));
            if (twin) {
                // Aynı kategori, ayrı id. Bulut sürümü kazanır; yerel kayıt
                // düşer ve kendisine bağlı görevler bulut id'sine taşınır.
                idRemap[localCategory.id] = twin.id;
                // Dirty bayrağı temizlenmezse her turda yeniden gönderilmeye
                // çalışılır ve her seferinde aynı şekilde katlanırdı.
                discardedIds.push(localCategory.id);
                continue;
            }

            if (dirty.has(localCategory.id)) {
                categories.push(localCategory);
                toPush.push(localCategory);
            }
            // Aksi halde başka cihazda silinmiş: cihazdan da düşer.
            continue;
        }

        if (dirty.has(localCategory.id)) {
            if (localCategory.updatedAt > remoteCategory.updatedAt) {
                categories.push(localCategory);
                toPush.push(localCategory);
            } else {
                categories.push(remoteCategory);
                discardedIds.push(localCategory.id);
            }
        } else {
            categories.push(remoteCategory);
        }
    }

    for (const remoteCategory of remote) {
        if (localIds.has(remoteCategory.id)) continue;

        if (deleted.has(remoteCategory.id)) {
            toDelete.push(remoteCategory.id);
            continue;
        }

        categories.push(remoteCategory);
    }

    const obsoleteTombstoneIds = tombstones
        .filter((t) => !remoteById.has(t.id))
        .map((t) => t.id);

    return { categories, toPush, toDelete, discardedIds, obsoleteTombstoneIds, idRemap };
}

/**
 * Görevlerin kategori bağlarını birleştirme sonrasına uyarlar.
 *
 * İki iş yapar:
 * 1. Tekilleştirilen kategorilere bağlı görevleri bulut id'sine taşır.
 * 2. Artık var olmayan bir kategoriye bağlı görevi "Kategorisiz" yapar.
 *
 * İkincisi yabancı anahtar güvenliği içindir: olmayan bir kategoriye bağlı
 * görevi göndermek 23503 ile reddedilir ve o turdaki bütün görev
 * senkronizasyonunu düşürürdü.
 *
 * `updatedAt` bilinçli olarak tazelenmez — bu bir kullanıcı düzenlemesi değil,
 * bağ onarımıdır. Damgayı ilerletmek, aynı görevi başka bir cihazda gerçekten
 * düzenleyen kullanıcının değişikliğini haksız yere yenerdi.
 */
export function remapTaskCategories(
    tasks: readonly Task[],
    idRemap: Record<string, string>,
    validCategoryIds: ReadonlySet<string>
): Task[] {
    return tasks.map((task) => {
        if (task.categoryId === null) return task;

        const mapped = idRemap[task.categoryId] ?? task.categoryId;
        const next = validCategoryIds.has(mapped) ? mapped : null;

        return next === task.categoryId ? task : { ...task, categoryId: next };
    });
}
