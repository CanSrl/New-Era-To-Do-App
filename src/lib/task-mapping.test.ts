import { describe, it, expect } from 'vitest';
import { rowToTask, taskToRow } from './task-mapping';
import type { Task } from './types';
import type { Database } from './database.types';

type TaskRow = Database['public']['Tables']['tasks']['Row'];

const task: Task = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Rapor yaz',
    description: 'Yıllık özet',
    dueDate: '2026-08-15',
    priority: 'Yüksek',
    completed: false,
    category: 'İş',
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-01-06T09:00:00.000Z',
    position: 3,
};

const row: TaskRow = {
    id: task.id,
    user_id: '22222222-2222-4222-8222-222222222222',
    title: 'Rapor yaz',
    description: 'Yıllık özet',
    due_date: '2026-08-15',
    priority: 'high',
    category: 'work',
    completed: false,
    completed_at: null,
    position: 3,
    created_at: '2026-01-05T08:00:00.000Z',
    updated_at: '2026-01-06T09:00:00.000Z',
};

describe('taskToRow', () => {
    it('Türkçe etiketleri veritabanı anahtarlarına çevirir', () => {
        const result = taskToRow(task, '22222222-2222-4222-8222-222222222222');

        expect(result.priority).toBe('high');
        expect(result.category).toBe('work');
        expect(result.due_date).toBe('2026-08-15');
        expect(result.user_id).toBe('22222222-2222-4222-8222-222222222222');
        expect(result.updated_at).toBe('2026-01-06T09:00:00.000Z');
    });

    it('tanımsız alanları null yazar', () => {
        const result = taskToRow({ ...task, description: undefined, dueDate: undefined }, 'u1');

        expect(result.description).toBeNull();
        expect(result.due_date).toBeNull();
    });

    it('tüm öncelik ve kategori değerlerini eşler', () => {
        const priorities = (['Düşük', 'Orta', 'Yüksek'] as const).map(
            p => taskToRow({ ...task, priority: p }, 'u1').priority
        );
        expect(priorities).toEqual(['low', 'medium', 'high']);

        const categories = (['İş', 'Kişisel', 'Alışveriş', 'Okul'] as const).map(
            c => taskToRow({ ...task, category: c }, 'u1').category
        );
        expect(categories).toEqual(['work', 'personal', 'shopping', 'school']);
    });
});

describe('rowToTask', () => {
    it('veritabanı anahtarlarını Türkçe etiketlere çevirir', () => {
        expect(rowToTask(row)).toEqual(task);
    });

    it('null alanları undefined yapar', () => {
        const result = rowToTask({ ...row, description: null, due_date: null });

        expect(result.description).toBeUndefined();
        expect(result.dueDate).toBeUndefined();
    });

    it('tüm veritabanı enum değerlerini eşler', () => {
        const priorities = (['low', 'medium', 'high'] as const).map(
            p => rowToTask({ ...row, priority: p }).priority
        );
        expect(priorities).toEqual(['Düşük', 'Orta', 'Yüksek']);

        const categories = (['work', 'personal', 'shopping', 'school'] as const).map(
            c => rowToTask({ ...row, category: c }).category
        );
        expect(categories).toEqual(['İş', 'Kişisel', 'Alışveriş', 'Okul']);
    });
});

describe('gidiş-dönüş', () => {
    it('görev -> satır -> görev dönüşümü veriyi korur', () => {
        const roundTripped = rowToTask({
            ...taskToRow(task, 'u1'),
            user_id: 'u1',
            completed_at: null,
        } as TaskRow);

        expect(roundTripped).toEqual(task);
    });

    it('tamamlanmış ve tarihsiz görevde de korunur', () => {
        const completed: Task = {
            ...task,
            completed: true,
            dueDate: undefined,
            description: undefined,
            priority: 'Düşük',
            category: 'Okul',
        };

        const roundTripped = rowToTask({
            ...taskToRow(completed, 'u1'),
            user_id: 'u1',
            completed_at: '2026-01-06T09:00:00.000Z',
        } as TaskRow);

        expect(roundTripped).toEqual(completed);
    });
});
