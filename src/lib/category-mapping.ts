import type { Database } from './database.types';
import type { Category } from './types';
import { normalizeCategory } from './categories';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];

/** Yerel kategoriyi veritabanına yazılacak satıra çevirir. */
export function categoryToRow(category: Category, userId: string): CategoryInsert {
    return {
        id: category.id,
        user_id: userId,
        name: category.name,
        color: category.color,
        position: category.position,
        created_at: category.createdAt,
        updated_at: category.updatedAt,
    };
}

/**
 * Veritabanı satırını yerel kategoriye çevirir.
 *
 * Satır normalizeCategory'den geçirilir: veritabanı kısıtları güvenilir olsa
 * da tek bir bozuk satır listeyi çökertmemeli.
 */
export function rowToCategory(row: CategoryRow): Category {
    const normalized = normalizeCategory(
        {
            id: row.id,
            name: row.name,
            color: row.color,
            position: row.position,
            createdAt: row.created_at,
        },
        row.position
    );

    // normalizeCategory yalnızca ad boşsa null döner; veritabanı kısıtı bunu
    // zaten engelliyor, yine de tip güvenliği için yedek üretilir.
    if (!normalized) {
        return {
            id: row.id,
            name: row.name || 'Adsız kategori',
            color: row.color,
            position: row.position,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    return { ...normalized, updatedAt: row.updated_at };
}
