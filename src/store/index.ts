import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, FilterStatus } from '../lib/types';
import { createId, nextPosition, normalizeTask } from '../lib/tasks';

interface TaskState {
    tasks: Task[];
    searchQuery: string;
    filter: FilterStatus;

    addTask: (task: Omit<Task, 'id' | 'createdAt' | 'position'>) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    toggleComplete: (id: string) => void;
    reorderTasks: (tasks: Task[]) => void;
    clearCompleted: () => void;

    setSearchQuery: (query: string) => void;
    setFilter: (filter: FilterStatus) => void;
    importTasks: (tasks: unknown[]) => number;
}

export const useTaskStore = create<TaskState>()(
    persist(
        (set, get) => ({
            tasks: [],
            searchQuery: '',
            filter: 'Tüm Görevler',

            addTask: (taskData) => set((state) => ({
                tasks: [
                    ...state.tasks,
                    {
                        ...taskData,
                        id: createId(),
                        createdAt: new Date().toISOString(),
                        position: nextPosition(state.tasks),
                    },
                ],
            })),

            updateTask: (id, updates) => set((state) => ({
                tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
            })),

            deleteTask: (id) => set((state) => ({
                tasks: state.tasks.filter((t) => t.id !== id),
            })),

            toggleComplete: (id) => set((state) => ({
                tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
            })),

            // Sıralama anahtarları yeniden numaralandırılır; böylece sıra
            // dizinin sırasına değil, veriye yazılı hale gelir.
            reorderTasks: (newTasks) => set({
                tasks: newTasks.map((task, index) => ({ ...task, position: index })),
            }),

            clearCompleted: () => set((state) => ({
                tasks: state.tasks.filter((t) => !t.completed),
            })),

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
                    set({ tasks: [...existing, ...incoming] });
                }
                return incoming.length;
            },
        }),
        {
            name: 'yapilacaklar-storage',
            version: 1,
            /**
             * v0 -> v1: tarihler Date nesnesi varsayılıyordu ama JSON'a yazılınca
             * string'e dönüşüyordu ve geri çevrilmiyordu; ayrıca position alanı
             * yoktu. Kayıtlı veriyi yeni şemaya taşır.
             */
            migrate: (persisted, version) => {
                const state = persisted as Partial<TaskState> | undefined;
                if (!state || !Array.isArray(state.tasks)) return state as TaskState;

                if (version === 0) {
                    state.tasks = state.tasks
                        .map((task, index) => normalizeTask(task, index))
                        .filter((task): task is Task => task !== null);
                }

                return state as TaskState;
            },
        }
    )
);
