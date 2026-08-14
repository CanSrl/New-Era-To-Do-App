import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from './index';
import type { Task } from '../lib/types';
import { seedCategories } from '../lib/categories';

const STORAGE_KEY = 'yapilacaklar-storage';

/** Testler arasında store'u ve kalıcı depoyu temizler. */
function resetStore() {
    localStorage.clear();
    useTaskStore.setState({
        tasks: [],
        categories: seedCategories(),
        searchQuery: '',
        filter: 'all',
        dirtyIds: [],
        tombstones: [],
        dirtyCategoryIds: [],
        categoryTombstones: [],
        lastSyncedAt: null,
        ownerId: null,
    });
}

const store = () => useTaskStore.getState();

function addTask(title: string, overrides: Partial<Task> = {}) {
    store().addTask({
        title,
        priority: 'medium',
        categoryId: null,
        clientId: null,
        projectId: null,
        completed: false,
        ...overrides,
    });
}

beforeEach(resetStore);

describe('addTask', () => {
    it('görevi id, createdAt ve position ile ekler', () => {
        addTask('İlk görev');

        const [task] = store().tasks;
        expect(task.title).toBe('İlk görev');
        expect(task.id).toBeTruthy();
        expect(task.position).toBe(0);
        expect(Number.isNaN(new Date(task.createdAt).getTime())).toBe(false);
    });

    it('her yeni göreve artan position verir', () => {
        addTask('Bir');
        addTask('İki');
        addTask('Üç');

        expect(store().tasks.map(t => t.position)).toEqual([0, 1, 2]);
    });

    it('araya silme olsa bile position çakışmaz', () => {
        addTask('Bir');
        addTask('İki');
        store().deleteTask(store().tasks[1].id);
        addTask('Üç');

        const positions = store().tasks.map(t => t.position);
        expect(new Set(positions).size).toBe(positions.length);
    });
});

describe('updateTask', () => {
    it('yalnızca hedef görevi değiştirir', () => {
        addTask('Bir');
        addTask('İki');
        const [first, second] = store().tasks;

        store().updateTask(first.id, { title: 'Bir (güncel)' });

        expect(store().tasks.find(t => t.id === first.id)?.title).toBe('Bir (güncel)');
        expect(store().tasks.find(t => t.id === second.id)?.title).toBe('İki');
    });

    it('bilinmeyen id için hiçbir şey değiştirmez', () => {
        addTask('Bir');
        const before = store().tasks;

        store().updateTask('yok-boyle-id', { title: 'X' });

        expect(store().tasks).toEqual(before);
    });
});

describe('deleteTask', () => {
    it('yalnızca hedef görevi siler', () => {
        addTask('Bir');
        addTask('İki');
        const target = store().tasks[0];

        store().deleteTask(target.id);

        expect(store().tasks.map(t => t.title)).toEqual(['İki']);
    });
});

describe('toggleComplete', () => {
    it('tamamlanma durumunu tersine çevirir', () => {
        addTask('Bir');
        const id = store().tasks[0].id;

        store().toggleComplete(id);
        expect(store().tasks[0].completed).toBe(true);

        store().toggleComplete(id);
        expect(store().tasks[0].completed).toBe(false);
    });
});

describe('reorderTasks', () => {
    it('position değerlerini yeniden numaralandırır', () => {
        addTask('Bir');
        addTask('İki');
        addTask('Üç');

        const [a, b, c] = store().tasks;
        store().reorderTasks([c, a, b]);

        expect(store().tasks.map(t => [t.title, t.position])).toEqual([
            ['Üç', 0],
            ['Bir', 1],
            ['İki', 2],
        ]);
    });

    it('yeni sıra sonraki eklemeyi de etkiler', () => {
        addTask('Bir');
        addTask('İki');
        const [a, b] = store().tasks;

        store().reorderTasks([b, a]);
        addTask('Üç');

        expect(store().tasks.find(t => t.title === 'Üç')?.position).toBe(2);
    });
});

describe('clearCompleted', () => {
    it('yalnızca tamamlanmış görevleri siler', () => {
        addTask('Bir');
        addTask('İki');
        addTask('Üç');
        store().toggleComplete(store().tasks[1].id);

        store().clearCompleted();

        expect(store().tasks.map(t => t.title)).toEqual(['Bir', 'Üç']);
    });
});

describe('importTasks', () => {
    it('geçerli görevleri ekler ve sayısını döner', () => {
        const added = store().importTasks([
            { id: 'x1', title: 'Dosyadan bir' },
            { id: 'x2', title: 'Dosyadan iki' },
        ]);

        expect(added).toBe(2);
        expect(store().tasks.map(t => t.title)).toEqual(['Dosyadan bir', 'Dosyadan iki']);
    });

    it('aynı id ile gelen görevi tekrar eklemez', () => {
        store().importTasks([{ id: 'x1', title: 'Dosyadan bir' }]);
        const added = store().importTasks([{ id: 'x1', title: 'Dosyadan bir' }]);

        expect(added).toBe(0);
        expect(store().tasks).toHaveLength(1);
    });

    it('aynı dosyada tekrarlanan id-yi bir kez ekler', () => {
        const added = store().importTasks([
            { id: 'x1', title: 'Bir' },
            { id: 'x1', title: 'Bir kopya' },
        ]);

        expect(added).toBe(1);
    });

    it('bozuk kayıtları atlar ama sağlamları alır', () => {
        const added = store().importTasks([
            { title: 'Geçerli' },
            { title: '   ' },
            null,
            'lorem',
            42,
            {},
        ]);

        expect(added).toBe(1);
        expect(store().tasks.map(t => t.title)).toEqual(['Geçerli']);
    });

    it('içe aktarılan görevleri mevcut listenin sonuna koyar', () => {
        addTask('Mevcut');
        store().importTasks([
            { id: 'x1', title: 'Dosyadan', position: 0 },
        ]);

        const positions = store().tasks.map(t => t.position);
        expect(new Set(positions).size).toBe(2);
        expect(store().tasks.find(t => t.title === 'Dosyadan')?.position).toBe(1);
    });

    it('eski biçimdeki tarihleri dönüştürür', () => {
        store().importTasks([
            { id: 'x1', title: 'Eski', dueDate: '2026-08-15T00:00:00.000Z' },
        ]);

        expect(store().tasks[0].dueDate).toBe('2026-08-15');
    });

    it('boş listede hiçbir şey yapmaz', () => {
        expect(store().importTasks([])).toBe(0);
        expect(store().tasks).toEqual([]);
    });
});

describe('filtre durumu', () => {
    it('arama ve filtre değerlerini saklar', () => {
        store().setSearchQuery('rapor');
        store().setFilter('active');

        expect(store().searchQuery).toBe('rapor');
        expect(store().filter).toBe('active');
    });
});

describe('senkron meta verisi', () => {
    it('yeni görev gönderilmeyi bekler', () => {
        addTask('Bir');
        expect(store().dirtyIds).toEqual([store().tasks[0].id]);
    });

    it('güncelleme görevi tekrar bekleyenlere alır ve updatedAt tazeler', async () => {
        addTask('Bir');
        const id = store().tasks[0].id;
        const before = store().tasks[0].updatedAt;

        store().applySyncResult({
            tasks: store().tasks, categories: store().categories, syncedIds: [id],
            clearedTombstoneIds: [], syncedCategoryIds: [], clearedCategoryTombstoneIds: [],
            syncedAt: 'x',
        });
        expect(store().dirtyIds).toEqual([]);

        await new Promise(r => setTimeout(r, 2));
        store().updateTask(id, { title: 'Bir (güncel)' });

        expect(store().dirtyIds).toEqual([id]);
        expect(store().tasks[0].updatedAt > before).toBe(true);
    });

    it('silme mezar taşı bırakır ve bekleyenlerden düşer', () => {
        addTask('Bir');
        const id = store().tasks[0].id;

        store().deleteTask(id);

        expect(store().dirtyIds).toEqual([]);
        expect(store().tombstones.map(t => t.id)).toEqual([id]);
    });

    it('tamamlananları temizlemek her biri için mezar taşı bırakır', () => {
        addTask('Bir');
        addTask('İki');
        store().toggleComplete(store().tasks[0].id);
        const completedId = store().tasks[0].id;

        store().clearCompleted();

        expect(store().tombstones.map(t => t.id)).toEqual([completedId]);
    });

    it('sıralama yalnızca konumu değişen görevleri bekleyenlere alır', () => {
        addTask('Bir');
        addTask('İki');
        addTask('Üç');
        const [a, b, c] = store().tasks;
        store().applySyncResult({
            tasks: store().tasks,
            categories: store().categories,
            syncedIds: [a.id, b.id, c.id],
            clearedTombstoneIds: [],
            syncedCategoryIds: [],
            clearedCategoryTombstoneIds: [],
            syncedAt: 'x',
        });

        // Son iki görevin yeri değişiyor; ilki yerinde kalıyor.
        store().reorderTasks([a, c, b]);

        expect(store().dirtyIds.sort()).toEqual([b.id, c.id].sort());
    });

    it('applySyncResult senkron sürerken yapılan değişikliği korur', () => {
        addTask('Bir');
        addTask('İki');
        const [first, second] = store().tasks;

        // Yalnızca ilk görev gönderildi; ikincisi hâlâ beklemeli.
        store().applySyncResult({
            tasks: store().tasks,
            categories: store().categories,
            syncedIds: [first.id],
            clearedTombstoneIds: [],
            syncedCategoryIds: [],
            clearedCategoryTombstoneIds: [],
            syncedAt: '2026-01-01T00:00:00.000Z',
        });

        expect(store().dirtyIds).toEqual([second.id]);
        expect(store().lastSyncedAt).toBe('2026-01-01T00:00:00.000Z');
    });
});

describe('prepareForSync', () => {
    it('misafir verisini hesaba aktarır', () => {
        addTask('Misafir görevi');
        const id = store().tasks[0].id;
        store().applySyncResult({
            tasks: store().tasks, categories: store().categories, syncedIds: [id],
            clearedTombstoneIds: [], syncedCategoryIds: [], clearedCategoryTombstoneIds: [],
            syncedAt: 'x',
        });

        store().prepareForSync('kullanici-1');

        expect(store().ownerId).toBe('kullanici-1');
        expect(store().dirtyIds).toEqual([id]);
    });

    it('veri zaten aynı hesaba aitse görevleri yeniden bekleyenlere ALMAZ', () => {
        // Bu, başka cihazda silinen görevin geri dirilmesine yol açan hataydı.
        addTask('Senkronlanmış görev');
        const id = store().tasks[0].id;
        store().prepareForSync('kullanici-1');
        store().applySyncResult({
            tasks: store().tasks, categories: store().categories, syncedIds: [id],
            clearedTombstoneIds: [], syncedCategoryIds: [], clearedCategoryTombstoneIds: [],
            syncedAt: 'x',
        });
        expect(store().dirtyIds).toEqual([]);

        store().prepareForSync('kullanici-1');

        expect(store().dirtyIds).toEqual([]);
    });

    it('başka hesap giriş yaparsa cihazı temizler', () => {
        addTask('Birinci kullanıcının görevi');
        store().prepareForSync('kullanici-1');
        store().applySyncResult({
            tasks: store().tasks,
            categories: store().categories,
            syncedIds: store().tasks.map(t => t.id),
            clearedTombstoneIds: [],
            syncedCategoryIds: [],
            clearedCategoryTombstoneIds: [],
            syncedAt: 'x',
        });

        store().prepareForSync('kullanici-2');

        expect(store().tasks).toEqual([]);
        expect(store().dirtyIds).toEqual([]);
        expect(store().ownerId).toBe('kullanici-2');
        expect(store().lastSyncedAt).toBeNull();
    });
});

describe('kalıcılık (persist)', () => {
    it('görevleri LocalStorage-a yazar', async () => {
        addTask('Kalıcı görev');

        // persist yazma işlemi mikro görev sırasında tamamlanır.
        await Promise.resolve();

        const raw = localStorage.getItem(STORAGE_KEY);
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw as string);
        expect(parsed.state.tasks[0].title).toBe('Kalıcı görev');
        expect(parsed.version).toBe(4);
    });

    it('yazılan tarihler string olarak saklanır', async () => {
        addTask('Tarihli', { dueDate: '2026-08-15' });
        await Promise.resolve();

        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
        expect(typeof parsed.state.tasks[0].createdAt).toBe('string');
        expect(parsed.state.tasks[0].dueDate).toBe('2026-08-15');
    });
});

describe('v0 -> v1 göçü', () => {
    /**
     * Eski sürüm tarihleri Date sanıyordu ama JSON-a string yazıyordu ve geri
     * çevirmiyordu; position alanı da yoktu. Kayıtlı veri bozulmadan taşınmalı.
     */
    it('eski kaydı okurken tarihleri ve position alanını düzeltir', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 0,
            state: {
                searchQuery: '',
                filter: 'all',
                tasks: [
                    {
                        id: 'eski-1',
                        title: 'Eski görev',
                        priority: 'Yüksek',
                        category: 'İş',
                        completed: false,
                        createdAt: '2026-01-05T08:00:00.000Z',
                        dueDate: '2026-08-15T00:00:00.000Z',
                    },
                ],
            },
        }));

        await useTaskStore.persist.rehydrate();

        const [task] = store().tasks;
        expect(task.title).toBe('Eski görev');
        expect(task.dueDate).toBe('2026-08-15');
        expect(task.position).toBe(0);
        expect(task.priority).toBe('high');
        expect(task.categoryId).toBe(store().categories.find(c => c.name === 'İş')?.id);
    });

    it('eski kayıttaki bozuk görevleri eler', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 0,
            state: {
                searchQuery: '',
                filter: 'all',
                tasks: [
                    { id: 'iyi', title: 'Sağlam' },
                    { id: 'bozuk', title: '' },
                ],
            },
        }));

        await useTaskStore.persist.rehydrate();

        expect(store().tasks.map(t => t.title)).toEqual(['Sağlam']);
    });
});

describe('kategoriler', () => {
    const nameOf = (id: string | null) =>
        store().categories.find(c => c.id === id)?.name;

    it('yeni cihaz varsayılan kategorilerle açılır', () => {
        expect(store().categories.map(c => c.name)).toEqual([
            'İş', 'Kişisel', 'Alışveriş', 'Okul',
        ]);
    });

    it('kategori ekler ve gönderilmeyi bekleyenlere alır', () => {
        const created = store().addCategory('Tatil', '#ef4444');

        expect(created).not.toBeNull();
        expect(nameOf(created!.id)).toBe('Tatil');
        expect(store().dirtyCategoryIds).toContain(created!.id);
    });

    it('aynı adı ikinci kez eklemez', () => {
        // Veritabanında benzersizlik kısıtı bilinçli olarak yok; tekrarı
        // arayüz katmanı engelliyor.
        expect(store().addCategory('iş', '#ef4444')).toBeNull();
        expect(store().categories.filter(c => c.name === 'İş')).toHaveLength(1);
    });

    it('boş adı reddeder', () => {
        expect(store().addCategory('   ', '#ef4444')).toBeNull();
    });

    it('kategoriyi yeniden adlandırır', () => {
        const id = store().categories[0].id;

        store().updateCategory(id, { name: 'Mesai' });

        expect(nameOf(id)).toBe('Mesai');
        expect(store().dirtyCategoryIds).toContain(id);
    });

    it('başka bir kategoriyle çakışan ada izin vermez', () => {
        const [is, kisisel] = store().categories;

        store().updateCategory(is.id, { name: kisisel.name });

        expect(nameOf(is.id)).toBe('İş');
    });

    it('kategorinin kendi adını korumak çakışma sayılmaz', () => {
        const id = store().categories[0].id;

        store().updateCategory(id, { name: 'İş', color: '#10b981' });

        expect(store().categories.find(c => c.id === id)?.color).toBe('#10b981');
    });

    it('kategori silinince bağlı görevler silinmez, kategorisiz olur', () => {
        const id = store().categories[0].id;
        addTask('Rapor', { categoryId: id });
        addTask('Alışveriş', { categoryId: store().categories[2].id });

        store().deleteCategory(id);

        expect(store().tasks.map(t => t.title)).toEqual(['Rapor', 'Alışveriş']);
        expect(store().tasks[0].categoryId).toBeNull();
        // Diğer görevin bağı etkilenmemeli.
        expect(store().tasks[1].categoryId).not.toBeNull();
    });

    it('silinen kategori için mezar taşı bırakır', () => {
        const id = store().categories[0].id;

        store().deleteCategory(id);

        expect(store().categoryTombstones.map(t => t.id)).toEqual([id]);
        expect(store().dirtyCategoryIds).not.toContain(id);
    });

    it('kategori silmek görevleri dirty yapmaz', () => {
        // Sunucuda bağı `on delete set null` zaten koparıyor. Görevleri
        // dirty işaretlemek, başka cihazda aynı görevde yapılmış gerçek bir
        // düzenlemeyi haksız yere yenmesine yol açardı.
        const id = store().categories[0].id;
        addTask('Rapor', { categoryId: id });
        const taskId = store().tasks[0].id;

        store().applySyncResult({
            tasks: store().tasks,
            categories: store().categories,
            syncedIds: [taskId],
            clearedTombstoneIds: [],
            syncedCategoryIds: [],
            clearedCategoryTombstoneIds: [],
            syncedAt: 'x',
        });
        store().deleteCategory(id);

        expect(store().dirtyIds).toEqual([]);
    });

    it('misafir verisi hesaba aktarılırken kategoriler de bekleyenlere alınır', () => {
        addTask('Misafir görevi');

        store().prepareForSync('kullanici-1');

        expect(store().dirtyCategoryIds).toHaveLength(4);
    });

    it('başka hesap giriş yaparsa kategorileri yeniden tohumlamaz', () => {
        // Tohumlamak, kullanıcının o hesapta sildiği varsayılan kategorileri
        // geri diriltir ve buluta yeniden yazardı.
        store().prepareForSync('kullanici-1');
        store().prepareForSync('kullanici-2');

        expect(store().categories).toEqual([]);
        expect(store().dirtyCategoryIds).toEqual([]);
    });
});

describe('v3 -> v4 göçü (dile bağımsız değerler)', () => {
    it('Türkçe öncelik etiketlerini anahtara çevirir', async () => {
        // Bu göç olmadan mevcut kullanıcının bütün görevleri sessizce
        // "Orta" önceliğe düşerdi.
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 3,
            state: {
                filter: 'Tüm Görevler', dirtyIds: [], tombstones: [],
                dirtyCategoryIds: [], categoryTombstones: [], ownerId: null,
                categories: [],
                tasks: [
                    { id: 'a', title: 'Acil', priority: 'Yüksek', completed: false, categoryId: null,
                      createdAt: '2026-01-05T08:00:00.000Z', updatedAt: '2026-01-05T08:00:00.000Z', position: 0 },
                    { id: 'b', title: 'Sonra', priority: 'Düşük', completed: false, categoryId: null,
                      createdAt: '2026-01-05T08:00:00.000Z', updatedAt: '2026-01-05T08:00:00.000Z', position: 1 },
                ],
            },
        }));

        await useTaskStore.persist.rehydrate();

        expect(store().tasks.map(t => t.priority)).toEqual(['high', 'low']);
    });

    it('Türkçe filtre değerini anahtara çevirir', async () => {
        // Çevrilmezse kayıtlı filtre hiçbir görevle eşleşmez ve liste boş görünür.
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 3,
            state: {
                filter: 'Aktif', dirtyIds: [], tombstones: [],
                dirtyCategoryIds: [], categoryTombstones: [], ownerId: null,
                categories: [], tasks: [],
            },
        }));

        await useTaskStore.persist.rehydrate();

        expect(store().filter).toBe('active');
    });

    it('tanınmayan filtre değerini varsayılana düşürür', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 3,
            state: {
                filter: 'Bozuk', dirtyIds: [], tombstones: [],
                dirtyCategoryIds: [], categoryTombstones: [], ownerId: null,
                categories: [], tasks: [],
            },
        }));

        await useTaskStore.persist.rehydrate();

        expect(store().filter).toBe('all');
    });
});

describe('v2 -> v3 göçü (kategoriler)', () => {
    it('metin kategoriyi tohumlanan kategoriye bağlar', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 2,
            state: {
                filter: 'all',
                dirtyIds: [],
                tombstones: [],
                ownerId: null,
                tasks: [{
                    id: 't1',
                    title: 'Rapor',
                    priority: 'Yüksek',
                    category: 'İş',
                    completed: false,
                    createdAt: '2026-01-05T08:00:00.000Z',
                    updatedAt: '2026-01-05T08:00:00.000Z',
                    position: 0,
                }],
            },
        }));

        await useTaskStore.persist.rehydrate();

        const is = store().categories.find(c => c.name === 'İş');
        expect(is).toBeDefined();
        expect(store().tasks[0].categoryId).toBe(is!.id);
        // Eski alan kayıtta kalmamalı.
        expect('category' in store().tasks[0]).toBe(false);
    });

    it('tanınmayan kategori metnini kategorisiz yapar', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 2,
            state: {
                filter: 'all', dirtyIds: [], tombstones: [], ownerId: null,
                tasks: [{
                    id: 't1', title: 'X', priority: 'medium', category: 'Bahçe',
                    completed: false, createdAt: '2026-01-05T08:00:00.000Z',
                    updatedAt: '2026-01-05T08:00:00.000Z', position: 0,
                }],
            },
        }));

        await useTaskStore.persist.rehydrate();

        expect(store().tasks[0].categoryId).toBeNull();
    });

    it('tohumlanan kategorileri gönderilmeyi bekler olarak işaretler', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 2,
            state: {
                filter: 'all', dirtyIds: [], tombstones: [], ownerId: null, tasks: [],
            },
        }));

        await useTaskStore.persist.rehydrate();

        expect(store().dirtyCategoryIds).toHaveLength(4);
        expect(store().categoryTombstones).toEqual([]);
    });
});
