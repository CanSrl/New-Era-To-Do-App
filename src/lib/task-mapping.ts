import type { Database } from './database.types';
import type { Priority, Task } from './types';
import { normalizeTask } from './tasks';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];

type DbPriority = Database['public']['Enums']['task_priority'];

/**
 * Arayüzdeki Türkçe etiketler ile veritabanındaki sabit anahtarlar arasındaki
 * eşleme. Etiket metni değişirse yalnızca bu tablo güncellenir; veri taşımak
 * gerekmez.
 *
 * Kategoriler artık burada değil: sabit enum yerine kullanıcıya ait satırlar
 * oldular, `category_id` iki tarafta da aynı uuid.
 */
const PRIORITY_TO_DB: Record<Priority, DbPriority> = {
    'Düşük': 'low',
    'Orta': 'medium',
    'Yüksek': 'high',
};

const PRIORITY_FROM_DB: Record<DbPriority, Priority> = {
    low: 'Düşük',
    medium: 'Orta',
    high: 'Yüksek',
};

/** Yerel görevi veritabanına yazılacak satıra çevirir. */
export function taskToRow(task: Task, userId: string): TaskInsert {
    return {
        id: task.id,
        user_id: userId,
        title: task.title,
        description: task.description ?? null,
        due_date: task.dueDate ?? null,
        priority: PRIORITY_TO_DB[task.priority],
        category_id: task.categoryId,
        completed: task.completed,
        position: task.position,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
    };
}

/**
 * Veritabanı satırını yerel göreve çevirir.
 *
 * Satır normalizeTask'ten geçirilir: veritabanı şema olarak güvenilir olsa da
 * enum eşlemesi dışarıdan gelen bir değerle karşılaşırsa uygulama çökmemeli.
 */
export function rowToTask(row: TaskRow): Task {
    const normalized = normalizeTask(
        {
            id: row.id,
            title: row.title,
            description: row.description ?? undefined,
            dueDate: row.due_date ?? undefined,
            priority: PRIORITY_FROM_DB[row.priority],
            categoryId: row.category_id,
            completed: row.completed,
            createdAt: row.created_at,
            position: row.position,
        },
        row.position
    );

    // normalizeTask yalnızca başlık boşsa null döner; veritabanı kısıtı bunu
    // zaten engelliyor, yine de tip güvenliği için yedek üretilir.
    if (!normalized) {
        return {
            id: row.id,
            title: row.title || 'Adsız görev',
            priority: 'Orta',
            completed: row.completed,
            categoryId: row.category_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            position: row.position,
        };
    }

    return { ...normalized, updatedAt: row.updated_at };
}
