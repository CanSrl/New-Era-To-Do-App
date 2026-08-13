import { describe, it, expect } from 'vitest';
import {
    byPosition,
    isDueToday,
    isOverdue,
    nextPosition,
    normalizeTask,
    toCalendarDate,
    toIsoTimestamp,
    todayCalendarDate,
} from './tasks';
import type { Task } from './types';

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 'id-1',
        title: 'Görev',
        priority: 'Orta',
        completed: false,
        category: 'Kişisel',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        position: 0,
        ...overrides,
    };
}

describe('toCalendarDate', () => {
    it("'YYYY-MM-DD' değerini olduğu gibi bırakır", () => {
        expect(toCalendarDate('2026-08-15')).toBe('2026-08-15');
    });

    it('eski tam ISO zaman damgasını takvim tarihine indirger', () => {
        // Eski sürümün ürettiği biçim: new Date('2026-08-15') -> UTC gece yarısı
        expect(toCalendarDate('2026-08-15T00:00:00.000Z')).toBe('2026-08-15');
    });

    it('Date nesnesini kabul eder', () => {
        expect(toCalendarDate(new Date('2026-08-15T00:00:00.000Z'))).toBe('2026-08-15');
    });

    it('boş ve geçersiz değerler için undefined döner', () => {
        expect(toCalendarDate(undefined)).toBeUndefined();
        expect(toCalendarDate(null)).toBeUndefined();
        expect(toCalendarDate('')).toBeUndefined();
        expect(toCalendarDate('lorem')).toBeUndefined();
        expect(toCalendarDate(new Date('geçersiz'))).toBeUndefined();
        expect(toCalendarDate(42)).toBeUndefined();
    });
});

describe('toIsoTimestamp', () => {
    it('ISO string ve Date değerlerini korur', () => {
        expect(toIsoTimestamp('2026-08-15T10:30:00.000Z')).toBe('2026-08-15T10:30:00.000Z');
        expect(toIsoTimestamp(new Date('2026-08-15T10:30:00.000Z'))).toBe('2026-08-15T10:30:00.000Z');
    });

    it('çözülemeyen değer için geçerli bir zaman damgası üretir', () => {
        const result = toIsoTimestamp('lorem');
        expect(Number.isNaN(new Date(result).getTime())).toBe(false);
    });
});

describe('normalizeTask', () => {
    it('eski biçimdeki kaydı yeni şemaya taşır', () => {
        const task = normalizeTask(
            {
                id: 'eski-1',
                title: 'Eski görev',
                priority: 'Yüksek',
                category: 'İş',
                completed: true,
                createdAt: '2026-01-05T08:00:00.000Z',
                dueDate: '2026-08-15T00:00:00.000Z',
            },
            7
        );

        expect(task).toEqual({
            id: 'eski-1',
            title: 'Eski görev',
            description: undefined,
            dueDate: '2026-08-15',
            priority: 'Yüksek',
            completed: true,
            category: 'İş',
            createdAt: '2026-01-05T08:00:00.000Z',
            // Eski kayıtta updatedAt yok; oluşturma zamanına düşer.
            updatedAt: '2026-01-05T08:00:00.000Z',
            position: 7,
        });
    });

    it('updatedAt varsa korunur', () => {
        const task = normalizeTask(
            { title: 'X', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-02T00:00:00.000Z' },
            0
        );
        expect(task?.updatedAt).toBe('2026-02-02T00:00:00.000Z');
    });

    it('başlığı olmayan kaydı reddeder', () => {
        expect(normalizeTask({ title: '   ' }, 0)).toBeNull();
        expect(normalizeTask({}, 0)).toBeNull();
        expect(normalizeTask(null, 0)).toBeNull();
        expect(normalizeTask('lorem', 0)).toBeNull();
    });

    it('tanınmayan öncelik ve kategoriyi varsayılana düşürür', () => {
        const task = normalizeTask({ title: 'X', priority: 'Acil', category: 'Tümü' }, 0);
        expect(task?.priority).toBe('Orta');
        expect(task?.category).toBe('Kişisel');
    });

    it('id yoksa üretir', () => {
        const task = normalizeTask({ title: 'X' }, 0);
        expect(task?.id).toBeTruthy();
    });

    it('başlıktaki boşlukları kırpar', () => {
        expect(normalizeTask({ title: '  Görev  ' }, 0)?.title).toBe('Görev');
    });

    it('completed alanını katı biçimde boolean yapar', () => {
        expect(normalizeTask({ title: 'X', completed: 'evet' }, 0)?.completed).toBe(false);
        expect(normalizeTask({ title: 'X', completed: true }, 0)?.completed).toBe(true);
    });
});

describe('sıralama', () => {
    it('position değerine göre sıralar', () => {
        const tasks = [
            makeTask({ id: 'c', position: 2 }),
            makeTask({ id: 'a', position: 0 }),
            makeTask({ id: 'b', position: 1 }),
        ];
        expect([...tasks].sort(byPosition).map(t => t.id)).toEqual(['a', 'b', 'c']);
    });

    it('eşit position değerinde eklenme sırasına düşer', () => {
        const tasks = [
            makeTask({ id: 'yeni', position: 0, createdAt: '2026-02-01T00:00:00.000Z' }),
            makeTask({ id: 'eski', position: 0, createdAt: '2026-01-01T00:00:00.000Z' }),
        ];
        expect([...tasks].sort(byPosition).map(t => t.id)).toEqual(['eski', 'yeni']);
    });

    it('nextPosition listenin sonunu verir', () => {
        expect(nextPosition([])).toBe(0);
        expect(nextPosition([makeTask({ position: 0 }), makeTask({ position: 5 })])).toBe(6);
    });
});

describe('tarih durumu', () => {
    const today = '2026-08-15';

    it('dünkü tamamlanmamış görev gecikmiştir', () => {
        expect(isOverdue(makeTask({ dueDate: '2026-08-14' }), today)).toBe(true);
    });

    it('bugüne ait görev gün bitene kadar gecikmiş sayılmaz', () => {
        expect(isOverdue(makeTask({ dueDate: today }), today)).toBe(false);
    });

    it('tamamlanmış görev gecikmiş sayılmaz', () => {
        expect(isOverdue(makeTask({ dueDate: '2026-08-14', completed: true }), today)).toBe(false);
    });

    it('tarihsiz görev gecikmiş sayılmaz', () => {
        expect(isOverdue(makeTask(), today)).toBe(false);
    });

    it('isDueToday yalnızca bugüne ait tamamlanmamış görevi sayar', () => {
        expect(isDueToday(makeTask({ dueDate: today }), today)).toBe(true);
        expect(isDueToday(makeTask({ dueDate: today, completed: true }), today)).toBe(false);
        expect(isDueToday(makeTask({ dueDate: '2026-08-16' }), today)).toBe(false);
    });

    it('todayCalendarDate yerel günü verir, UTC kaymasına uğramaz', () => {
        // Yerel saatle 15 Ağustos 01:00 — UTC'ye çevrilirse 14 Ağustos'a düşebilir.
        const localEarlyMorning = new Date(2026, 7, 15, 1, 0, 0);
        expect(todayCalendarDate(localEarlyMorning)).toBe('2026-08-15');
    });
});
