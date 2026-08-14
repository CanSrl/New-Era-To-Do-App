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
    priority: 'high',
    completed: false,
    categoryId: '33333333-3333-4333-8333-333333333333',
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
    category_id: '33333333-3333-4333-8333-333333333333',
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
        expect(result.category_id).toBe('33333333-3333-4333-8333-333333333333');
        expect(result.due_date).toBe('2026-08-15');
        expect(result.user_id).toBe('22222222-2222-4222-8222-222222222222');
        expect(result.updated_at).toBe('2026-01-06T09:00:00.000Z');
    });

    it('tanımsız alanları null yazar', () => {
        const result = taskToRow({ ...task, description: undefined, dueDate: undefined }, 'u1');

        expect(result.description).toBeNull();
        expect(result.due_date).toBeNull();
    });

    it('öncelik değerini olduğu gibi yazar', () => {
        // İstemci ve veritabanı aynı anahtarları kullanıyor; eşleme
        // katmanı değeri olduğu gibi taşımalı.
        const priorities = (['low', 'medium', 'high'] as const).map(
            p => taskToRow({ ...task, priority: p }, 'u1').priority
        );
        expect(priorities).toEqual(['low', 'medium', 'high']);
    });

    it('kategorisiz görevi null olarak yazar', () => {
        expect(taskToRow({ ...task, categoryId: null }, 'u1').category_id).toBeNull();
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

    it('öncelik değerini olduğu gibi taşır', () => {
        const priorities = (['low', 'medium', 'high'] as const).map(
            p => rowToTask({ ...row, priority: p }).priority
        );
        expect(priorities).toEqual(['low', 'medium', 'high']);
    });

    it('boş category_id alanını null olarak taşır', () => {
        expect(rowToTask({ ...row, category_id: null }).categoryId).toBeNull();
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
            priority: 'low',
            categoryId: null,
        };

        const roundTripped = rowToTask({
            ...taskToRow(completed, 'u1'),
            user_id: 'u1',
            completed_at: '2026-01-06T09:00:00.000Z',
        } as TaskRow);

        expect(roundTripped).toEqual(completed);
    });
});
