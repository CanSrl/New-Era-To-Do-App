export type Priority = 'Düşük' | 'Orta' | 'Yüksek';

export type Category = 'İş' | 'Kişisel' | 'Alışveriş' | 'Okul' | 'Tümü';

export interface Task {
    id: string;
    title: string;
    description?: string;
    dueDate?: Date;
    priority: Priority;
    completed: boolean;
    category: Category;
    createdAt: Date;
}

export type FilterStatus = 'Tüm Görevler' | 'Aktif' | 'Tamamlandı';
