/**
 * `runSync` orkestrasyon testleri.
 *
 * Birleştirme mantığı `sync-merge.test.ts` ve `sync-merge-categories.test.ts`
 * içinde saf fonksiyon olarak kapsanıyor. Burada test edilen şey başka:
 * **turun sırası ve kilidi**. Yani ağ çağrılarının hangi düzende yapıldığı,
 * hata durumunda ne döndüğü ve store'a ne uygulandığı.
 *
 * Neden ayrı bir dosya: sıra yabancı anahtar yüzünden serbest değil ve bu
 * kısıt yalnızca yorumda yazılıydı. Sıra bozulursa üretimde 23503 alınır ve
 * o turdaki bütün senkron düşer — birleştirme testleri bunu göremez, çünkü
 * saf fonksiyonlar ağ çağrısı yapmaz.
 *
 * Repository katmanı taklit ediliyor: burada Supabase'in doğru cevap verip
 * vermediği değil, `runSync`'in onu doğru düzende çağırıp çağırmadığı sınanıyor.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Client, Project, Task, TimeLog } from './types';

/**
 * Çağrı sırası buraya kaydedilir. `vi.hoisted` şart: `vi.mock` fabrikaları
 * dosyanın en üstüne kaldırılır ve sıradan bir `const` o an henüz tanımlı
 * olmaz.
 */
const calls = vi.hoisted(() => [] as string[]);

/**
 * Niş modül bayrağı testler arasında değiştirilebilsin diye taklit ediliyor.
 * Gerçekte derleme zamanı sabiti; burada mutasyona açık bir nesne.
 */
const flags = vi.hoisted(() => ({ nicheModule: true }));

vi.mock('../config/features', () => ({
    /**
     * `NICHE_MODULE` gerçekte derleme zamanı sabitidir (Vite `define` ile
     * enjekte edilir) — modülün paketten elenebilmesi buna bağlı. Testin onu
     * tur ortasında çevirebilmesi için burada **getter** olarak veriliyor:
     * `import { NICHE_MODULE }` her okumada bu fonksiyonu çalıştırır, böylece
     * `flags.nicheModule = false` ataması anında etkili olur.
     */
    get NICHE_MODULE() {
        return flags.nicheModule;
    },
    features: { githubAuth: false },
    isEnabled: () => false,
    isEnabledByDefault: () => true,
}));

vi.mock('./task-repository', () => {
    class SyncUnavailableError extends Error {
        constructor() {
            super('Bulut senkronizasyonu yapılandırılmamış.');
            this.name = 'SyncUnavailableError';
        }
    }

    // `runSync` bunu `instanceof` ile sınıyor, mesajla değil — taklit modül
    // sınıfı dışa vermezse hata çevirisi testleri "export tanımlı değil" ile
    // düşer.
    class SyncTooLargeError extends Error {
        readonly table: string;

        constructor(table: string) {
            super(`"${table}" tablosu tek turda çekme sınırını aştı.`);
            this.name = 'SyncTooLargeError';
            this.table = table;
        }
    }

    return {
        SyncUnavailableError,
        SyncTooLargeError,
        fetchRemoteCategories: vi.fn(async () => {
            calls.push('fetchCategories');
            return [] as Category[];
        }),
        fetchRemoteTasks: vi.fn(async () => {
            calls.push('fetchTasks');
            return [] as Task[];
        }),
        pushRemoteCategories: vi.fn(async (categories: readonly Category[]) => {
            calls.push('pushCategories');
            return [...categories];
        }),
        pushRemoteTasks: vi.fn(async (tasks: readonly Task[]) => {
            calls.push('pushTasks');
            return [...tasks];
        }),
        deleteRemoteCategories: vi.fn(async () => {
            calls.push('deleteCategories');
        }),
        deleteRemoteTasks: vi.fn(async () => {
            calls.push('deleteTasks');
        }),
        fetchRemoteClients: vi.fn(async () => {
            calls.push('fetchClients');
            return [] as Client[];
        }),
        fetchRemoteProjects: vi.fn(async () => {
            calls.push('fetchProjects');
            return [] as Project[];
        }),
        pushRemoteClients: vi.fn(async (clients: readonly Client[]) => {
            calls.push('pushClients');
            return [...clients];
        }),
        pushRemoteProjects: vi.fn(async (projects: readonly Project[]) => {
            calls.push('pushProjects');
            return [...projects];
        }),
        deleteRemoteClients: vi.fn(async () => {
            calls.push('deleteClients');
        }),
        deleteRemoteProjects: vi.fn(async () => {
            calls.push('deleteProjects');
        }),
        fetchRemoteTimeLogs: vi.fn(async () => {
            calls.push('fetchTimeLogs');
            return [] as TimeLog[];
        }),
        pushRemoteTimeLogs: vi.fn(async (logs: readonly TimeLog[]) => {
            calls.push('pushTimeLogs');
            return [...logs];
        }),
        deleteRemoteTimeLogs: vi.fn(async () => {
            calls.push('deleteTimeLogs');
        }),
    };
});

// Mock tanımlandıktan SONRA içe aktarılır; aksi halde gerçek modül yüklenirdi.
const repo = await import('./task-repository');
const { runSync, resetSyncLock } = await import('./sync');
const { useTaskStore } = await import('../store');

const ISO = '2026-08-14T10:00:00.000Z';

function makeCategory(over: Partial<Category> & { id: string }): Category {
    return {
        name: `Kategori ${over.id}`,
        color: '#3b82f6',
        position: 0,
        createdAt: ISO,
        updatedAt: ISO,
        ...over,
    };
}

function makeTask(over: Partial<Task> & { id: string }): Task {
    return {
        title: `Görev ${over.id}`,
        priority: 'medium',
        completed: false,
        categoryId: null,
        clientId: null,
        projectId: null,
        position: 0,
        createdAt: ISO,
        updatedAt: ISO,
        ...over,
    };
}

function makeClient(over: Partial<Client> & { id: string }): Client {
    return {
        name: `Müşteri ${over.id}`,
        archived: false,
        position: 0,
        hourlyRate: 0,
        currency: 'TRY',
        createdAt: ISO,
        updatedAt: ISO,
        ...over,
    };
}

function makeProject(over: Partial<Project> & { id: string; clientId: string }): Project {
    return {
        name: `Proje ${over.id}`,
        archived: false,
        position: 0,
        hourlyRate: null,
        currency: 'TRY',
        createdAt: ISO,
        updatedAt: ISO,
        ...over,
    };
}

/**
 * Son `pushRemoteTimeLogs` çağrısına giden kayıtlar.
 *
 * `mock.calls[0]` kullanılmaz: taklit fonksiyonların çağrı geçmişi testler
 * arasında sıfırlanmıyor (`restoreMocks` yalnızca uygulamayı geri alıyor),
 * dolayısıyla ilk çağrı önceki bir testin çağrısı olabilir.
 */
function lastPushedTimeLogs(): TimeLog[] {
    return [...(vi.mocked(repo.pushRemoteTimeLogs).mock.lastCall?.[0] ?? [])];
}

function makeTimeLog(over: Partial<TimeLog> & { id: string }): TimeLog {
    return {
        taskId: null,
        clientId: 'c1',
        projectId: null,
        startedAt: ISO,
        durationMinutes: 60,
        note: null,
        createdAt: ISO,
        updatedAt: ISO,
        ...over,
    };
}

/** Store'u bilinen bir başlangıca çeker. */
function seedStore(over: Partial<ReturnType<typeof useTaskStore.getState>> = {}) {
    useTaskStore.setState({
        tasks: [],
        categories: [],
        clients: [],
        projects: [],
        timeLogs: [],
        activeTimer: null,
        dirtyTimeLogIds: [],
        timeLogTombstones: [],
        searchQuery: '',
        filter: 'all',
        dirtyIds: [],
        tombstones: [],
        dirtyCategoryIds: [],
        categoryTombstones: [],
        dirtyClientIds: [],
        clientTombstones: [],
        dirtyProjectIds: [],
        projectTombstones: [],
        lastSyncedAt: null,
        ownerId: 'user-1',
        ...over,
    });
}

beforeEach(() => {
    calls.length = 0;
    flags.nicheModule = true;
    vi.mocked(repo.fetchRemoteCategories).mockResolvedValue([]);
    vi.mocked(repo.fetchRemoteTasks).mockResolvedValue([]);
    vi.mocked(repo.fetchRemoteClients).mockResolvedValue([]);
    vi.mocked(repo.fetchRemoteProjects).mockResolvedValue([]);
    vi.mocked(repo.pushRemoteCategories).mockImplementation(async (c) => {
        calls.push('pushCategories');
        return [...c];
    });
    vi.mocked(repo.pushRemoteTasks).mockImplementation(async (t) => {
        calls.push('pushTasks');
        return [...t];
    });
    vi.mocked(repo.pushRemoteClients).mockImplementation(async (c) => {
        calls.push('pushClients');
        return [...c];
    });
    vi.mocked(repo.pushRemoteProjects).mockImplementation(async (p) => {
        calls.push('pushProjects');
        return [...p];
    });
    vi.mocked(repo.fetchRemoteTimeLogs).mockResolvedValue([]);
    vi.mocked(repo.pushRemoteTimeLogs).mockImplementation(async (l) => {
        calls.push('pushTimeLogs');
        return [...l];
    });
    resetSyncLock();
    localStorage.clear();
    seedStore();
});

describe('runSync — yazma ve silme sırası', () => {
    it('kategorileri görevlerden ÖNCE yazar, kategorileri EN SONDA siler', async () => {
        // Dört iş de dolu olmalı ki sıra gerçekten gözlemlenebilsin.
        const localCategory = makeCategory({ id: 'cat-local' });
        const localTask = makeTask({ id: 'task-local', categoryId: 'cat-local' });

        vi.mocked(repo.fetchRemoteCategories).mockImplementation(async () => {
            calls.push('fetchCategories');
            return [makeCategory({ id: 'cat-remote', name: 'Silinecek kategori' })];
        });
        vi.mocked(repo.fetchRemoteTasks).mockImplementation(async () => {
            calls.push('fetchTasks');
            return [makeTask({ id: 'task-remote', title: 'Silinecek görev' })];
        });

        seedStore({
            categories: [localCategory],
            tasks: [localTask],
            dirtyCategoryIds: ['cat-local'],
            dirtyIds: ['task-local'],
            categoryTombstones: [{ id: 'cat-remote', deletedAt: ISO }],
            tombstones: [{ id: 'task-remote', deletedAt: ISO }],
        });

        const outcome = await runSync('user-1');
        expect(outcome.status).toBe('ok');

        // Yabancı anahtarın dayattığı düzen:
        //   kategori yazılır -> görev yazılır -> görev silinir -> kategori silinir
        expect(calls.indexOf('pushCategories')).toBeLessThan(calls.indexOf('pushTasks'));
        expect(calls.indexOf('pushTasks')).toBeLessThan(calls.indexOf('deleteCategories'));
        expect(calls.indexOf('deleteTasks')).toBeLessThan(calls.indexOf('deleteCategories'));
    });

    it('kategori yazımı görev yazımından önce tamamlanır (çekme paralel olsa da)', async () => {
        seedStore({
            categories: [makeCategory({ id: 'cat-1' })],
            tasks: [makeTask({ id: 'task-1', categoryId: 'cat-1' })],
            dirtyCategoryIds: ['cat-1'],
            dirtyIds: ['task-1'],
        });

        await runSync('user-1');

        // Çekmeler Promise.all ile paralel; yazmalar sıralı olmak zorunda.
        // (Araya niş modülün yazmaları da giriyor; buradaki iddia yalnızca
        // kategori-görev ilişkisi — tam sıra kendi testinde.)
        expect(calls.lastIndexOf('pushCategories')).toBeLessThan(calls.indexOf('pushTasks'));
    });
});

describe('runSync — eşzamanlılık kilidi', () => {
    it('tur sürerken gelen ikinci çağrıyı busy ile geri çevirir', async () => {
        // Başlangıç değeri boş fonksiyon: `| null` ile bildirilseydi TypeScript
        // değişkeni null'a daraltır ve closure içindeki atamayı göremediği için
        // aşağıdaki çağrı "never has no call signatures" hatası verirdi.
        let releaseFetch: () => void = () => {};
        vi.mocked(repo.fetchRemoteCategories).mockImplementation(
            () =>
                new Promise((resolve) => {
                    releaseFetch = () => resolve([]);
                })
        );

        const first = runSync('user-1');
        const second = await runSync('user-1');

        // İki tur çakışırsa biri diğerinin yazdığı durumu eski verinin üzerine
        // geri yazabilirdi.
        expect(second).toEqual({ status: 'skipped', reason: 'busy' });

        releaseFetch();
        await first;
    });

    it('hata sonrasında kilidi bırakır', async () => {
        vi.mocked(repo.fetchRemoteCategories).mockRejectedValueOnce(new Error('boom'));
        const failed = await runSync('user-1');
        expect(failed.status).toBe('error');

        // finally bloğu olmasaydı uygulama bir daha hiç senkron olamazdı.
        const next = await runSync('user-1');
        expect(next.status).toBe('ok');
    });
});

describe('runSync — atlama koşulları', () => {
    it('çevrimdışıyken hiç ağ çağrısı yapmaz', async () => {
        const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

        const outcome = await runSync('user-1');

        expect(outcome).toEqual({ status: 'skipped', reason: 'offline' });
        expect(calls).toEqual([]);
        spy.mockRestore();
    });

    it('Supabase yapılandırılmamışsa unavailable döner, hata değil', async () => {
        vi.mocked(repo.fetchRemoteCategories).mockRejectedValueOnce(
            new repo.SyncUnavailableError()
        );

        // Yapılandırma eksikliği bir arıza değil: uygulama local-first çalışır
        // ve kullanıcıya hata gösterilmemeli.
        expect(await runSync('user-1')).toEqual({ status: 'skipped', reason: 'unavailable' });
    });
});

describe('runSync — elenen değişikliklerin sayımı', () => {
    /**
     * Son yazan kazanır kuralı değişmiyor; değişen tek şey kaybedenin
     * sayılması. Sayı olmadan kullanıcı yazdığı şeyin kaybolduğunu hiç
     * öğrenemiyordu — arayüz bu değeri bildirime çeviriyor.
     */
    it('çakışmada elenen yerel görevi sayar', async () => {
        seedStore({
            tasks: [makeTask({ id: 'task-1', title: 'Yerel', updatedAt: ISO })],
            dirtyIds: ['task-1'],
        });
        vi.mocked(repo.fetchRemoteTasks).mockResolvedValue([
            makeTask({ id: 'task-1', title: 'Uzak kazanır', updatedAt: '2026-08-14T12:00:00.000Z' }),
        ]);

        const result = await runSync('user-1');

        expect(result).toMatchObject({ status: 'ok', discarded: 1 });
    });

    it('çakışma yoksa sıfır döner', async () => {
        seedStore({ tasks: [makeTask({ id: 'task-1' })], dirtyIds: ['task-1'] });

        const result = await runSync('user-1');

        expect(result).toMatchObject({ status: 'ok', discarded: 0 });
    });

    it('görev, kategori ve müşteri elemelerini birlikte toplar', async () => {
        const newer = '2026-08-14T12:00:00.000Z';
        seedStore({
            tasks: [makeTask({ id: 'task-1', updatedAt: ISO })],
            categories: [makeCategory({ id: 'cat-1', name: 'Yerel', updatedAt: ISO })],
            clients: [makeClient({ id: 'client-1', name: 'Yerel', updatedAt: ISO })],
            dirtyIds: ['task-1'],
            dirtyCategoryIds: ['cat-1'],
            dirtyClientIds: ['client-1'],
        });
        vi.mocked(repo.fetchRemoteTasks).mockResolvedValue([
            makeTask({ id: 'task-1', updatedAt: newer }),
        ]);
        vi.mocked(repo.fetchRemoteCategories).mockResolvedValue([
            makeCategory({ id: 'cat-1', name: 'Uzak', updatedAt: newer }),
        ]);
        vi.mocked(repo.fetchRemoteClients).mockResolvedValue([
            makeClient({ id: 'client-1', name: 'Uzak', updatedAt: newer }),
        ]);

        const result = await runSync('user-1');

        expect(result).toMatchObject({ status: 'ok', discarded: 3 });
    });
});

describe('runSync — hata çevirisi', () => {
    it.each([
        ['Failed to fetch', 'sync.error.network'],
        ['NetworkError when attempting to fetch', 'sync.error.network'],
        ['JWT expired', 'sync.error.expiredSession'],
        ['invalid token', 'sync.error.expiredSession'],
        ['something else entirely', 'sync.error.unknown'],
    ])('%s -> %s', async (message, expectedKey) => {
        vi.mocked(repo.fetchRemoteTasks).mockRejectedValueOnce(new Error(message));

        const outcome = await runSync('user-1');

        // Hazır metin değil çeviri anahtarı döner; aksi halde dil değişince
        // ekranda duran hata eski dilde kalırdı.
        expect(outcome).toEqual({ status: 'error', messageKey: expectedKey });
    });
});

describe('runSync — store\'a uygulanan sonuç', () => {
    it('sunucunun döndürdüğü sürüm yerel kopyanın yerine geçer', async () => {
        const local = makeTask({ id: 'task-1', title: 'Yerel başlık' });
        seedStore({ tasks: [local], dirtyIds: ['task-1'] });

        vi.mocked(repo.pushRemoteTasks).mockImplementation(async (tasks) => {
            calls.push('pushTasks');
            // Veritabanı tetikleyicisi updated_at'i kendi saatiyle tazeler.
            return tasks.map((t) => ({ ...t, updatedAt: '2026-08-14T11:00:00.000Z' }));
        });

        await runSync('user-1');

        const stored = useTaskStore.getState().tasks.find((t) => t.id === 'task-1');
        // Sunucu sürümü alınmazsa yereldeki damga geride kalır ve bir sonraki
        // turda görev boş yere yeniden indirilirdi.
        expect(stored?.updatedAt).toBe('2026-08-14T11:00:00.000Z');
    });

    it('gönderilen görevin dirty bayrağını temizler', async () => {
        seedStore({ tasks: [makeTask({ id: 'task-1' })], dirtyIds: ['task-1'] });

        await runSync('user-1');

        expect(useTaskStore.getState().dirtyIds).toEqual([]);
    });

    it('silinen görevin mezar taşını atar', async () => {
        vi.mocked(repo.fetchRemoteTasks).mockResolvedValue([makeTask({ id: 'task-remote' })]);
        seedStore({ tombstones: [{ id: 'task-remote', deletedAt: ISO }] });

        await runSync('user-1');

        expect(useTaskStore.getState().tombstones).toEqual([]);
    });

    it('tekilleştirilen kategoriye bağlı görevi bulut id\'sine taşır', async () => {
        // Aynı ad, ayrı id: iki cihaz kendi tohumunu oluşturmuş.
        vi.mocked(repo.fetchRemoteCategories).mockResolvedValue([
            makeCategory({ id: 'cat-bulut', name: 'İş' }),
        ]);
        seedStore({
            categories: [makeCategory({ id: 'cat-yerel', name: 'İş' })],
            tasks: [makeTask({ id: 'task-1', categoryId: 'cat-yerel' })],
            dirtyCategoryIds: ['cat-yerel'],
            dirtyIds: ['task-1'],
        });

        await runSync('user-1');

        const state = useTaskStore.getState();
        expect(state.categories.map((c) => c.id)).toEqual(['cat-bulut']);
        expect(state.tasks[0].categoryId).toBe('cat-bulut');
    });

    it('gönderilen görev, kategori bağı onarıldıktan SONRA gönderilir', async () => {
        // Onarılmamış hâlini göndermek, olmayan bir kategoriye işaret eden
        // satır demektir ve 23503 ile bütün görev senkronunu düşürürdü.
        vi.mocked(repo.fetchRemoteCategories).mockResolvedValue([
            makeCategory({ id: 'cat-bulut', name: 'İş' }),
        ]);
        seedStore({
            categories: [makeCategory({ id: 'cat-yerel', name: 'İş' })],
            tasks: [makeTask({ id: 'task-1', categoryId: 'cat-yerel' })],
            dirtyCategoryIds: ['cat-yerel'],
            dirtyIds: ['task-1'],
        });

        await runSync('user-1');

        const pushed = vi.mocked(repo.pushRemoteTasks).mock.calls.at(-1)?.[0];
        expect(pushed?.[0].categoryId).toBe('cat-bulut');
    });

    it('artık var olmayan kategoriye bağlı görevin bağını koparır', async () => {
        seedStore({
            categories: [],
            tasks: [makeTask({ id: 'task-1', categoryId: 'cat-yok' })],
            dirtyIds: ['task-1'],
        });

        await runSync('user-1');

        expect(useTaskStore.getState().tasks[0].categoryId).toBeNull();
    });

    it('lastSyncedAt damgasını ilerletir', async () => {
        seedStore();

        await runSync('user-1');

        expect(useTaskStore.getState().lastSyncedAt).not.toBeNull();
    });
});

describe('runSync — niş modül yazma ve silme sırası', () => {
    it('müşteri -> proje -> görev sırasıyla yazar', async () => {
        seedStore({
            clients: [makeClient({ id: 'c1' })],
            projects: [makeProject({ id: 'p1', clientId: 'c1' })],
            tasks: [makeTask({ id: 't1', clientId: 'c1', projectId: 'p1' })],
            dirtyClientIds: ['c1'],
            dirtyProjectIds: ['p1'],
            dirtyIds: ['t1'],
        });

        await runSync('user-1');

        // Yabancı anahtar zinciri: tasks -> projects -> clients. Hedef önce
        // var olmalı, yoksa 23503 alınır.
        expect(calls.filter((c) => c.startsWith('push'))).toEqual([
            'pushClients',
            'pushProjects',
            'pushCategories',
            'pushTasks',
            // Zaman kaydı üç tabloya birden bağlı: en sona kalır.
            'pushTimeLogs',
        ]);
    });

    it('görev -> proje -> müşteri sırasıyla siler', async () => {
        vi.mocked(repo.fetchRemoteClients).mockResolvedValue([makeClient({ id: 'c-uzak' })]);
        vi.mocked(repo.fetchRemoteProjects).mockResolvedValue([
            makeProject({ id: 'p-uzak', clientId: 'c-uzak' }),
        ]);
        vi.mocked(repo.fetchRemoteTasks).mockResolvedValue([makeTask({ id: 't-uzak' })]);

        seedStore({
            tombstones: [{ id: 't-uzak', deletedAt: ISO }],
            projectTombstones: [{ id: 'p-uzak', deletedAt: ISO }],
            clientTombstones: [{ id: 'c-uzak', deletedAt: ISO }],
        });

        await runSync('user-1');

        // Silme sırası yazmanın tersidir: referans veren önce gider.
        expect(calls.filter((c) => c.startsWith('delete'))).toEqual([
            // En çok referans veren taraf ilk gider.
            'deleteTimeLogs',
            'deleteTasks',
            'deleteProjects',
            'deleteClients',
            'deleteCategories',
        ]);
    });

    it('bütün yazmalar bütün silmelerden önce biter', async () => {
        vi.mocked(repo.fetchRemoteClients).mockResolvedValue([makeClient({ id: 'c-uzak' })]);
        seedStore({
            clients: [makeClient({ id: 'c1' })],
            dirtyClientIds: ['c1'],
            clientTombstones: [{ id: 'c-uzak', deletedAt: ISO }],
        });

        await runSync('user-1');

        const lastPush = Math.max(...calls.map((c, i) => (c.startsWith('push') ? i : -1)));
        const firstDelete = calls.findIndex((c) => c.startsWith('delete'));
        expect(lastPush).toBeLessThan(firstDelete);
    });
});

describe('runSync — zaman kayıtları', () => {
    it('görev yazıldıktan SONRA gönderir', async () => {
        // Aynı turda oluşturulmuş bir göreve bağlı kaydı önce göndermek 23503
        // ile reddedilir ve o turdaki bütün senkron onunla düşer.
        seedStore({
            clients: [makeClient({ id: 'c1' })],
            tasks: [makeTask({ id: 't1', clientId: 'c1' })],
            timeLogs: [makeTimeLog({ id: 'l1', clientId: 'c1', taskId: 't1' })],
            dirtyClientIds: ['c1'],
            dirtyIds: ['t1'],
            dirtyTimeLogIds: ['l1'],
        });

        await runSync('user-1');

        expect(calls.indexOf('pushTasks')).toBeLessThan(calls.indexOf('pushTimeLogs'));
        expect(lastPushedTimeLogs().map((l) => l.id)).toEqual(['l1']);
    });

    it('iki cihazın kayıtlarını toplar, birini diğerine ezdirmez', async () => {
        vi.mocked(repo.fetchRemoteTimeLogs).mockResolvedValue([
            makeTimeLog({ id: 'l-uzak', clientId: 'c1' }),
        ]);
        seedStore({
            clients: [makeClient({ id: 'c1' })],
            timeLogs: [makeTimeLog({ id: 'l-yerel', clientId: 'c1' })],
            dirtyClientIds: ['c1'],
            dirtyTimeLogIds: ['l-yerel'],
        });

        await runSync('user-1');

        expect(useTaskStore.getState().timeLogs.map((l) => l.id).sort())
            .toEqual(['l-uzak', 'l-yerel']);
        expect(useTaskStore.getState().dirtyTimeLogIds).toEqual([]);
    });

    it('tekilleştirilen müşteriye bağlı kaydı bulut id-sine taşır', async () => {
        vi.mocked(repo.fetchRemoteClients).mockResolvedValue([
            makeClient({ id: 'c-bulut', name: 'Acme' }),
        ]);
        seedStore({
            clients: [makeClient({ id: 'c-yerel', name: 'Acme' })],
            timeLogs: [makeTimeLog({ id: 'l1', clientId: 'c-yerel' })],
            dirtyClientIds: ['c-yerel'],
            dirtyTimeLogIds: ['l1'],
        });

        await runSync('user-1');

        // Yerel müşteri buluttakine katlandı; kayıt onunla birlikte taşınmazsa
        // artık var olmayan bir müşteriye işaret eder ve push 23503 ile düşer.
        const [pushed] = lastPushedTimeLogs();
        expect(pushed.clientId).toBe('c-bulut');
        expect(useTaskStore.getState().timeLogs[0].clientId).toBe('c-bulut');
    });

    it('müşterisi kalmayan kaydı düşürür ve dirty bayrağını temizler', async () => {
        // `client_id not null` + `on delete cascade`: sunucu bu kaydı zaten
        // sildi. Cihazda tutmak, her turda var olmayan bir müşteriye kayıt
        // göndermeye çalışmak demekti.
        seedStore({
            timeLogs: [makeTimeLog({ id: 'l1', clientId: 'c-silinmis' })],
            dirtyTimeLogIds: ['l1'],
        });

        await runSync('user-1');

        expect(useTaskStore.getState().timeLogs).toEqual([]);
        expect(useTaskStore.getState().dirtyTimeLogIds).toEqual([]);
        expect(lastPushedTimeLogs()).toEqual([]);
    });

    it('silinmiş göreve bağlı kaydın görev bağını koparır, kaydı silmez', async () => {
        vi.mocked(repo.fetchRemoteTimeLogs).mockResolvedValue([
            makeTimeLog({ id: 'l1', clientId: 'c1', taskId: 't-silinmis' }),
        ]);
        vi.mocked(repo.fetchRemoteClients).mockResolvedValue([makeClient({ id: 'c1' })]);

        await runSync('user-1');

        const [log] = useTaskStore.getState().timeLogs;
        expect(log.taskId).toBeNull();
        expect(log.clientId).toBe('c1');
    });

    it('silinen kaydın mezar taşını atar', async () => {
        vi.mocked(repo.fetchRemoteTimeLogs).mockResolvedValue([
            makeTimeLog({ id: 'l-uzak', clientId: 'c1' }),
        ]);
        vi.mocked(repo.fetchRemoteClients).mockResolvedValue([makeClient({ id: 'c1' })]);
        seedStore({ timeLogTombstones: [{ id: 'l-uzak', deletedAt: ISO }] });

        await runSync('user-1');

        expect(useTaskStore.getState().timeLogTombstones).toEqual([]);
    });
});

describe('runSync — niş modül bayrağı kapalı', () => {
    it('time_logs tablosuna HİÇ dokunmaz', async () => {
        // Modülü çıkarmış kurulumda tablo yoktur; tek bir "relation does not
        // exist" GÖREV senkronunu da beraberinde düşürürdü.
        flags.nicheModule = false;
        seedStore({
            timeLogs: [makeTimeLog({ id: 'l1' })],
            dirtyTimeLogIds: ['l1'],
        });

        const outcome = await runSync('user-1');

        expect(outcome.status).toBe('ok');
        expect(calls.filter((c) => c.includes('TimeLog'))).toEqual([]);
        // Yereldeki veri silinmez, yalnızca senkronlanmaz.
        expect(useTaskStore.getState().timeLogs.map((l) => l.id)).toEqual(['l1']);
        expect(useTaskStore.getState().dirtyTimeLogIds).toEqual(['l1']);
    });

    it('clients/projects tablolarına hiç dokunmaz', async () => {
        flags.nicheModule = false;
        seedStore({
            clients: [makeClient({ id: 'c1' })],
            projects: [makeProject({ id: 'p1', clientId: 'c1' })],
            dirtyClientIds: ['c1'],
            dirtyProjectIds: ['p1'],
        });

        const outcome = await runSync('user-1');

        // Modülü çıkarmış bir kurulumda bu tablolar YOKTUR; sorgulamak
        // "relation does not exist" ile görev senkronunu da düşürürdü.
        expect(outcome.status).toBe('ok');
        expect(calls.filter((c) => c.includes('Client') || c.includes('Project'))).toEqual([]);
    });

    it('yereldeki müşteri/proje verisini silmez', async () => {
        // Bayrak kapalıyken veri senkronlanmaz ama yok da edilmez: bayrak
        // yeniden açılırsa kullanıcı verisini yerinde bulmalı.
        flags.nicheModule = false;
        seedStore({
            clients: [makeClient({ id: 'c1' })],
            projects: [makeProject({ id: 'p1', clientId: 'c1' })],
            dirtyClientIds: ['c1'],
        });

        await runSync('user-1');

        const state = useTaskStore.getState();
        expect(state.clients.map((c) => c.id)).toEqual(['c1']);
        expect(state.projects.map((p) => p.id)).toEqual(['p1']);
        expect(state.dirtyClientIds).toEqual(['c1']);
    });
});

describe('runSync — niş modül bağ onarımı', () => {
    it('tekilleştirilen müşteriye bağlı projeyi ve görevi bulut id\'sine taşır', async () => {
        vi.mocked(repo.fetchRemoteClients).mockResolvedValue([
            makeClient({ id: 'c-bulut', name: 'Acme' }),
        ]);
        seedStore({
            clients: [makeClient({ id: 'c-yerel', name: 'Acme' })],
            projects: [makeProject({ id: 'p1', clientId: 'c-yerel' })],
            tasks: [makeTask({ id: 't1', clientId: 'c-yerel' })],
            dirtyClientIds: ['c-yerel'],
            dirtyProjectIds: ['p1'],
            dirtyIds: ['t1'],
        });

        await runSync('user-1');

        const state = useTaskStore.getState();
        expect(state.clients.map((c) => c.id)).toEqual(['c-bulut']);
        expect(state.projects[0].clientId).toBe('c-bulut');
        expect(state.tasks[0].clientId).toBe('c-bulut');
    });

    it('proje, müşteri bağı onarıldıktan SONRA gönderilir', async () => {
        // Onarılmamış hâlini göndermek olmayan bir müşteriye işaret eden satır
        // demektir ve 23503 ile bütün turu düşürürdü.
        vi.mocked(repo.fetchRemoteClients).mockResolvedValue([
            makeClient({ id: 'c-bulut', name: 'Acme' }),
        ]);
        seedStore({
            clients: [makeClient({ id: 'c-yerel', name: 'Acme' })],
            projects: [makeProject({ id: 'p1', clientId: 'c-yerel' })],
            dirtyClientIds: ['c-yerel'],
            dirtyProjectIds: ['p1'],
        });

        await runSync('user-1');

        const pushed = vi.mocked(repo.pushRemoteProjects).mock.calls.at(-1)?.[0];
        expect(pushed?.[0].clientId).toBe('c-bulut');
    });

    it('görev, müşteri ve proje bağları onarıldıktan SONRA gönderilir', async () => {
        vi.mocked(repo.fetchRemoteClients).mockResolvedValue([
            makeClient({ id: 'c-bulut', name: 'Acme' }),
        ]);
        vi.mocked(repo.fetchRemoteProjects).mockResolvedValue([
            makeProject({ id: 'p-bulut', clientId: 'c-bulut', name: 'Websitesi' }),
        ]);
        seedStore({
            clients: [makeClient({ id: 'c-yerel', name: 'Acme' })],
            projects: [makeProject({ id: 'p-yerel', clientId: 'c-yerel', name: 'Websitesi' })],
            tasks: [makeTask({ id: 't1', clientId: 'c-yerel', projectId: 'p-yerel' })],
            dirtyClientIds: ['c-yerel'],
            dirtyProjectIds: ['p-yerel'],
            dirtyIds: ['t1'],
        });

        await runSync('user-1');

        const pushed = vi.mocked(repo.pushRemoteTasks).mock.calls.at(-1)?.[0];
        expect(pushed?.[0].clientId).toBe('c-bulut');
        expect(pushed?.[0].projectId).toBe('p-bulut');
    });

    it('müşterisi kalmayan projeyi düşürür ve dirty bayrağını temizler', async () => {
        // Veritabanındaki cascade'in karşılığı. Bayrak temizlenmezse kayıt
        // her turda var olmayan bir müşteriye gönderilmeye çalışılırdı.
        seedStore({
            clients: [],
            projects: [makeProject({ id: 'p1', clientId: 'c-silinmis' })],
            dirtyProjectIds: ['p1'],
        });

        await runSync('user-1');

        const state = useTaskStore.getState();
        expect(state.projects).toEqual([]);
        expect(state.dirtyProjectIds).toEqual([]);
    });

    it('silinen müşterinin görevlerindeki iki bağı da koparır', async () => {
        seedStore({
            clients: [],
            projects: [],
            tasks: [makeTask({ id: 't1', clientId: 'c-silinmis', projectId: 'p-silinmis' })],
            dirtyIds: ['t1'],
        });

        await runSync('user-1');

        const [task] = useTaskStore.getState().tasks;
        expect(task.clientId).toBeNull();
        expect(task.projectId).toBeNull();
    });

    it('gönderilen müşterinin dirty bayrağını temizler', async () => {
        seedStore({ clients: [makeClient({ id: 'c1' })], dirtyClientIds: ['c1'] });

        await runSync('user-1');

        expect(useTaskStore.getState().dirtyClientIds).toEqual([]);
    });

    it('silinen projenin mezar taşını atar', async () => {
        vi.mocked(repo.fetchRemoteClients).mockResolvedValue([makeClient({ id: 'c1' })]);
        vi.mocked(repo.fetchRemoteProjects).mockResolvedValue([
            makeProject({ id: 'p-uzak', clientId: 'c1' }),
        ]);
        seedStore({ projectTombstones: [{ id: 'p-uzak', deletedAt: ISO }] });

        await runSync('user-1');

        expect(useTaskStore.getState().projectTombstones).toEqual([]);
    });
});
