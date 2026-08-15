import type { Database } from './database.types';
import type { Client, Project } from './types';
import { normalizeClient } from './clients';
import { normalizeProject } from './projects';

/**
 * Niş modülün eşleme katmanı (camelCase <-> snake_case).
 *
 * Müşteri ve proje bilinçli olarak tek dosyada duruyor: starter kit alıcısı
 * niş modülü çıkarırken silmesi gereken dosya sayısı az olsun diye. Aynı
 * gerekçeyle şema da tek bir migration dosyasında.
 */

type ClientRow = Database['public']['Tables']['clients']['Row'];
export type ClientInsert = Database['public']['Tables']['clients']['Insert'];

type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];

/** Yerel müşteriyi veritabanına yazılacak satıra çevirir. */
export function clientToRow(client: Client, userId: string): ClientInsert {
    return {
        id: client.id,
        user_id: userId,
        name: client.name,
        archived: client.archived,
        position: client.position,
        created_at: client.createdAt,
        updated_at: client.updatedAt,
    };
}

/**
 * Veritabanı satırını yerel müşteriye çevirir.
 *
 * Satır normalizeClient'ten geçirilir: veritabanı kısıtları güvenilir olsa da
 * tek bir bozuk satır listeyi çökertmemeli.
 */
export function rowToClient(row: ClientRow): Client {
    const normalized = normalizeClient(
        {
            id: row.id,
            name: row.name,
            archived: row.archived,
            position: row.position,
            createdAt: row.created_at,
        },
        row.position
    );

    if (!normalized) {
        return {
            id: row.id,
            name: row.name || 'Adsız müşteri',
            archived: row.archived,
            position: row.position,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    // Sunucu damgası normalize edilmiş değerin yerine geçer: tetikleyici
    // updated_at'i kendi saatiyle yazar ve çakışma çözümü buna bakar.
    return { ...normalized, updatedAt: row.updated_at };
}

/** Yerel projeyi veritabanına yazılacak satıra çevirir. */
export function projectToRow(project: Project, userId: string): ProjectInsert {
    return {
        id: project.id,
        user_id: userId,
        client_id: project.clientId,
        name: project.name,
        archived: project.archived,
        position: project.position,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
    };
}

/** Veritabanı satırını yerel projeye çevirir. */
export function rowToProject(row: ProjectRow): Project {
    const normalized = normalizeProject(
        {
            id: row.id,
            clientId: row.client_id,
            name: row.name,
            archived: row.archived,
            position: row.position,
            createdAt: row.created_at,
        },
        row.position
    );

    // Yedek üretilirken client_id mutlaka korunur: müşterisiz proje şemada
    // imkânsız (`projects.client_id not null`) ve bağı düşen bir kayıt bir
    // sonraki push'ta reddedilirdi.
    if (!normalized) {
        return {
            id: row.id,
            clientId: row.client_id,
            name: row.name || 'Adsız proje',
            archived: row.archived,
            position: row.position,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    return { ...normalized, updatedAt: row.updated_at };
}
