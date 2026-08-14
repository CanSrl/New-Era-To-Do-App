import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category, Task, FilterStatus } from '../lib/types';
import { createId, nextPosition, normalizeTask, toPriority } from '../lib/tasks';
import {
    categoryKey,
    createCategory,
    DEFAULT_CATEGORIES,
    nextCategoryPosition,
    seedCategories,
} from '../lib/categories';

/** Silinen görevin izi; silmenin diğer cihazlara yayılabilmesi için tutulur. */
export interface Tombstone {
    id: string;
    deletedAt: string;
}

/** Mezar taşları bu süreden eski ise atılır (senkronlanmamış olsalar bile). */
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** v3 ve öncesinde kaydedilmiş Türkçe filtre değerleri. */
const LEGACY_FILTERS: Record<string, FilterStatus> = {
    'Tüm Görevler': 'all',
    'Aktif': 'active',
    'Tamamlandı': 'completed',
};

interface TaskState {
    tasks: Task[];
    categories: Category[];
    searchQuery: string;
    filter: FilterStatus;

    /** Buluta itilmeyi bekleyen görev id'leri. */
    dirtyIds: string[];
    /** Buluttan silinmeyi bekleyen görevler. */
    tombstones: Tombstone[];
    /** Buluta itilmeyi bekleyen kategori id'leri. */
    dirtyCategoryIds: string[];
    /** Buluttan silinmeyi bekleyen kategoriler. */
    categoryTombstones: Tombstone[];
    lastSyncedAt: string | null;
    /**
     * Cihazdaki görevlerin ait olduğu hesap. Misafir verisi için null.
     * Senkronun hangi durumda olduğunu ayırt etmek için şart: bu bilgi
     * olmadan her girişte tüm görevler "gönderilmeyi bekliyor" sayılır ve
     * başka cihazda silinen görevler geri dirilir.
     */
    ownerId: string | null;

    addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'position'>) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    toggleComplete: (id: string) => void;
    reorderTasks: (tasks: Task[]) => void;
    clearCompleted: () => void;

    /** Adı zaten kullanılıyorsa null döner; aksi halde yeni kategoriyi. */
    addCategory: (name: string, color: string) => Category | null;
    updateCategory: (id: string, updates: { name?: string; color?: string }) => void;
    /** Kategoriyi siler; bağlı görevler silinmez, "Kategorisiz" olur. */
    deleteCategory: (id: string) => void;

    setSearchQuery: (query: string) => void;
    setFilter: (filter: FilterStatus) => void;
    importTasks: (tasks: unknown[]) => number;

    /** Senkron motorunun kullandığı düşük seviyeli işlemler. */
    applySyncResult: (result: {
        tasks: Task[];
        categories: Category[];
        syncedIds: string[];
        clearedTombstoneIds: string[];
        syncedCategoryIds: string[];
        clearedCategoryTombstoneIds: string[];
        syncedAt: string;
    }) => void;
    prepareForSync: (userId: string) => void;
}

const withDirty = (dirtyIds: string[], ...ids: string[]): string[] =>
    Array.from(new Set([...dirtyIds, ...ids]));

export const useTaskStore = create<TaskState>()(
    persist(
        (set, get) => ({
            tasks: [],
            // Yeni bir cihaz boş kategori listesiyle açılmaz: kullanıcı önce
            // ayarlara gidip kategori oluşturmak zorunda kalmasın diye
            // varsayılanlar tohumlanır. Kaydedilmiş durum varsa persist bunun
            // üzerine yazar.
            categories: seedCategories(),
            searchQuery: '',
            filter: 'all',
            dirtyIds: [],
            tombstones: [],
            dirtyCategoryIds: [],
            categoryTombstones: [],
            lastSyncedAt: null,
            ownerId: null,

            addTask: (taskData) => set((state) => {
                const now = new Date().toISOString();
                const task: Task = {
                    ...taskData,
                    id: createId(),
                    createdAt: now,
                    updatedAt: now,
                    position: nextPosition(state.tasks),
                };
                return {
                    tasks: [...state.tasks, task],
                    dirtyIds: withDirty(state.dirtyIds, task.id),
                };
            }),

            updateTask: (id, updates) => set((state) => {
                if (!state.tasks.some((t) => t.id === id)) return state;
                const now = new Date().toISOString();
                return {
                    tasks: state.tasks.map((t) =>
                        t.id === id ? { ...t, ...updates, updatedAt: now } : t
                    ),
                    dirtyIds: withDirty(state.dirtyIds, id),
                };
            }),

            deleteTask: (id) => set((state) => {
                if (!state.tasks.some((t) => t.id === id)) return state;
                return {
                    tasks: state.tasks.filter((t) => t.id !== id),
                    dirtyIds: state.dirtyIds.filter((dirtyId) => dirtyId !== id),
                    tombstones: [
                        ...state.tombstones.filter((t) => t.id !== id),
                        { id, deletedAt: new Date().toISOString() },
                    ],
                };
            }),

            toggleComplete: (id) => set((state) => {
                if (!state.tasks.some((t) => t.id === id)) return state;
                const now = new Date().toISOString();
                return {
                    tasks: state.tasks.map((t) =>
                        t.id === id ? { ...t, completed: !t.completed, updatedAt: now } : t
                    ),
                    dirtyIds: withDirty(state.dirtyIds, id),
                };
            }),

            // Sıralama anahtarları yeniden numaralandırılır; böylece sıra
            // dizinin sırasına değil, veriye yazılı hale gelir.
            reorderTasks: (newTasks) => set((state) => {
                const now = new Date().toISOString();
                const changed: string[] = [];

                const tasks = newTasks.map((task, index) => {
                    if (task.position === index) return task;
                    changed.push(task.id);
                    return { ...task, position: index, updatedAt: now };
                });

                return { tasks, dirtyIds: withDirty(state.dirtyIds, ...changed) };
            }),

            clearCompleted: () => set((state) => {
                const removed = state.tasks.filter((t) => t.completed);
                if (removed.length === 0) return state;

                const now = new Date().toISOString();
                const removedIds = new Set(removed.map((t) => t.id));

                return {
                    tasks: state.tasks.filter((t) => !t.completed),
                    dirtyIds: state.dirtyIds.filter((id) => !removedIds.has(id)),
                    tombstones: [
                        ...state.tombstones.filter((t) => !removedIds.has(t.id)),
                        ...removed.map((t) => ({ id: t.id, deletedAt: now })),
                    ],
                };
            }),

            addCategory: (name, color) => {
                const trimmed = name.trim();
                const state = get();
                if (!trimmed) return null;

                // Veritabanında benzersizlik kısıtı bilinçli olarak yok
                // (bkz. migration); tekrarı burada engelliyoruz.
                const key = categoryKey(trimmed);
                if (state.categories.some((c) => categoryKey(c.name) === key)) return null;

                const category = createCategory(
                    trimmed,
                    color,
                    nextCategoryPosition(state.categories)
                );

                set((current) => ({
                    categories: [...current.categories, category],
                    dirtyCategoryIds: withDirty(current.dirtyCategoryIds, category.id),
                }));

                return category;
            },

            updateCategory: (id, updates) => set((state) => {
                const existing = state.categories.find((c) => c.id === id);
                if (!existing) return state;

                const name = updates.name?.trim();
                if (name !== undefined && !name) return state;

                // Yeniden adlandırma başka bir kategoriyle çakışmamalı.
                if (name !== undefined) {
                    const key = categoryKey(name);
                    if (state.categories.some((c) => c.id !== id && categoryKey(c.name) === key)) {
                        return state;
                    }
                }

                return {
                    categories: state.categories.map((c) =>
                        c.id === id
                            ? {
                                ...c,
                                ...(name !== undefined ? { name } : {}),
                                ...(updates.color !== undefined ? { color: updates.color } : {}),
                                updatedAt: new Date().toISOString(),
                            }
                            : c
                    ),
                    dirtyCategoryIds: withDirty(state.dirtyCategoryIds, id),
                };
            }),

            /**
             * Bağlı görevlerin categoryId alanı burada boşaltılır; görevler
             * silinmez. Sunucuda aynı şeyi `on delete set null` yapar, bu
             * yüzden görevler dirty işaretlenmez — işaretlemek, başka cihazda
             * aynı görevde yapılmış gerçek bir düzenlemeyi haksız yere
             * yenmesine yol açardı.
             */
            deleteCategory: (id) => set((state) => {
                if (!state.categories.some((c) => c.id === id)) return state;

                return {
                    categories: state.categories.filter((c) => c.id !== id),
                    tasks: state.tasks.map((t) =>
                        t.categoryId === id ? { ...t, categoryId: null } : t
                    ),
                    dirtyCategoryIds: state.dirtyCategoryIds.filter((dirtyId) => dirtyId !== id),
                    categoryTombstones: [
                        ...state.categoryTombstones.filter((t) => t.id !== id),
                        { id, deletedAt: new Date().toISOString() },
                    ],
                };
            }),

            setSearchQuery: (query) => set({ searchQuery: query }),

            setFilter: (filter) => set({ filter }),

            /**
             * Dosyadan gelen görevleri ekler; id'si zaten var olanları atlar.
             * Eklenen görev sayısını döner.
             */
            importTasks: (imported) => {
                const { tasks: existing, categories } = get();
                const existingIds = new Set(existing.map((t) => t.id));

                // Kategoriler kayıt hâline gelmeden önce dışa aktarılmış
                // dosyalarda kategori bir metindi; adı mevcut bir kategoriye
                // eşleşirse bağ korunur, eşleşmezse görev kategorisiz gelir.
                const idByName = new Map(categories.map((c) => [categoryKey(c.name), c.id]));
                const resolveCategoryName = (name: string) => idByName.get(categoryKey(name)) ?? null;

                const incoming: Task[] = [];
                let position = nextPosition(existing);

                for (const raw of imported) {
                    const task = normalizeTask(raw, position, resolveCategoryName);
                    if (!task || existingIds.has(task.id)) continue;
                    existingIds.add(task.id);

                    // Dosyadaki categoryId bu cihazda karşılıksız olabilir
                    // (başka hesabın dışa aktarması). Bağı korumak yabancı
                    // anahtar hatasına yol açacağı için görev kategorisiz gelir.
                    const categoryId = task.categoryId !== null
                        && categories.some((c) => c.id === task.categoryId)
                        ? task.categoryId
                        : null;

                    // İçe aktarılan görevler mevcut listenin sonuna eklenir;
                    // dosyadaki position değerleri mevcut sırayla çakışabilir.
                    incoming.push({ ...task, categoryId, position });
                    position += 1;
                }

                if (incoming.length > 0) {
                    set((state) => ({
                        tasks: [...state.tasks, ...incoming],
                        dirtyIds: withDirty(state.dirtyIds, ...incoming.map((t) => t.id)),
                    }));
                }
                return incoming.length;
            },

            /**
             * Senkron turunun sonucunu uygular.
             *
             * Yalnızca gerçekten gönderilen id'ler temiz sayılır: senkron
             * sürerken kullanıcı bir görevi değiştirdiyse o görev dirty kalır
             * ve sonraki turda tekrar gönderilir.
             */
            applySyncResult: ({
                tasks,
                categories,
                syncedIds,
                clearedTombstoneIds,
                syncedCategoryIds,
                clearedCategoryTombstoneIds,
                syncedAt,
            }) => set((state) => {
                const synced = new Set(syncedIds);
                const cleared = new Set(clearedTombstoneIds);
                const syncedCategories = new Set(syncedCategoryIds);
                const clearedCategories = new Set(clearedCategoryTombstoneIds);
                const cutoff = Date.now() - TOMBSTONE_TTL_MS;
                const alive = (t: Tombstone) => new Date(t.deletedAt).getTime() > cutoff;

                return {
                    tasks,
                    categories,
                    dirtyIds: state.dirtyIds.filter((id) => !synced.has(id)),
                    tombstones: state.tombstones.filter((t) => !cleared.has(t.id) && alive(t)),
                    dirtyCategoryIds: state.dirtyCategoryIds.filter(
                        (id) => !syncedCategories.has(id)
                    ),
                    categoryTombstones: state.categoryTombstones.filter(
                        (t) => !clearedCategories.has(t.id) && alive(t)
                    ),
                    lastSyncedAt: syncedAt,
                };
            }),

            /**
             * Giriş yapıldığında cihazı senkrona hazırlar. Üç durum var:
             *
             * 1. Veri zaten bu hesaba ait: hiçbir şey yapılmaz. Görevleri
             *    yeniden dirty işaretlemek, başka cihazda silinenleri buluta
             *    geri yazıp diriltirdi.
             * 2. Misafir verisi (ownerId yok): tamamı hesaba aktarılır.
             * 3. Veri başka hesaba ait: o hesabın verisi zaten kendi bulutunda
             *    duruyor; cihaz temizlenip yeni hesabınki çekilir.
             *
             * Üçüncü durumda kategoriler yeniden tohumlanmaz. Tohumlamak,
             * kullanıcının o hesapta sildiği varsayılan kategorileri geri
             * diriltir ve buluta yeniden yazardı — cihaz sahipliği alanının
             * baştan var olma sebebiyle aynı hata.
             */
            prepareForSync: (userId) => set((state) => {
                if (state.ownerId === userId) return state;

                if (state.ownerId === null) {
                    return {
                        ownerId: userId,
                        dirtyIds: state.tasks.map((t) => t.id),
                        dirtyCategoryIds: state.categories.map((c) => c.id),
                    };
                }

                return {
                    ownerId: userId,
                    tasks: [],
                    categories: [],
                    dirtyIds: [],
                    tombstones: [],
                    dirtyCategoryIds: [],
                    categoryTombstones: [],
                    lastSyncedAt: null,
                };
            }),
        }),
        {
            name: 'yapilacaklar-storage',
            version: 4,
            partialize: (state) => ({
                tasks: state.tasks,
                categories: state.categories,
                filter: state.filter,
                dirtyIds: state.dirtyIds,
                tombstones: state.tombstones,
                dirtyCategoryIds: state.dirtyCategoryIds,
                categoryTombstones: state.categoryTombstones,
                lastSyncedAt: state.lastSyncedAt,
                ownerId: state.ownerId,
            }) as unknown as TaskState,
            /**
             * v0 -> v1: tarihler Date varsayılıyordu ama JSON'a string yazılıp
             *           geri çevrilmiyordu; position alanı yoktu.
             * v1 -> v2: senkronizasyon meta verisi (updatedAt, dirtyIds,
             *           tombstones) eklendi. Mevcut görevlerin tamamı dirty
             *           kabul edilir ki ilk girişte hesaba aktarılsınlar.
             * v2 -> v3: kategori sabit bir metindi ('İş'), artık kayda bağlı
             *           bir id. Varsayılan kategoriler oluşturulup görevlerin
             *           eski metni adına göre bunlara bağlanır.
             */
            migrate: (persisted, version) => {
                const state = persisted as Partial<TaskState> | undefined;
                if (!state || !Array.isArray(state.tasks)) return state as TaskState;

                // Kategori tohumları en başta üretilir: v0 yolundaki
                // normalizeTask eski `category` metnini kaydın üzerinden
                // siler, dolayısıyla çözücü ona da verilmek zorunda.
                // Adlar ve renkler veritabanı migration'ıyla birebir aynı
                // olmalı; ayrışırlarsa aynı kategori senkron sonrası iki kez
                // görünür (ada göre tekilleştirme tutmaz).
                const seeded = version < 3 ? seedCategories() : [];

                // Eşleme çevrilmiş ada değil sabit Türkçe `legacyName`'e
                // dayanır: kategoriler tabloya taşınmadan önceki bütün veri
                // Türkçeydi, arayüz şu an hangi dilde olursa olsun.
                const idByLegacyName = new Map(
                    DEFAULT_CATEGORIES.map((seed, index) => [
                        categoryKey(seed.legacyName),
                        seeded[index]?.id,
                    ])
                );
                const resolveCategoryName = (name: string) =>
                    idByLegacyName.get(categoryKey(name)) ?? null;

                if (version === 0) {
                    state.tasks = state.tasks
                        .map((task, index) => normalizeTask(task, index, resolveCategoryName))
                        .filter((task): task is Task => task !== null);
                }

                if (version < 2) {
                    state.tasks = state.tasks.map((task) => ({
                        ...task,
                        updatedAt: task.updatedAt ?? task.createdAt,
                    }));
                    state.dirtyIds = state.tasks.map((t) => t.id);
                    state.tombstones = [];
                    state.lastSyncedAt = null;
                    // Mevcut veri misafir verisidir: ilk girişte hesaba aktarılır.
                    state.ownerId = null;
                }

                if (version < 3) {
                    state.categories = seeded;
                    state.tasks = state.tasks.map((task) => {
                        const { category: legacy, ...rest } =
                            task as unknown as Task & { category?: unknown };

                        return {
                            ...rest,
                            // v0 yolundan geçen kayıtlarda bağ zaten kuruldu.
                            categoryId: rest.categoryId
                                ?? (typeof legacy === 'string' ? resolveCategoryName(legacy) : null),
                        };
                    });

                    // Tohumlanan kategoriler gönderilmeyi bekler. Hesabı olan
                    // kullanıcıda bulut tarafı SQL migration'ıyla kendi
                    // kategorilerini zaten oluşturdu; bunlar ada göre
                    // tekilleştirilip düşecek.
                    state.dirtyCategoryIds = seeded.map((c) => c.id);
                    state.categoryTombstones = [];
                }

                if (version < 4) {
                    // Öncelik ve filtre istemcide Türkçe etiketti; i18n ile
                    // dile bağımsız anahtarlara geçtiler. Çevrilmezse mevcut
                    // kullanıcının bütün görevleri sessizce "Orta"ya düşer ve
                    // seçili filtre hiçbir görevle eşleşmez.
                    state.tasks = state.tasks.map((task) => ({
                        ...task,
                        priority: toPriority(task.priority),
                    }));
                    state.filter = LEGACY_FILTERS[state.filter as string] ?? 'all';
                }

                return state as TaskState;
            },
        }
    )
);
