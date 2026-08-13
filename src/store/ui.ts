import { create } from 'zustand';

/**
 * Kalıcı olmayan arayüz durumu.
 *
 * Görev store'undan ayrı tutulur: burası LocalStorage'a yazılmaz ve
 * senkronizasyonla ilgisi yoktur. Ayrıca kabuk (AppLayout) ile sayfa
 * arasında prop geçirmeden form açılabilmesini sağlar.
 */
interface UiState {
    isTaskFormOpen: boolean;
    /** Düzenlenen görevin id'si; yeni görev eklenirken null. */
    editingTaskId: string | null;

    openTaskForm: (taskId?: string) => void;
    closeTaskForm: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
    isTaskFormOpen: false,
    editingTaskId: null,

    openTaskForm: (taskId) => set({ isTaskFormOpen: true, editingTaskId: taskId ?? null }),
    closeTaskForm: () => set({ isTaskFormOpen: false, editingTaskId: null }),
}));
