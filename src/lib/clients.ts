import type { Client } from './types';
import { createId, toIsoTimestamp } from './tasks';
import { categoryKey } from './categories';

/**
 * Veritabanı kısıtıyla aynı. Kategorilerdeki 40'tan uzun: şirket ve ajans
 * adları daha uzun olabiliyor.
 */
export const CLIENT_NAME_MAX = 80;

/**
 * Dışarıdan gelen (LocalStorage, veritabanı) ham veriyi geçerli bir Client'a
 * çevirir. Adı olmayan kayıtlar reddedilir.
 */
export function normalizeClient(raw: unknown, fallbackPosition: number): Client | null {
    if (!raw || typeof raw !== 'object') return null;

    const source = raw as Record<string, unknown>;
    const name = typeof source.name === 'string' ? source.name.trim() : '';
    if (!name) return null;

    const createdAt = toIsoTimestamp(source.createdAt);

    const hourlyRate = typeof source.hourlyRate === 'number' && Number.isFinite(source.hourlyRate)
        ? source.hourlyRate
        : 0;
    const currency = typeof source.currency === 'string' && source.currency
        ? source.currency
        : 'TRY';

    return {
        id: typeof source.id === 'string' && source.id ? source.id : createId(),
        name: name.slice(0, CLIENT_NAME_MAX),
        archived: source.archived === true,
        position: typeof source.position === 'number' && Number.isFinite(source.position)
            ? source.position
            : fallbackPosition,
        hourlyRate,
        currency,
        createdAt,
        // Eski kayıtlarda updatedAt yok; oluşturma zamanına düşülür.
        updatedAt: source.updatedAt == null ? createdAt : toIsoTimestamp(source.updatedAt),
    };
}

/** Yeni bir müşteri kaydı üretir. */
export function createClient(
    name: string,
    position: number,
    now: string = new Date().toISOString()
): Client {
    return {
        id: createId(),
        name: name.trim().slice(0, CLIENT_NAME_MAX),
        archived: false,
        position,
        // Veritabanı varsayılanlarıyla aynı; ücret sonradan ayarlar sayfasından girilir.
        hourlyRate: 0,
        currency: 'TRY',
        createdAt: now,
        updatedAt: now,
    };
}

/** Sıralama anahtarına göre karşılaştırır; eşitlikte oluşturma sırasına düşer. */
export function byClientPosition(
    a: { position: number; createdAt: string },
    b: { position: number; createdAt: string }
): number {
    if (a.position !== b.position) return a.position - b.position;
    return a.createdAt.localeCompare(b.createdAt);
}

/**
 * Ekran sırası: arşivlenmemişler önce, her grup kendi içinde `position`'a göre.
 *
 * Yapısal (structural) bir tip alır — `Client`'ın kendisi değil: `Project`
 * artık `Client`'ı genişletmiyor (`hourlyRate` daraltması yüzünden), ama bu
 * karşılaştırıcı ikisi için de geçerli kalmalı. Arşivleme silme değildir —
 * kayıt listenin dibine iner ama kaybolmaz, böylece geçmiş görevlerin bağı
 * okunabilir kalır.
 */
export function byArchivedThenPosition(
    a: { archived: boolean; position: number; createdAt: string },
    b: { archived: boolean; position: number; createdAt: string }
): number {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return byClientPosition(a, b);
}

/** Müşterileri ekran sırasına dizer. Girdi dizisi değiştirilmez. */
export function clientsForDisplay(clients: readonly Client[]): Client[] {
    return [...clients].sort(byArchivedThenPosition);
}

/** Bir sonraki müşterinin alacağı sıralama anahtarı (listenin sonu). */
export function nextClientPosition(clients: readonly Client[]): number {
    if (clients.length === 0) return 0;
    return Math.max(...clients.map((c) => c.position)) + 1;
}

/**
 * Verilen ad başka bir müşteride kullanılıyor mu?
 *
 * Veritabanında benzersizlik kısıtı bilinçli olarak yok (bkz. migration);
 * tekrarı arayüz engelliyor. Karşılaştırma `categoryKey` ile yapılır:
 * Türkçe'de `toLowerCase()` I/İ çiftini yanlış çevirdiği için yerel duyarlı
 * biçim gerekiyor.
 */
export function isClientNameTaken(
    clients: readonly Client[],
    name: string,
    exceptId?: string
): boolean {
    const key = categoryKey(name);
    return clients.some((c) => c.id !== exceptId && categoryKey(c.name) === key);
}
