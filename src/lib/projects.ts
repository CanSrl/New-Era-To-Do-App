import type { Project } from './types';
import { createId, toIsoTimestamp } from './tasks';
import { categoryKey } from './categories';
import { byArchivedThenPosition } from './clients';

/** Veritabanı kısıtıyla aynı. */
export const PROJECT_NAME_MAX = 80;

/**
 * Ham veriyi geçerli bir Project'e çevirir. Adı ya da müşterisi olmayan
 * kayıtlar reddedilir — müşterisiz proje şemada da imkânsız
 * (`projects.client_id not null`).
 */
export function normalizeProject(raw: unknown, fallbackPosition: number): Project | null {
    if (!raw || typeof raw !== 'object') return null;

    const source = raw as Record<string, unknown>;
    const name = typeof source.name === 'string' ? source.name.trim() : '';
    if (!name) return null;

    const clientId = typeof source.clientId === 'string' ? source.clientId : '';
    if (!clientId) return null;

    const createdAt = toIsoTimestamp(source.createdAt);

    // null = müşteriden miras al, 0 = proje ücretsiz — ikisi FARKLI, bu yüzden
    // `source.hourlyRate == null` değil `typeof ... !== 'number'` denetlenir.
    const hourlyRate = typeof source.hourlyRate === 'number' && Number.isFinite(source.hourlyRate)
        ? source.hourlyRate
        : null;
    const currency = typeof source.currency === 'string' && source.currency
        ? source.currency
        : 'TRY';

    return {
        id: typeof source.id === 'string' && source.id ? source.id : createId(),
        clientId,
        name: name.slice(0, PROJECT_NAME_MAX),
        archived: source.archived === true,
        position: typeof source.position === 'number' && Number.isFinite(source.position)
            ? source.position
            : fallbackPosition,
        hourlyRate,
        currency,
        createdAt,
        updatedAt: source.updatedAt == null ? createdAt : toIsoTimestamp(source.updatedAt),
    };
}

/** Yeni bir proje kaydı üretir. */
export function createProject(
    clientId: string,
    name: string,
    position: number,
    now: string = new Date().toISOString()
): Project {
    return {
        id: createId(),
        clientId,
        name: name.trim().slice(0, PROJECT_NAME_MAX),
        archived: false,
        position,
        // null: müşterinin ücretini miras alır (varsayılan davranış).
        hourlyRate: null,
        currency: 'TRY',
        createdAt: now,
        updatedAt: now,
    };
}

/** Sıralama anahtarına göre karşılaştırır; eşitlikte oluşturma sırasına düşer. */
export function byProjectPosition(a: Project, b: Project): number {
    if (a.position !== b.position) return a.position - b.position;
    return a.createdAt.localeCompare(b.createdAt);
}

/** Bir müşterinin bir sonraki projesinin alacağı sıralama anahtarı. */
export function nextProjectPosition(projects: readonly Project[], clientId: string): number {
    const own = projects.filter((p) => p.clientId === clientId);
    if (own.length === 0) return 0;
    return Math.max(...own.map((p) => p.position)) + 1;
}

/**
 * Verilen ad aynı müşterinin başka bir projesinde kullanılıyor mu?
 *
 * Kapsam bilinçli olarak müşteriye göredir: iki farklı müşterinin
 * "Websitesi" adlı projesi olması tamamen normaldir.
 */
export function isProjectNameTaken(
    projects: readonly Project[],
    clientId: string,
    name: string,
    exceptId?: string
): boolean {
    const key = categoryKey(name);
    return projects.some(
        (p) => p.clientId === clientId && p.id !== exceptId && categoryKey(p.name) === key
    );
}

/** Bir müşterinin projelerini sıralı döner. */
export function projectsByClient(
    projects: readonly Project[],
    clientId: string
): Project[] {
    return projects.filter((p) => p.clientId === clientId).sort(byProjectPosition);
}

/**
 * Bir müşterinin projelerini ekran sırasına dizer: arşivliler dibe iner.
 *
 * `projectsByClient`'tan ayrı durur, çünkü o saf sıralama anahtarına bakar ve
 * senkron/eşleme tarafında arşiv durumuna göre yer değiştirmemesi gerekir.
 */
export function projectsForDisplay(
    projects: readonly Project[],
    clientId: string
): Project[] {
    return projects
        .filter((p) => p.clientId === clientId)
        .sort(byArchivedThenPosition);
}
