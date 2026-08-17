import type { TranslationKey } from '../i18n';
import type { Task, TimeLog } from './types';
import { useTaskStore } from '../store';
import { NICHE_MODULE } from '../config/features';
import { mergeCategories, mergeTasks, remapTaskCategories } from './sync-merge';
import {
    mergeClients,
    mergeProjects,
    mergeTimeLogs,
    remapProjectClients,
    remapTaskLinks,
    remapTimeLogLinks,
} from './sync-merge-niche';
import {
    deleteRemoteCategories,
    deleteRemoteClients,
    deleteRemoteProjects,
    deleteRemoteTasks,
    deleteRemoteTimeLogs,
    fetchRemoteCategories,
    fetchRemoteClients,
    fetchRemoteProjects,
    fetchRemoteTasks,
    fetchRemoteTimeLogs,
    pushRemoteCategories,
    pushRemoteClients,
    pushRemoteProjects,
    pushRemoteTasks,
    pushRemoteTimeLogs,
    SyncTooLargeError,
    SyncUnavailableError,
} from './task-repository';

export type SyncOutcome =
    /**
     * `discarded`: çakışmada kaybeden **yerel** değişikliklerin sayısı. Son
     * yazan kazanır kuralı gereği bunlar sessizce atılıyordu; kullanıcı ne
     * yazdığının kaybolduğunu hiç öğrenmiyordu. Arayüz bu sayıyı gösterir.
     */
    | { status: 'ok'; pushed: number; pulled: number; deleted: number; discarded: number }
    | { status: 'skipped'; reason: 'unavailable' | 'offline' | 'busy' }
    | { status: 'error'; messageKey: TranslationKey };

/**
 * Aynı anda birden fazla senkron turu çalışmasın. İki tur çakışırsa biri
 * diğerinin yazdığı durumu eski verinin üzerine geri yazabilir.
 */
let inFlight = false;

/** Ham hatayı çeviri anahtarına indirger; metin arayüz katmanında üretilir. */
function errorKeyFor(error: unknown): TranslationKey {
    // Veri tek turda çekilemeyecek kadar büyük. Metin arama yapılmadan önce
    // sınanır: mesajın kendisi değil, tipin varlığı belirleyici.
    if (error instanceof SyncTooLargeError) return 'sync.error.tooLarge';

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
 * **Sıra yabancı anahtar yüzünden serbest değildir.** Bağımlılık zinciri:
 * `time_logs` → `tasks` → `projects` → `clients`, ayrıca `tasks` → `categories`.
 * Zaman kaydı üç tabloya birden bağlıdır (görev, müşteri, proje).
 *
 *   1. Yazma, bağımsızdan bağımlıya: müşteri → proje → kategori → görev →
 *      zaman kaydı. Henüz var olmayan bir kayda işaret eden satır 23503 ile
 *      reddedilir.
 *   2. Silme, tam tersi: zaman kaydı → görev → proje → müşteri → kategori.
 *      Referans veren satır önce gitmeli.
 *   3. Bütün yazmalar bütün silmelerden önce biter: aynı turda hem yeni bir
 *      projeye bağlanan hem eski projesi silinen bir görev olabilir.
 *
 * Bağ onarımı da bu sıraya tabi: her katman gönderilmeden ÖNCE bir üstteki
 * katmanın tekilleştirme sonucu (`idRemap`) ona uygulanır.
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
        // Bayrak kapalıyken bu tablolar sorgulanmaz: modülü çıkarmış bir
        // kurulumda mevcut değiller ve tek bir "relation does not exist"
        // hatası GÖREV senkronunu da beraberinde düşürürdü.
        const niche = NICHE_MODULE;

        const [
            remoteCategories,
            remoteClients,
            remoteProjects,
            remoteTasks,
            remoteTimeLogs,
        ] = await Promise.all([
            fetchRemoteCategories(),
            niche ? fetchRemoteClients() : [],
            niche ? fetchRemoteProjects() : [],
            fetchRemoteTasks(),
            niche ? fetchRemoteTimeLogs() : [],
        ]);

        // Ağ beklenirken kullanıcı değişiklik yapmış olabilir; durum tam da
        // birleştirme anında okunur.
        const state = useTaskStore.getState();

        // --- Müşteriler: zincirin kökü, önce yazılır. -----------------------
        const clientPlan = niche
            ? mergeClients({
                local: state.clients,
                remote: remoteClients,
                dirtyIds: state.dirtyClientIds,
                tombstones: state.clientTombstones,
            })
            : null;

        const pushedClients = clientPlan
            ? await pushRemoteClients(clientPlan.toPush, userId)
            : [];
        const pushedClientById = new Map(pushedClients.map((c) => [c.id, c]));
        const clients = clientPlan
            ? clientPlan.clients.map((c) => pushedClientById.get(c.id) ?? c)
            : [];
        const validClientIds = new Set(clients.map((c) => c.id));

        // --- Projeler: müşteri bağları onarıldıktan SONRA birleştirilir. ----
        // Tekilleştirme anahtarı (müşteri + ad) doğru müşteriyi görmek zorunda,
        // yoksa aynı projenin iki kopyası ayrı müşterilere asılı kalırdı.
        const localProjects = clientPlan
            ? remapProjectClients(state.projects, clientPlan.idRemap, validClientIds)
            : { projects: [], droppedIds: [] };

        const projectPlan = niche
            ? mergeProjects({
                local: localProjects.projects,
                remote: remoteProjects,
                dirtyIds: state.dirtyProjectIds,
                tombstones: state.projectTombstones,
            })
            : null;

        const pushedProjects = projectPlan
            ? await pushRemoteProjects(projectPlan.toPush, userId)
            : [];
        const pushedProjectById = new Map(pushedProjects.map((p) => [p.id, p]));
        const projects = projectPlan
            ? projectPlan.projects.map((p) => pushedProjectById.get(p.id) ?? p)
            : [];
        const projectsById = new Map(projects.map((p) => [p.id, p]));

        // --- Kategoriler ----------------------------------------------------
        const categoryPlan = mergeCategories({
            local: state.categories,
            remote: remoteCategories,
            dirtyIds: state.dirtyCategoryIds,
            tombstones: state.categoryTombstones,
        });

        const pushedCategories = await pushRemoteCategories(categoryPlan.toPush, userId);
        const pushedCategoryById = new Map(pushedCategories.map((c) => [c.id, c]));
        const categories = categoryPlan.categories.map((c) => pushedCategoryById.get(c.id) ?? c);
        const validCategoryIds = new Set(categories.map((c) => c.id));

        // --- Görevler: bütün bağlar kesinleştikten sonra. --------------------
        const linkContext = {
            clientIdRemap: clientPlan?.idRemap ?? {},
            projectIdRemap: projectPlan?.idRemap ?? {},
            validClientIds,
            projectsById,
        };

        // Bayrak kapalıyken görevlerin müşteri/proje alanlarına dokunulmaz:
        // veri yerinde kalır, yalnızca senkronlanmaz.
        const repairLinks = (list: readonly Task[]) => {
            const withCategories = remapTaskCategories(
                list,
                categoryPlan.idRemap,
                validCategoryIds
            );
            return niche ? remapTaskLinks(withCategories, linkContext) : [...withCategories];
        };

        const plan = mergeTasks({
            local: repairLinks(state.tasks),
            remote: remoteTasks,
            dirtyIds: state.dirtyIds,
            tombstones: state.tombstones,
        });

        const pushedTasks = await pushRemoteTasks(plan.toPush, userId);

        // --- Zaman kayıtları: üç tabloya birden bağlı, en sona kalır. --------
        // Görev bağı ancak görevler kesinleştikten sonra doğrulanabilir; aynı
        // turda oluşturulmuş bir göreve bağlı kaydı önce göndermek 23503 olurdu.
        const validTaskIds = new Set(plan.tasks.map((t) => t.id));
        const repairTimeLogs = (list: readonly TimeLog[]) =>
            niche
                ? remapTimeLogLinks(list, { ...linkContext, validTaskIds })
                : { timeLogs: [...list], droppedIds: [] as string[] };

        const localTimeLogs = niche
            ? repairTimeLogs(state.timeLogs)
            : { timeLogs: [], droppedIds: [] as string[] };

        const timeLogPlan = niche
            ? mergeTimeLogs({
                local: localTimeLogs.timeLogs,
                remote: remoteTimeLogs,
                dirtyIds: state.dirtyTimeLogIds,
                tombstones: state.timeLogTombstones,
            })
            : null;

        const pushedTimeLogs = timeLogPlan
            ? await pushRemoteTimeLogs(timeLogPlan.toPush, userId)
            : [];

        // --- Silmeler: referans verenden referans verilene. ------------------
        // Zaman kaydı en çok referans veren taraf, ilk o gider.
        if (timeLogPlan) await deleteRemoteTimeLogs(timeLogPlan.toDelete);
        await deleteRemoteTasks(plan.toDelete);
        if (projectPlan) await deleteRemoteProjects(projectPlan.toDelete);
        if (clientPlan) await deleteRemoteClients(clientPlan.toDelete);
        await deleteRemoteCategories(categoryPlan.toDelete);

        // Sunucunun döndürdüğü sürümler (tetikleyici tarafından tazelenmiş
        // updated_at ile) yerel kopyaların yerine geçer.
        const pushedById = new Map(pushedTasks.map((task) => [task.id, task]));
        const tasks = repairLinks(plan.tasks.map((task) => pushedById.get(task.id) ?? task));

        // Buluttan inen kayıtların bağları da onarılır: uzaktan gelen bir kayıt
        // bu turda silinen bir müşteriye/projeye işaret ediyor olabilir. Sunucu
        // aynı sonucu cascade ile zaten üretti, cihaz da onu izlemeli.
        const pushedLogById = new Map(pushedTimeLogs.map((log) => [log.id, log]));
        const mergedTimeLogs = repairTimeLogs(
            (timeLogPlan?.timeLogs ?? []).map((log) => pushedLogById.get(log.id) ?? log)
        );
        const droppedTimeLogIds = [
            ...localTimeLogs.droppedIds,
            ...mergedTimeLogs.droppedIds,
        ];

        useTaskStore.getState().applySyncResult({
            tasks,
            categories,
            // Bayrak kapalıyken bu alanlar atlanır ve store'daki mevcut değer
            // korunur; bayrak yeniden açılırsa kullanıcı verisini yerinde bulur.
            ...(niche ? { clients, projects, timeLogs: mergedTimeLogs.timeLogs } : {}),
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
            syncedClientIds: clientPlan
                ? [...clientPlan.toPush.map((c) => c.id), ...clientPlan.discardedIds]
                : [],
            clearedClientTombstoneIds: clientPlan
                ? [...clientPlan.toDelete, ...clientPlan.obsoleteTombstoneIds]
                : [],
            // Müşterisi kalmadığı için düşen projeler de temiz sayılır; aksi
            // halde her turda var olmayan bir kayıt gönderilmeye çalışılırdı.
            syncedProjectIds: projectPlan
                ? [
                    ...projectPlan.toPush.map((p) => p.id),
                    ...projectPlan.discardedIds,
                    ...localProjects.droppedIds,
                ]
                : [],
            clearedProjectTombstoneIds: projectPlan
                ? [...projectPlan.toDelete, ...projectPlan.obsoleteTombstoneIds]
                : [],
            // Müşterisi kalmadığı için düşen kayıtlar da temiz sayılır; aksi
            // halde her turda var olmayan bir kayıt gönderilmeye çalışılırdı.
            syncedTimeLogIds: timeLogPlan
                ? [
                    ...timeLogPlan.toPush.map((l) => l.id),
                    ...timeLogPlan.discardedIds,
                    ...droppedTimeLogIds,
                ]
                : [],
            clearedTimeLogTombstoneIds: timeLogPlan
                ? [...timeLogPlan.toDelete, ...timeLogPlan.obsoleteTombstoneIds]
                : [],
            syncedAt: new Date().toISOString(),
        });

        return {
            status: 'ok',
            // Projelerin `droppedIds`'i bilinçli olarak SAYILMAZ: onlar
            // çakışmada elenmedi, müşterisi silindiği için düştüler —
            // kullanıcıya "değişikliğin kayboldu" demek yanıltıcı olurdu.
            discarded:
                plan.discardedIds.length
                + categoryPlan.discardedIds.length
                + (clientPlan?.discardedIds.length ?? 0)
                + (projectPlan?.discardedIds.length ?? 0)
                + (timeLogPlan?.discardedIds.length ?? 0),
            pushed:
                plan.toPush.length
                + categoryPlan.toPush.length
                + (clientPlan?.toPush.length ?? 0)
                + (projectPlan?.toPush.length ?? 0)
                + (timeLogPlan?.toPush.length ?? 0),
            pulled: remoteTasks.length,
            deleted:
                plan.toDelete.length
                + categoryPlan.toDelete.length
                + (clientPlan?.toDelete.length ?? 0)
                + (projectPlan?.toDelete.length ?? 0)
                + (timeLogPlan?.toDelete.length ?? 0),
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
