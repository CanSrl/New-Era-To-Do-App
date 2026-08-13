import { describe, it, expect } from 'vitest';
import { mergeTasks } from './sync-merge';
import type { Task } from './types';

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
    return {
        id,
        title: `Görev ${id}`,
        priority: 'Orta',
        completed: false,
        category: 'Kişisel',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        position: 0,
        ...overrides,
    };
}

const ids = (tasks: readonly Task[]) => tasks.map(t => t.id).sort();

describe('yalnızca yerelde olan görev', () => {
    it('dirty ise buluta gönderilir ve cihazda kalır', () => {
        const local = [makeTask('a')];

        const plan = mergeTasks({ local, remote: [], dirtyIds: ['a'], tombstones: [] });

        expect(ids(plan.tasks)).toEqual(['a']);
        expect(ids(plan.toPush)).toEqual(['a']);
        expect(plan.toDelete).toEqual([]);
    });

    it('dirty değilse başka cihazda silinmiş demektir, cihazdan kaldırılır', () => {
        // Bu görev daha önce senkronlanmıştı (dirty değil) ama artık bulutta yok.
        const local = [makeTask('a')];

        const plan = mergeTasks({ local, remote: [], dirtyIds: [], tombstones: [] });

        expect(plan.tasks).toEqual([]);
        expect(plan.toPush).toEqual([]);
        expect(plan.toDelete).toEqual([]);
    });
});

describe('yalnızca uzakta olan görev', () => {
    it('cihaza indirilir', () => {
        const remote = [makeTask('b')];

        const plan = mergeTasks({ local: [], remote, dirtyIds: [], tombstones: [] });

        expect(ids(plan.tasks)).toEqual(['b']);
        expect(plan.toPush).toEqual([]);
    });

    it('mezar taşı varsa indirilmez ve bulutta silinir', () => {
        const remote = [makeTask('b')];

        const plan = mergeTasks({
            local: [],
            remote,
            dirtyIds: [],
            tombstones: [{ id: 'b', deletedAt: '2026-01-02T00:00:00.000Z' }],
        });

        expect(plan.tasks).toEqual([]);
        expect(plan.toDelete).toEqual(['b']);
    });
});

describe('iki tarafta da olan görev', () => {
    it('yerel daha yeni ve dirty ise yerel kazanır ve gönderilir', () => {
        const local = [makeTask('a', { title: 'Yerel sürüm', updatedAt: '2026-02-02T00:00:00.000Z' })];
        const remote = [makeTask('a', { title: 'Uzak sürüm', updatedAt: '2026-01-01T00:00:00.000Z' })];

        const plan = mergeTasks({ local, remote, dirtyIds: ['a'], tombstones: [] });

        expect(plan.tasks[0].title).toBe('Yerel sürüm');
        expect(ids(plan.toPush)).toEqual(['a']);
        expect(plan.discardedIds).toEqual([]);
    });

    it('uzak daha yeni ise uzak kazanır ve yerel değişiklik atılır', () => {
        const local = [makeTask('a', { title: 'Yerel sürüm', updatedAt: '2026-01-01T00:00:00.000Z' })];
        const remote = [makeTask('a', { title: 'Uzak sürüm', updatedAt: '2026-02-02T00:00:00.000Z' })];

        const plan = mergeTasks({ local, remote, dirtyIds: ['a'], tombstones: [] });

        expect(plan.tasks[0].title).toBe('Uzak sürüm');
        expect(plan.toPush).toEqual([]);
        // Kaybeden değişikliğin dirty bayrağı temizlenmeli, aksi halde her
        // turda yeniden denenip her seferinde kaybederdi.
        expect(plan.discardedIds).toEqual(['a']);
    });

    it('zaman damgaları eşitse uzak taraf kazanır (deterministik)', () => {
        const stamp = '2026-01-01T00:00:00.000Z';
        const local = [makeTask('a', { title: 'Yerel sürüm', updatedAt: stamp })];
        const remote = [makeTask('a', { title: 'Uzak sürüm', updatedAt: stamp })];

        const plan = mergeTasks({ local, remote, dirtyIds: ['a'], tombstones: [] });

        expect(plan.tasks[0].title).toBe('Uzak sürüm');
        expect(plan.discardedIds).toEqual(['a']);
    });

    it('yerel dirty değilse uzak sürüm alınır', () => {
        const local = [makeTask('a', { title: 'Eski yerel', updatedAt: '2026-01-01T00:00:00.000Z' })];
        const remote = [makeTask('a', { title: 'Uzak sürüm', updatedAt: '2026-02-02T00:00:00.000Z' })];

        const plan = mergeTasks({ local, remote, dirtyIds: [], tombstones: [] });

        expect(plan.tasks[0].title).toBe('Uzak sürüm');
        expect(plan.toPush).toEqual([]);
        expect(plan.discardedIds).toEqual([]);
    });
});

describe('mezar taşları', () => {
    it('bulutta karşılığı olmayan mezar taşı gereksizdir', () => {
        const plan = mergeTasks({
            local: [],
            remote: [],
            dirtyIds: [],
            tombstones: [{ id: 'x', deletedAt: '2026-01-02T00:00:00.000Z' }],
        });

        expect(plan.toDelete).toEqual([]);
        expect(plan.obsoleteTombstoneIds).toEqual(['x']);
    });

    it('bulutta duran görevin mezar taşı silme emri üretir', () => {
        const plan = mergeTasks({
            local: [],
            remote: [makeTask('x')],
            dirtyIds: [],
            tombstones: [{ id: 'x', deletedAt: '2026-01-02T00:00:00.000Z' }],
        });

        expect(plan.toDelete).toEqual(['x']);
        expect(plan.obsoleteTombstoneIds).toEqual([]);
    });

    it('mezar taşı olan görev listede kalmaz', () => {
        // Savunma amaçlı: deleteTask görevi zaten listeden çıkarır.
        const plan = mergeTasks({
            local: [makeTask('x')],
            remote: [],
            dirtyIds: ['x'],
            tombstones: [{ id: 'x', deletedAt: '2026-01-02T00:00:00.000Z' }],
        });

        expect(plan.tasks).toEqual([]);
        expect(plan.toPush).toEqual([]);
    });
});

describe('ilk giriş senaryosu', () => {
    it('misafirken eklenen görevler hesaba aktarılır ve buluttakilerle birleşir', () => {
        // Giriş anında markAllDirty çağrıldığı için yereldeki her şey dirty.
        const local = [makeTask('yerel-1'), makeTask('yerel-2')];
        const remote = [makeTask('bulut-1')];

        const plan = mergeTasks({
            local,
            remote,
            dirtyIds: ['yerel-1', 'yerel-2'],
            tombstones: [],
        });

        expect(ids(plan.tasks)).toEqual(['bulut-1', 'yerel-1', 'yerel-2']);
        expect(ids(plan.toPush)).toEqual(['yerel-1', 'yerel-2']);
        expect(plan.toDelete).toEqual([]);
    });
});

describe('çevrimdışı düzenleme senaryosu', () => {
    it('çevrimdışıyken yapılan değişiklikler bağlanınca gönderilir', () => {
        const local = [
            makeTask('a', { title: 'Çevrimdışı düzenlendi', updatedAt: '2026-03-03T00:00:00.000Z' }),
            makeTask('yeni', { updatedAt: '2026-03-03T00:00:00.000Z' }),
        ];
        const remote = [makeTask('a', { title: 'Eski', updatedAt: '2026-01-01T00:00:00.000Z' })];

        const plan = mergeTasks({
            local,
            remote,
            dirtyIds: ['a', 'yeni'],
            tombstones: [{ id: 'silinen', deletedAt: '2026-03-03T00:00:00.000Z' }],
        });

        expect(ids(plan.toPush)).toEqual(['a', 'yeni']);
        expect(plan.tasks.find(t => t.id === 'a')?.title).toBe('Çevrimdışı düzenlendi');
        expect(plan.obsoleteTombstoneIds).toEqual(['silinen']);
    });
});

describe('birleştirme kararlılığı', () => {
    it('aynı girdi iki kez çalıştırıldığında sonuç değişmez', () => {
        const local = [makeTask('a', { updatedAt: '2026-02-02T00:00:00.000Z' })];
        const remote = [makeTask('a', { updatedAt: '2026-01-01T00:00:00.000Z' }), makeTask('b')];

        const first = mergeTasks({ local, remote, dirtyIds: ['a'], tombstones: [] });
        // İkinci tur: ilk turun sonucu yerel duruma yazıldı, dirty temizlendi,
        // bulut da güncellendi.
        const second = mergeTasks({
            local: first.tasks,
            remote: first.tasks,
            dirtyIds: [],
            tombstones: [],
        });

        expect(ids(second.tasks)).toEqual(ids(first.tasks));
        expect(second.toPush).toEqual([]);
        expect(second.toDelete).toEqual([]);
    });

    it('boş girdide hiçbir şey yapmaz', () => {
        const plan = mergeTasks({ local: [], remote: [], dirtyIds: [], tombstones: [] });

        expect(plan).toEqual({
            tasks: [],
            toPush: [],
            toDelete: [],
            discardedIds: [],
            obsoleteTombstoneIds: [],
        });
    });
});
