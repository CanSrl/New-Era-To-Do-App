import { CATEGORIES, PRIORITIES, type Category, type Priority, type Task } from './types';

/** 'YYYY-MM-DD' biçimini tanır. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Herhangi bir tarih değerini takvim tarihine ('YYYY-MM-DD') çevirir.
 *
 * Eski sürümlerde bitiş tarihi tam ISO zaman damgası olarak saklanıyordu
 * (`new Date('2026-08-15')` -> UTC gece yarısı). Bu değerlerin UTC tarih
 * kısmı, kullanıcının seçtiği günle birebir aynıdır; bu yüzden ilk 10
 * karakteri almak doğru sonucu verir.
 */
export function toCalendarDate(value: unknown): string | undefined {
    if (value == null || value === '') return undefined;

    if (typeof value === 'string') {
        if (CALENDAR_DATE.test(value)) return value;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
    }

    return undefined;
}

/** Herhangi bir değeri ISO 8601 zaman damgasına çevirir; çözemezse şimdiyi döner. */
export function toIsoTimestamp(value: unknown): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
    }
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return new Date().toISOString();
}

function createId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Eski tarayıcılar ve bazı test ortamları için yedek.
    return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Dışarıdan gelen (içe aktarma dosyası, eski LocalStorage kaydı) ham veriyi
 * geçerli bir Task'e çevirir. Başlığı olmayan kayıtlar reddedilir; tanınmayan
 * öncelik/kategori değerleri varsayılana düşer.
 *
 * Dış veriye asla güvenilmez: bozuk bir dosya uygulamayı çökertmemeli.
 */
export function normalizeTask(raw: unknown, fallbackPosition: number): Task | null {
    if (!raw || typeof raw !== 'object') return null;

    const source = raw as Record<string, unknown>;
    const title = typeof source.title === 'string' ? source.title.trim() : '';
    if (!title) return null;

    const priority = PRIORITIES.includes(source.priority as Priority)
        ? (source.priority as Priority)
        : 'Orta';

    const category = CATEGORIES.includes(source.category as Category)
        ? (source.category as Category)
        : 'Kişisel';

    const description = typeof source.description === 'string' && source.description.trim()
        ? source.description
        : undefined;

    const position = typeof source.position === 'number' && Number.isFinite(source.position)
        ? source.position
        : fallbackPosition;

    return {
        id: typeof source.id === 'string' && source.id ? source.id : createId(),
        title,
        description,
        dueDate: toCalendarDate(source.dueDate),
        priority,
        completed: source.completed === true,
        category,
        createdAt: toIsoTimestamp(source.createdAt),
        position,
    };
}

/**
 * Bugünün yerel takvim günü, 'YYYY-MM-DD'.
 *
 * toISOString() kullanılmaz: UTC'ye çevirip günü kaydırabilir.
 */
export function todayCalendarDate(now: Date = new Date()): string {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Görev gecikmiş mi? Bitiş tarihi bir gün olduğu için karşılaştırma da gün
 * bazındadır: bugüne ait bir görev gün bitene kadar gecikmiş sayılmaz.
 */
export function isOverdue(task: Task, today: string = todayCalendarDate()): boolean {
    return !task.completed && !!task.dueDate && task.dueDate < today;
}

/** Görev bugüne mi ait? */
export function isDueToday(task: Task, today: string = todayCalendarDate()): boolean {
    return !task.completed && task.dueDate === today;
}

/** Sıralama anahtarına göre karşılaştırır; eşitlikte eklenme sırasına düşer. */
export function byPosition(a: Task, b: Task): number {
    if (a.position !== b.position) return a.position - b.position;
    return a.createdAt.localeCompare(b.createdAt);
}

/** Bir sonraki görevin alacağı sıralama anahtarı (listenin sonu). */
export function nextPosition(tasks: readonly Task[]): number {
    if (tasks.length === 0) return 0;
    return Math.max(...tasks.map((t) => t.position)) + 1;
}

export { createId };
