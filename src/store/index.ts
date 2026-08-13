import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, FilterStatus } from '../lib/types';
import { createId, nextPosition, normalizeTask } from '../lib/tasks';

/** Silinen görevin izi; silmenin diğer cihazlara yayılabilmesi için tutulur. */
export interface Tombstone {
    id: string;
    deletedAt: string;
}

/** Mezar taşları bu süreden eski ise atılır (senkronlanmamış olsalar bile). */
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface TaskState {
    tasks: Task[];
    searchQuery: string;
    filter: FilterStatus;

    /** Buluta itilmeyi bekleyen görev id'leri. */
    dirtyIds: string[];
    /** Buluttan silinmeyi bekleyen görevler. */
    tombstones: Tombstone[];
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

    setSearchQuery: (query: string) => void;
    setFilter: (filter: FilterStatus) => void;
    importTasks: (tasks: unknown[]) => number;

    /** Senkron motorunun kullandığı düşük seviyeli işlemler. */
    applySyncResult: (result: {
        tasks: Task[];
        syncedIds: string[];
        clearedTombstoneIds: string[];
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
            searchQuery: '',
            filter: 'Tüm Görevler',
            dirtyIds: [],
            tombstones: [],
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

            setSearchQuery: (query) => set({ searchQuery: query }),

            setFilter: (filter) => set({ filter }),

            /**
             * Dosyadan gelen görevleri ekler; id'si zaten var olanları atlar.
             * Eklenen görev sayısını döner.
             */
            importTasks: (imported) => {
                const existing = get().tasks;
                const existingIds = new Set(existing.map((t) => t.id));

                const incoming: Task[] = [];
                let position = nextPosition(existing);

                for (const raw of imported) {
                    const task = normalizeTask(raw, position);
                    if (!task || existingIds.has(task.id)) continue;
                    existingIds.add(task.id);
                    // İçe aktarılan görevler mevcut listenin sonuna eklenir;
                    // dosyadaki position değerleri mevcut sırayla çakışabilir.
                    incoming.push({ ...task, position });
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
            applySyncResult: ({ tasks, syncedIds, clearedTombstoneIds, syncedAt }) => set((state) => {
                const synced = new Set(syncedIds);
                const cleared = new Set(clearedTombstoneIds);
                const cutoff = Date.now() - TOMBSTONE_TTL_MS;

                return {
                    tasks,
                    dirtyIds: state.dirtyIds.filter((id) => !synced.has(id)),
                    tombstones: state.tombstones.filter(
                        (t) => !cleared.has(t.id) && new Date(t.deletedAt).getTime() > cutoff
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
             */
            prepareForSync: (userId) => set((state) => {
                if (state.ownerId === userId) return state;

                if (state.ownerId === null) {
                    return { ownerId: userId, dirtyIds: state.tasks.map((t) => t.id) };
                }

                return {
                    ownerId: userId,
                    tasks: [],
                    dirtyIds: [],
                    tombstones: [],
                    lastSyncedAt: null,
                };
            }),
        }),
        {
            name: 'yapilacaklar-storage',
            version: 2,
            partialize: (state) => ({
                tasks: state.tasks,
                filter: state.filter,
                dirtyIds: state.dirtyIds,
                tombstones: state.tombstones,
                lastSyncedAt: state.lastSyncedAt,
                ownerId: state.ownerId,
            }) as unknown as TaskState,
            /**
             * v0 -> v1: tarihler Date varsayılıyordu ama JSON'a string yazılıp
             *           geri çevrilmiyordu; position alanı yoktu.
             * v1 -> v2: senkronizasyon meta verisi (updatedAt, dirtyIds,
             *           tombstones) eklendi. Mevcut görevlerin tamamı dirty
             *           kabul edilir ki ilk girişte hesaba aktarılsınlar.
             */
            migrate: (persisted, version) => {
                const state = persisted as Partial<TaskState> | undefined;
                if (!state || !Array.isArray(state.tasks)) return state as TaskState;

                if (version === 0) {
                    state.tasks = state.tasks
                        .map((task, index) => normalizeTask(task, index))
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

                return state as TaskState;
            },
        }
    )
);
