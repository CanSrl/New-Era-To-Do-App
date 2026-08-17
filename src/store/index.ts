import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ActiveTimer, Category, Client, Project, Task, TimeLog, FilterStatus } from '../lib/types';
import { createId, nextPosition, normalizeTask, toPriority } from '../lib/tasks';
import {
    categoryKey,
    createCategory,
    DEFAULT_CATEGORIES,
    nextCategoryPosition,
    seedCategories,
} from '../lib/categories';
import { createClient, isClientNameTaken, nextClientPosition } from '../lib/clients';
import { createProject, isProjectNameTaken, nextProjectPosition } from '../lib/projects';
import { createTimeLog, elapsedMinutes, isValidDuration } from '../lib/time-logs';

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
    /** Niş modül: kullanıcının müşterileri. */
    clients: Client[];
    /** Niş modül: müşterilere ait projeler. */
    projects: Project[];
    /** Niş modül: müşteri/proje/göreve bağlı zaman kayıtları. */
    timeLogs: TimeLog[];
    /**
     * O an çalışan sayaç, cihaz başına en fazla bir tane. `null` = sayaç
     * kapalı. `partialize`'da SAKLANMAK ZORUNDA — TIME-01 "sayfa
     * yenilemesinden sağ çıkar" gereksinimi tamamen buna dayanır.
     */
    activeTimer: ActiveTimer | null;
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
    /** Buluta itilmeyi bekleyen müşteri id'leri. */
    dirtyClientIds: string[];
    /** Buluttan silinmeyi bekleyen müşteriler. */
    clientTombstones: Tombstone[];
    /** Buluta itilmeyi bekleyen proje id'leri. */
    dirtyProjectIds: string[];
    /** Buluttan silinmeyi bekleyen projeler. */
    projectTombstones: Tombstone[];
    /** Buluta itilmeyi bekleyen zaman kaydı id'leri. */
    dirtyTimeLogIds: string[];
    /** Buluttan silinmeyi bekleyen zaman kayıtları. */
    timeLogTombstones: Tombstone[];
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

    /** Adı zaten kullanılıyorsa null döner; aksi halde yeni müşteriyi. */
    addClient: (name: string) => Client | null;
    updateClient: (id: string, updates: { name?: string; archived?: boolean }) => void;
    /**
     * Müşteriyi siler. Bağlı projeler veritabanındaki cascade ile aynı
     * şekilde silinir (mezar taşı bırakılmadan — sunucu zaten kendi
     * tarafında siliyor); bağlı görevlerin hem client hem project bağı
     * boşalır ve dirty işaretlenmez (bkz. deleteCategory).
     */
    deleteClient: (id: string) => void;
    reorderClients: (clients: Client[]) => void;

    /** Adı aynı müşterinin başka projesinde kullanılıyorsa null döner. */
    addProject: (clientId: string, name: string) => Project | null;
    updateProject: (id: string, updates: { name?: string; archived?: boolean }) => void;
    /** Projeyi siler; bağlı görevler silinmez, proje bağı boşalır. */
    deleteProject: (id: string) => void;
    reorderProjects: (projects: Project[]) => void;

    /**
     * Sayacı başlatır. Tek sayaç kuralı BURADA uygulanır, arayüzde değil:
     * zaten çalışan bir sayaç varsa önce durdurulup kayda çevrilir.
     * `now` opsiyoneldir; üretimde varsayılana düşer, testte açıkça
     * geçirilir — sahte saat kurmadan süre üretebilmenin tek yolu bu.
     *
     * Müşterisiz çağrı yok sayılır (`time_logs.client_id not null`).
     */
    startTimer: (
        input: { taskId: string | null; clientId: string; projectId: string | null; note?: string | null },
        now?: string
    ) => void;
    /** Çalışan sayacı durdurup kayda çevirir (1 dakikadan kısaysa atar). */
    stopTimer: (now?: string) => void;
    /** Sayacı kayıt üretmeden atar (yanlışlıkla başlatılmış sayaç için). */
    discardTimer: () => void;

    /**
     * Bağımsız (sayaç kullanmadan) bir zaman kaydı ekler.
     *
     * Müşterisiz ya da şemanın kabul etmeyeceği süredeki girdi reddedilir ve
     * `null` döner — `addClient`/`addCategory` ile aynı sözleşme.
     */
    addTimeLog: (input: {
        taskId?: string | null;
        clientId: string;
        projectId?: string | null;
        startedAt: string;
        durationMinutes: number;
        note?: string | null;
    }) => TimeLog | null;
    /**
     * Kaydı günceller. Şemanın reddedeceği yama (boş müşteri, geçersiz süre)
     * sessizce yok sayılır; `updateCategory`/`updateClient` ile aynı desen.
     */
    updateTimeLog: (
        id: string,
        patch: Partial<Pick<TimeLog, 'taskId' | 'clientId' | 'projectId' | 'startedAt' | 'durationMinutes' | 'note'>>
    ) => void;
    /** Zaman kaydını siler. */
    deleteTimeLog: (id: string) => void;

    setSearchQuery: (query: string) => void;
    setFilter: (filter: FilterStatus) => void;
    importTasks: (tasks: unknown[]) => number;

    /** Senkron motorunun kullandığı düşük seviyeli işlemler. */
    applySyncResult: (result: {
        tasks: Task[];
        categories: Category[];
        clients?: Client[];
        projects?: Project[];
        timeLogs?: TimeLog[];
        syncedIds: string[];
        clearedTombstoneIds: string[];
        syncedCategoryIds: string[];
        clearedCategoryTombstoneIds: string[];
        syncedClientIds?: string[];
        clearedClientTombstoneIds?: string[];
        syncedProjectIds?: string[];
        clearedProjectTombstoneIds?: string[];
        syncedTimeLogIds?: string[];
        clearedTimeLogTombstoneIds?: string[];
        syncedAt: string;
    }) => void;
    prepareForSync: (userId: string) => void;
}

const withDirty = (dirtyIds: string[], ...ids: string[]): string[] =>
    Array.from(new Set([...dirtyIds, ...ids]));

/**
 * Çalışan sayacı kayda çevirir. 1 dakikadan kısa süre kaydedilmez:
 * veritabanı kısıtı `duration_minutes > 0` ve yanlışlıkla başlatılıp hemen
 * durdurulan sayaç veri değil gürültüdür.
 */
function stopTimerInto(state: TaskState, now: string): Partial<TaskState> {
    if (!state.activeTimer) return {};

    const minutes = elapsedMinutes(state.activeTimer, now);
    if (minutes < 1) return {};

    const log = createTimeLog({
        taskId: state.activeTimer.taskId,
        clientId: state.activeTimer.clientId,
        projectId: state.activeTimer.projectId,
        startedAt: state.activeTimer.startedAt,
        durationMinutes: minutes,
        note: state.activeTimer.note,
    }, now);

    return {
        timeLogs: [...state.timeLogs, log],
        dirtyTimeLogIds: withDirty(state.dirtyTimeLogIds, log.id),
    };
}

export const useTaskStore = create<TaskState>()(
    persist(
        (set, get) => ({
            tasks: [],
            // Yeni bir cihaz boş kategori listesiyle açılmaz: kullanıcı önce
            // ayarlara gidip kategori oluşturmak zorunda kalmasın diye
            // varsayılanlar tohumlanır. Kaydedilmiş durum varsa persist bunun
            // üzerine yazar.
            categories: seedCategories(),
            clients: [],
            projects: [],
            timeLogs: [],
            activeTimer: null,
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
            dirtyTimeLogIds: [],
            timeLogTombstones: [],
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
                    // Sunucuda `on delete set null (task_id)`; kayıt durur,
                    // yalnızca görev bağı kopar. Sunucu aynı şeyi kendi
                    // referans eylemiyle zaten yapıyor, bu yüzden dirty
                    // işaretlenmez (bkz. deleteCategory'deki aynı gerekçe).
                    timeLogs: state.timeLogs.map((l) =>
                        l.taskId === id ? { ...l, taskId: null } : l
                    ),
                    // Çalışan sayaç bu göreveyse yalnızca taskId boşalır, aynı
                    // `on delete set null (task_id)` referansı gibi; sayaç
                    // çalışmaya devam eder (bağımsız zaman kaydı olur).
                    activeTimer: state.activeTimer?.taskId === id
                        ? { ...state.activeTimer, taskId: null }
                        : state.activeTimer,
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
                const timer = state.activeTimer;

                return {
                    tasks: state.tasks.filter((t) => !t.completed),
                    dirtyIds: state.dirtyIds.filter((id) => !removedIds.has(id)),
                    tombstones: [
                        ...state.tombstones.filter((t) => !removedIds.has(t.id)),
                        ...removed.map((t) => ({ id: t.id, deletedAt: now })),
                    ],
                    // Toplu silme de `deleteTask` ile aynı referans eylemini
                    // aynalamak zorunda (`on delete set null (task_id)`):
                    // aynalamazsa cihazda var olmayan bir göreve bağlı kayıt
                    // kalır ve bir sonraki senkrona kadar arayüz ölü bağ
                    // gösterir. Kayıtlar dirty işaretlenmez — sunucu aynı
                    // şeyi kendi tarafında zaten yapıyor.
                    timeLogs: state.timeLogs.map((l) =>
                        l.taskId !== null && removedIds.has(l.taskId)
                            ? { ...l, taskId: null }
                            : l
                    ),
                    activeTimer: timer && timer.taskId !== null && removedIds.has(timer.taskId)
                        ? { ...timer, taskId: null }
                        : timer,
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

            addClient: (name) => {
                const trimmed = name.trim();
                const state = get();
                if (!trimmed) return null;

                if (isClientNameTaken(state.clients, trimmed)) return null;

                const client = createClient(trimmed, nextClientPosition(state.clients));

                set((current) => ({
                    clients: [...current.clients, client],
                    dirtyClientIds: withDirty(current.dirtyClientIds, client.id),
                }));

                return client;
            },

            updateClient: (id, updates) => set((state) => {
                const existing = state.clients.find((c) => c.id === id);
                if (!existing) return state;

                const name = updates.name?.trim();
                if (name !== undefined && !name) return state;

                if (name !== undefined && isClientNameTaken(state.clients, name, id)) {
                    return state;
                }

                return {
                    clients: state.clients.map((c) =>
                        c.id === id
                            ? {
                                ...c,
                                ...(name !== undefined ? { name } : {}),
                                ...(updates.archived !== undefined ? { archived: updates.archived } : {}),
                                updatedAt: new Date().toISOString(),
                            }
                            : c
                    ),
                    dirtyClientIds: withDirty(state.dirtyClientIds, id),
                };
            }),

            deleteClient: (id) => set((state) => {
                if (!state.clients.some((c) => c.id === id)) return state;

                const removedProjectIds = new Set(
                    state.projects.filter((p) => p.clientId === id).map((p) => p.id)
                );
                const removedLogIds = new Set(
                    state.timeLogs.filter((l) => l.clientId === id).map((l) => l.id)
                );

                return {
                    clients: state.clients.filter((c) => c.id !== id),
                    // Sunucudaki cascade projeleri zaten siliyor; burada mezar
                    // taşı bırakmıyoruz, aksi halde senkron turunda zaten var
                    // olmayan bir kaydın silinmesi istenirdi.
                    projects: state.projects.filter((p) => p.clientId !== id),
                    dirtyProjectIds: state.dirtyProjectIds.filter(
                        (dirtyId) => !removedProjectIds.has(dirtyId)
                    ),
                    // Sunucudaki tetikleyici bu müşteriye bağlı görevlerin hem
                    // client hem project alanını boşaltıyor; dirty işaretlemiyoruz
                    // (bkz. deleteCategory'deki aynı gerekçe).
                    tasks: state.tasks.map((t) =>
                        t.clientId === id ? { ...t, clientId: null, projectId: null } : t
                    ),
                    dirtyClientIds: state.dirtyClientIds.filter((dirtyId) => dirtyId !== id),
                    clientTombstones: [
                        ...state.clientTombstones.filter((t) => t.id !== id),
                        { id, deletedAt: new Date().toISOString() },
                    ],
                    // Bağlı zaman kayıtları mezar taşı BIRAKMADAN silinir —
                    // sunucu zaten `on delete cascade` ile siliyor, mezar taşı
                    // ikinci bir (ve zaten yok olmuş bir kaydı hedefleyen)
                    // silme emri olurdu.
                    timeLogs: state.timeLogs.filter((l) => l.clientId !== id),
                    dirtyTimeLogIds: state.dirtyTimeLogIds.filter(
                        (dirtyId) => !removedLogIds.has(dirtyId)
                    ),
                    // Çalışan sayaç bu müşteriyeyse ATILIR, kayda çevrilmez:
                    // kaydedilmiş kayıtlar zaten cascade ile gidiyor, sayacı
                    // durdurup yeni bir kayıt üretmek şemanın tutamayacağı bir
                    // satır olurdu (client_id artık yok) — stopTimer bunu
                    // dirty işaretler, push 23503 ile düşer ve dirtyTimeLogIds
                    // hiç temizlenmediği için HER turda aynı yerde tıkanır.
                    activeTimer: state.activeTimer?.clientId === id ? null : state.activeTimer,
                };
            }),

            reorderClients: (newClients) => set((state) => {
                const now = new Date().toISOString();
                const changed: string[] = [];

                const clients = newClients.map((client, index) => {
                    if (client.position === index) return client;
                    changed.push(client.id);
                    return { ...client, position: index, updatedAt: now };
                });

                return { clients, dirtyClientIds: withDirty(state.dirtyClientIds, ...changed) };
            }),

            addProject: (clientId, name) => {
                const trimmed = name.trim();
                const state = get();
                if (!trimmed) return null;

                if (isProjectNameTaken(state.projects, clientId, trimmed)) return null;

                const project = createProject(
                    clientId,
                    trimmed,
                    nextProjectPosition(state.projects, clientId)
                );

                set((current) => ({
                    projects: [...current.projects, project],
                    dirtyProjectIds: withDirty(current.dirtyProjectIds, project.id),
                }));

                return project;
            },

            updateProject: (id, updates) => set((state) => {
                const existing = state.projects.find((p) => p.id === id);
                if (!existing) return state;

                const name = updates.name?.trim();
                if (name !== undefined && !name) return state;

                if (
                    name !== undefined
                    && isProjectNameTaken(state.projects, existing.clientId, name, id)
                ) {
                    return state;
                }

                return {
                    projects: state.projects.map((p) =>
                        p.id === id
                            ? {
                                ...p,
                                ...(name !== undefined ? { name } : {}),
                                ...(updates.archived !== undefined ? { archived: updates.archived } : {}),
                                updatedAt: new Date().toISOString(),
                            }
                            : p
                    ),
                    dirtyProjectIds: withDirty(state.dirtyProjectIds, id),
                };
            }),

            deleteProject: (id) => set((state) => {
                if (!state.projects.some((p) => p.id === id)) return state;

                return {
                    projects: state.projects.filter((p) => p.id !== id),
                    // Sunucuda `on delete set null (project_id)`; client_id
                    // dokunulmaz, dolayısıyla görevleri dirty işaretlemiyoruz.
                    tasks: state.tasks.map((t) =>
                        t.projectId === id ? { ...t, projectId: null } : t
                    ),
                    dirtyProjectIds: state.dirtyProjectIds.filter((dirtyId) => dirtyId !== id),
                    projectTombstones: [
                        ...state.projectTombstones.filter((t) => t.id !== id),
                        { id, deletedAt: new Date().toISOString() },
                    ],
                    // Sunucuda da yalnızca project_id boşalır (`on delete set
                    // null (project_id)`), client_id dokunulmaz; kayıtlar da
                    // dirty işaretlenmez (bkz. deleteCategory'deki gerekçe).
                    timeLogs: state.timeLogs.map((l) =>
                        l.projectId === id ? { ...l, projectId: null } : l
                    ),
                    // Çalışan sayaç bu projeyeyse yalnızca projectId boşalır,
                    // aynı `on delete set null (project_id)` referansı gibi;
                    // clientId ve başlangıç zamanı durur, sayaç çalışmaya
                    // devam eder.
                    activeTimer: state.activeTimer?.projectId === id
                        ? { ...state.activeTimer, projectId: null }
                        : state.activeTimer,
                };
            }),

            reorderProjects: (newProjects) => set((state) => {
                const now = new Date().toISOString();
                const changed: string[] = [];

                const projects = newProjects.map((project, index) => {
                    if (project.position === index) return project;
                    changed.push(project.id);
                    return { ...project, position: index, updatedAt: now };
                });

                return { projects, dirtyProjectIds: withDirty(state.dirtyProjectIds, ...changed) };
            }),

            // `now` opsiyonel parametre: üretimde varsayılana düşer, testte
            // açıkça geçirilir. Sahte saat kurmadan süre üretebilmenin tek
            // yolu bu.
            startTimer: (input, now = new Date().toISOString()) =>
                set((state) => {
                    // Müşterisiz sayaç durdurulduğunda `client_id`'si boş bir
                    // kayıt üretirdi: push 23502 ile düşer, o turdaki bütün
                    // senkron onunla gider ve kayıt hiç temizlenmediği için
                    // her turda aynı yerde tıkanır. Arayüzdeki `disabled`
                    // butonun tek savunma olmaması için kural burada da var.
                    if (!input.clientId) return state;

                    // Tek sayaç kuralı BURADA uygulanır, arayüzde değil: yeni
                    // sayacı başlatmak öncekini durdurup kaydeder.
                    const stopped = state.activeTimer ? stopTimerInto(state, now) : {};

                    return {
                        ...stopped,
                        activeTimer: {
                            taskId: input.taskId,
                            clientId: input.clientId,
                            projectId: input.projectId,
                            startedAt: now,
                            note: input.note ?? null,
                        },
                    };
                }),

            stopTimer: (now = new Date().toISOString()) =>
                set((state) => ({ ...stopTimerInto(state, now), activeTimer: null })),

            /** Sayacı kayıt üretmeden atar (yanlışlıkla başlatılmış sayaç için). */
            discardTimer: () => set({ activeTimer: null }),

            addTimeLog: (input) => {
                // Şemanın kabul etmeyeceği kayıt push kuyruğuna hiç girmemeli
                // (bkz. isValidDuration). `createTimeLog` süreyi kırpıyor, ama
                // kırpmak elle girilen "0 dakika"yı sessizce 1 dakika yapardı;
                // reddetmek arayüze doğruyu söyleme şansı verir.
                if (!input.clientId || !isValidDuration(input.durationMinutes)) return null;

                const log = createTimeLog(input);

                set((state) => ({
                    timeLogs: [...state.timeLogs, log],
                    dirtyTimeLogIds: withDirty(state.dirtyTimeLogIds, log.id),
                }));

                return log;
            },

            updateTimeLog: (id, patch) => set((state) => {
                const existing = state.timeLogs.find((l) => l.id === id);
                if (!existing) return state;

                // Yama şemayı ihlal ediyorsa kayıt hiç değiştirilmez: geçersiz
                // satır push kuyruğuna girerse 23514/23502 alınır ve o turdaki
                // bütün senkron düşer.
                if (patch.clientId !== undefined && !patch.clientId) return state;
                if (
                    patch.durationMinutes !== undefined
                    && !isValidDuration(patch.durationMinutes)
                ) return state;

                // Müşteri değişince proje bağı düşer — `TaskForm`'daki kuralın
                // aynısı: `time_logs_project_id_client_id_user_id_fkey` üçlüsü
                // projenin müşterisiyle kaydın müşterisinin aynı olmasını
                // zorunlu tutuyor. Yeni proje aynı yamada açıkça veriliyorsa
                // ona dokunulmaz.
                const clientChanged =
                    patch.clientId !== undefined && patch.clientId !== existing.clientId;
                const projectId = patch.projectId !== undefined
                    ? patch.projectId
                    : (clientChanged ? null : existing.projectId);

                const now = new Date().toISOString();

                return {
                    timeLogs: state.timeLogs.map((l) =>
                        l.id === id ? { ...l, ...patch, projectId, updatedAt: now } : l
                    ),
                    dirtyTimeLogIds: withDirty(state.dirtyTimeLogIds, id),
                };
            }),

            deleteTimeLog: (id) => set((state) => {
                if (!state.timeLogs.some((l) => l.id === id)) return state;

                return {
                    timeLogs: state.timeLogs.filter((l) => l.id !== id),
                    dirtyTimeLogIds: state.dirtyTimeLogIds.filter((dirtyId) => dirtyId !== id),
                    timeLogTombstones: [
                        ...state.timeLogTombstones.filter((t) => t.id !== id),
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
                clients,
                projects,
                timeLogs,
                syncedIds,
                clearedTombstoneIds,
                syncedCategoryIds,
                clearedCategoryTombstoneIds,
                syncedClientIds = [],
                clearedClientTombstoneIds = [],
                syncedProjectIds = [],
                clearedProjectTombstoneIds = [],
                syncedTimeLogIds = [],
                clearedTimeLogTombstoneIds = [],
                syncedAt,
            }) => set((state) => {
                const synced = new Set(syncedIds);
                const cleared = new Set(clearedTombstoneIds);
                const syncedCategories = new Set(syncedCategoryIds);
                const clearedCategories = new Set(clearedCategoryTombstoneIds);
                const syncedClients = new Set(syncedClientIds);
                const clearedClients = new Set(clearedClientTombstoneIds);
                const syncedProjects = new Set(syncedProjectIds);
                const clearedProjects = new Set(clearedProjectTombstoneIds);
                const syncedTimeLogs = new Set(syncedTimeLogIds);
                const clearedTimeLogs = new Set(clearedTimeLogTombstoneIds);
                const cutoff = Date.now() - TOMBSTONE_TTL_MS;
                const alive = (t: Tombstone) => new Date(t.deletedAt).getTime() > cutoff;

                return {
                    tasks,
                    categories,
                    clients: clients ?? state.clients,
                    projects: projects ?? state.projects,
                    timeLogs: timeLogs ?? state.timeLogs,
                    dirtyIds: state.dirtyIds.filter((id) => !synced.has(id)),
                    tombstones: state.tombstones.filter((t) => !cleared.has(t.id) && alive(t)),
                    dirtyCategoryIds: state.dirtyCategoryIds.filter(
                        (id) => !syncedCategories.has(id)
                    ),
                    categoryTombstones: state.categoryTombstones.filter(
                        (t) => !clearedCategories.has(t.id) && alive(t)
                    ),
                    dirtyClientIds: state.dirtyClientIds.filter(
                        (id) => !syncedClients.has(id)
                    ),
                    clientTombstones: state.clientTombstones.filter(
                        (t) => !clearedClients.has(t.id) && alive(t)
                    ),
                    dirtyProjectIds: state.dirtyProjectIds.filter(
                        (id) => !syncedProjects.has(id)
                    ),
                    projectTombstones: state.projectTombstones.filter(
                        (t) => !clearedProjects.has(t.id) && alive(t)
                    ),
                    dirtyTimeLogIds: state.dirtyTimeLogIds.filter(
                        (id) => !syncedTimeLogs.has(id)
                    ),
                    timeLogTombstones: state.timeLogTombstones.filter(
                        (t) => !clearedTimeLogs.has(t.id) && alive(t)
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
                        dirtyClientIds: state.clients.map((c) => c.id),
                        dirtyProjectIds: state.projects.map((p) => p.id),
                        dirtyTimeLogIds: state.timeLogs.map((l) => l.id),
                    };
                }

                return {
                    ownerId: userId,
                    tasks: [],
                    categories: [],
                    clients: [],
                    projects: [],
                    timeLogs: [],
                    activeTimer: null,
                    dirtyIds: [],
                    tombstones: [],
                    dirtyCategoryIds: [],
                    categoryTombstones: [],
                    dirtyClientIds: [],
                    clientTombstones: [],
                    dirtyProjectIds: [],
                    projectTombstones: [],
                    dirtyTimeLogIds: [],
                    timeLogTombstones: [],
                    lastSyncedAt: null,
                };
            }),
        }),
        {
            name: 'yapilacaklar-storage',
            version: 6,
            partialize: (state) => ({
                tasks: state.tasks,
                categories: state.categories,
                clients: state.clients,
                projects: state.projects,
                timeLogs: state.timeLogs,
                // Sayfa yenilemesinden sağ çıkması gereken TEK alan (TIME-01):
                // çalışan sayaç kaydedilmezse yenilemede sessizce kaybolurdu.
                activeTimer: state.activeTimer,
                filter: state.filter,
                dirtyIds: state.dirtyIds,
                tombstones: state.tombstones,
                dirtyCategoryIds: state.dirtyCategoryIds,
                categoryTombstones: state.categoryTombstones,
                dirtyClientIds: state.dirtyClientIds,
                clientTombstones: state.clientTombstones,
                dirtyProjectIds: state.dirtyProjectIds,
                projectTombstones: state.projectTombstones,
                dirtyTimeLogIds: state.dirtyTimeLogIds,
                timeLogTombstones: state.timeLogTombstones,
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
             * v4 -> v5: niş modül — clients/projects alanları ve görevlerdeki
             *           clientId/projectId eklendi. Eski kayıtlarda bu alanlar
             *           hiç yoktu; boş listeye ve null bağlara düşülür.
             * v5 -> v6: niş modül 2. dilim — zaman kaydı. timeLogs/activeTimer
             *           ve ücret sütunları (clients.hourlyRate/currency,
             *           projects.hourlyRate) eklendi. Eski kayıtlarda bu
             *           alanlar hiç yoktu; boş listeye/null'a ve veritabanı
             *           varsayılanlarına düşülür.
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

                if (version < 5) {
                    state.tasks = state.tasks.map((task) => {
                        const t = task as Task & { clientId?: unknown; projectId?: unknown };
                        return {
                            ...t,
                            clientId: typeof t.clientId === 'string' ? t.clientId : null,
                            projectId: typeof t.projectId === 'string' ? t.projectId : null,
                        };
                    });
                    state.clients = [];
                    state.projects = [];
                    state.dirtyClientIds = [];
                    state.clientTombstones = [];
                    state.dirtyProjectIds = [];
                    state.projectTombstones = [];
                }

                if (version < 6) {
                    // Zaman kaydı geldi. Eski kayıtta bu alanlar hiç yoktu;
                    // boş listelere düşülür. Ücret alanları da yeni:
                    // veritabanı varsayılanlarıyla aynı.
                    state.timeLogs = [];
                    state.activeTimer = null;
                    state.dirtyTimeLogIds = [];
                    state.timeLogTombstones = [];
                    state.clients = (state.clients ?? []).map((c) => ({
                        ...c,
                        hourlyRate: typeof c.hourlyRate === 'number' ? c.hourlyRate : 0,
                        currency: typeof c.currency === 'string' ? c.currency : 'TRY',
                    }));
                    state.projects = (state.projects ?? []).map((p) => ({
                        ...p,
                        hourlyRate: typeof p.hourlyRate === 'number' ? p.hourlyRate : null,
                    }));
                }

                return state as TaskState;
            },
        }
    )
);
