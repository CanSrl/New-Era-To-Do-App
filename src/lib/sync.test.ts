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
import type { Category, Task } from './types';

/**
 * Çağrı sırası buraya kaydedilir. `vi.hoisted` şart: `vi.mock` fabrikaları
 * dosyanın en üstüne kaldırılır ve sıradan bir `const` o an henüz tanımlı
 * olmaz.
 */
const calls = vi.hoisted(() => [] as string[]);

vi.mock('./task-repository', () => {
    class SyncUnavailableError extends Error {
        constructor() {
            super('Bulut senkronizasyonu yapılandırılmamış.');
            this.name = 'SyncUnavailableError';
        }
    }

    return {
        SyncUnavailableError,
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
        position: 0,
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
        searchQuery: '',
        filter: 'all',
        dirtyIds: [],
        tombstones: [],
        dirtyCategoryIds: [],
        categoryTombstones: [],
        lastSyncedAt: null,
        ownerId: 'user-1',
        ...over,
    });
}

beforeEach(() => {
    calls.length = 0;
    vi.mocked(repo.fetchRemoteCategories).mockResolvedValue([]);
    vi.mocked(repo.fetchRemoteTasks).mockResolvedValue([]);
    vi.mocked(repo.pushRemoteCategories).mockImplementation(async (c) => {
        calls.push('pushCategories');
        return [...c];
    });
    vi.mocked(repo.pushRemoteTasks).mockImplementation(async (t) => {
        calls.push('pushTasks');
        return [...t];
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
        expect(calls.filter((c) => c.startsWith('push'))).toEqual([
            'pushCategories',
            'pushTasks',
        ]);
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
