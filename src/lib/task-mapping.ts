import type { Database } from './database.types';
import type { Task } from './types';
import { normalizeTask } from './tasks';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];

/**
 * Bu katman artık yalnızca alan adlarını çeviriyor (camelCase <-> snake_case).
 *
 * Eskiden burada bir de öncelik eşlemesi vardı: istemci Türkçe etiket
 * ('Yüksek'), veritabanı sabit anahtar ('high') tutuyordu. i18n ile istemci
 * tarafı da anahtara geçince eşleme gereksiz kaldı. Kategoriler ise sabit
 * enum olmaktan çıkıp kullanıcıya ait satırlara dönüştü; `category_id` iki
 * tarafta da aynı uuid.
 */

/** Yerel görevi veritabanına yazılacak satıra çevirir. */
export function taskToRow(task: Task, userId: string): TaskInsert {
    return {
        id: task.id,
        user_id: userId,
        title: task.title,
        description: task.description ?? null,
        due_date: task.dueDate ?? null,
        priority: task.priority,
        category_id: task.categoryId,
        client_id: task.clientId,
        project_id: task.projectId,
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
 * beklenmeyen bir değerle karşılaşıldığında uygulama çökmemeli.
 */
export function rowToTask(row: TaskRow): Task {
    const normalized = normalizeTask(
        {
            id: row.id,
            title: row.title,
            description: row.description ?? undefined,
            dueDate: row.due_date ?? undefined,
            priority: row.priority,
            categoryId: row.category_id,
            clientId: row.client_id,
            projectId: row.project_id,
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
            title: row.title || row.id,
            priority: row.priority,
            completed: row.completed,
            categoryId: row.category_id,
            // Değişmez burada da korunur: müşterisi olmayan görev projeye
            // bağlı kalamaz (şemadaki tasks_project_requires_client).
            clientId: row.client_id,
            projectId: row.client_id ? row.project_id : null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            position: row.position,
        };
    }

    return { ...normalized, updatedAt: row.updated_at };
}
