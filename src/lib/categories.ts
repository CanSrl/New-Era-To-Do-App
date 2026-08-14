import type { Category } from './types';
import { createId, toIsoTimestamp } from './tasks';
// i18n buradan içe aktarılıyor ki modül sırası kendiliğinden doğru olsun:
// store, başlangıç durumunda seedCategories() çağırıyor ve bu, modül gövdesi
// çalışırken gerçekleşiyor. Bu import olmasa i18n henüz kurulmamış olabilir
// ve tohumlar ad yerine çeviri anahtarı taşırdı.
import i18n from '../i18n';

/** Veritabanı kısıtıyla aynı: '#rrggbb', küçük harf. */
const HEX_COLOR = /^#[0-9a-f]{6}$/;

export const CATEGORY_NAME_MAX = 40;

/** Kategori oluşturma ekranında sunulan renkler. */
export const CATEGORY_COLORS: readonly string[] = [
    '#3b82f6', // mavi
    '#8b5cf6', // mor
    '#10b981', // yeşil
    '#f59e0b', // amber
    '#ef4444', // kırmızı
    '#ec4899', // pembe
    '#14b8a6', // turkuaz
    '#64748b', // gri
];

export const DEFAULT_CATEGORY_COLOR = '#6366f1';

/**
 * Yeni bir cihazda oluşturulan başlangıç kategorileri.
 *
 * `legacyName`, kategoriler tabloya taşınmadan önceki enum'ın Türkçe
 * karşılığıdır ve LocalStorage v2 -> v3 göçünde eski görevleri bağlamak için
 * kullanılır. Göç bilinçli olarak çevrilmiş ada değil bu sabit ada bakar:
 * o dönemki bütün veri Türkçeydi, arayüz o an hangi dilde olursa olsun.
 *
 * ⚠️ Tohum adları arayüz diline göre çevrilir. Aynı hesabın iki cihazı farklı
 * dillerde ilk kez tohumlanırsa ("İş" ve "Work") ada göre tekilleştirme
 * tutmaz ve kullanıcı iki kategori seti görür. Dar bir senaryo — iki taze
 * kurulumun aynı hesaba farklı dillerde bağlanması — ve kullanıcı fazlalıkları
 * silebilir. Veritabanı migration'ı da Türkçe adları yazar.
 */
export const DEFAULT_CATEGORIES: readonly {
    key: 'work' | 'personal' | 'shopping' | 'school';
    legacyName: string;
    color: string;
}[] = [
    { key: 'work', legacyName: 'İş', color: '#3b82f6' },
    { key: 'personal', legacyName: 'Kişisel', color: '#8b5cf6' },
    { key: 'shopping', legacyName: 'Alışveriş', color: '#10b981' },
    { key: 'school', legacyName: 'Okul', color: '#f59e0b' },
];

/**
 * Ad karşılaştırma anahtarı.
 *
 * Aynı kategorinin iki cihazda ayrı ayrı oluşturulmuş kopyalarını eşlemek
 * için kullanılır; "İş", "iş" ve " İŞ " aynı kategoridir. Türkçe'de
 * `toLowerCase()` I/İ çiftini yanlış çevirdiği için yerel duyarlı biçim
 * kullanılır.
 */
export function categoryKey(name: string): string {
    return name.trim().toLocaleLowerCase('tr').replace(/\s+/g, ' ');
}

/** Renk geçerli mi? Geçersizse veritabanı kısıtı yazmayı reddeder. */
export function isValidColor(value: unknown): value is string {
    return typeof value === 'string' && HEX_COLOR.test(value);
}

/**
 * Dışarıdan gelen (LocalStorage, içe aktarma, veritabanı) ham veriyi geçerli
 * bir Category'ye çevirir. Adı olmayan kayıtlar reddedilir.
 */
export function normalizeCategory(raw: unknown, fallbackPosition: number): Category | null {
    if (!raw || typeof raw !== 'object') return null;

    const source = raw as Record<string, unknown>;
    const name = typeof source.name === 'string' ? source.name.trim() : '';
    if (!name) return null;

    const createdAt = toIsoTimestamp(source.createdAt);

    return {
        id: typeof source.id === 'string' && source.id ? source.id : createId(),
        name: name.slice(0, CATEGORY_NAME_MAX),
        color: isValidColor(source.color) ? source.color : DEFAULT_CATEGORY_COLOR,
        position: typeof source.position === 'number' && Number.isFinite(source.position)
            ? source.position
            : fallbackPosition,
        createdAt,
        updatedAt: source.updatedAt == null ? createdAt : toIsoTimestamp(source.updatedAt),
    };
}

/** Yeni bir kategori kaydı üretir. */
export function createCategory(
    name: string,
    color: string,
    position: number,
    now: string = new Date().toISOString()
): Category {
    return {
        id: createId(),
        name: name.trim().slice(0, CATEGORY_NAME_MAX),
        color: isValidColor(color) ? color : DEFAULT_CATEGORY_COLOR,
        position,
        createdAt: now,
        updatedAt: now,
    };
}

/** Cihaz ilk kez açıldığında oluşturulan başlangıç kategorileri. */
export function seedCategories(now: string = new Date().toISOString()): Category[] {
    return DEFAULT_CATEGORIES.map((seed, index) =>
        createCategory(i18n.t(`category.seed.${seed.key}`), seed.color, index, now)
    );
}

/** Sıralama anahtarına göre karşılaştırır; eşitlikte oluşturma sırasına düşer. */
export function byCategoryPosition(a: Category, b: Category): number {
    if (a.position !== b.position) return a.position - b.position;
    return a.createdAt.localeCompare(b.createdAt);
}

/** Bir sonraki kategorinin alacağı sıralama anahtarı (listenin sonu). */
export function nextCategoryPosition(categories: readonly Category[]): number {
    if (categories.length === 0) return 0;
    return Math.max(...categories.map((c) => c.position)) + 1;
}

/**
 * Verilen ad başka bir kategoride kullanılıyor mu?
 *
 * Veritabanında benzersizlik kısıtı bilinçli olarak yok (bkz. migration);
 * tekrarı arayüz engelliyor.
 */
export function isNameTaken(
    categories: readonly Category[],
    name: string,
    exceptId?: string
): boolean {
    const key = categoryKey(name);
    return categories.some((c) => c.id !== exceptId && categoryKey(c.name) === key);
}
