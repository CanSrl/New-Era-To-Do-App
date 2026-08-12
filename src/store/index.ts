import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, FilterStatus } from '../lib/types';

interface TaskState {
    tasks: Task[];
    searchQuery: string;
    filter: FilterStatus;

    addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    toggleComplete: (id: string) => void;
    reorderTasks: (tasks: Task[]) => void;
    clearCompleted: () => void;

    setSearchQuery: (query: string) => void;
    setFilter: (filter: FilterStatus) => void;
    importTasks: (tasks: Task[]) => void;
}

export const useTaskStore = create<TaskState>()(
    persist(
        (set) => ({
            tasks: [],
            searchQuery: '',
            filter: 'Tüm Görevler',

            addTask: (taskData) => set((state) => ({
                tasks: [
                    ...state.tasks,
                    {
                        ...taskData,
                        id: crypto.randomUUID(),
                        createdAt: new Date(),
                    }
                ]
            })),

            updateTask: (id, updates) => set((state) => ({
                tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
            })),

            deleteTask: (id) => set((state) => ({
                tasks: state.tasks.filter((t) => t.id !== id)
            })),

            toggleComplete: (id) => set((state) => ({
                tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
            })),

            reorderTasks: (newTasks) => set({ tasks: newTasks }),

            clearCompleted: () => set((state) => ({
                tasks: state.tasks.filter((t) => !t.completed)
            })),

            setSearchQuery: (query) => set({ searchQuery: query }),

            setFilter: (filter) => set({ filter }),

            importTasks: (imported) => set((state) => {
                // Simple merge for imported tasks, avoiding duplicates by id
                const existingIds = new Set(state.tasks.map(t => t.id));
                const newTasks = imported.filter(t => !existingIds.has(t.id));
                return { tasks: [...state.tasks, ...newTasks] };
            })
        }),
        {
            name: 'yapilacaklar-storage',
            // Since Dates are converted to ISO strings in JSON, we need to map them back
            // @ts-expect-error zustand's persist typings don't model a custom deserialize override
            deserialize: (str: string) => {
                const parsed = JSON.parse(str);
                if (parsed.state && parsed.state.tasks) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    parsed.state.tasks = parsed.state.tasks.map((task: any) => ({
                        ...task,
                        createdAt: new Date(task.createdAt),
                        dueDate: task.dueDate ? new Date(task.dueDate) : undefined
                    }));
                }
                return parsed;
            }
        }
    )
);
