import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from './index';
import type { Task } from '../lib/types';

const STORAGE_KEY = 'yapilacaklar-storage';

/** Testler arasında store'u ve kalıcı depoyu temizler. */
function resetStore() {
    localStorage.clear();
    useTaskStore.setState({ tasks: [], searchQuery: '', filter: 'Tüm Görevler' });
}

const store = () => useTaskStore.getState();

function addTask(title: string, overrides: Partial<Task> = {}) {
    store().addTask({
        title,
        priority: 'Orta',
        category: 'Kişisel',
        completed: false,
        ...overrides,
    });
}

beforeEach(resetStore);

describe('addTask', () => {
    it('görevi id, createdAt ve position ile ekler', () => {
        addTask('İlk görev');

        const [task] = store().tasks;
        expect(task.title).toBe('İlk görev');
        expect(task.id).toBeTruthy();
        expect(task.position).toBe(0);
        expect(Number.isNaN(new Date(task.createdAt).getTime())).toBe(false);
    });

    it('her yeni göreve artan position verir', () => {
        addTask('Bir');
        addTask('İki');
        addTask('Üç');

        expect(store().tasks.map(t => t.position)).toEqual([0, 1, 2]);
    });

    it('araya silme olsa bile position çakışmaz', () => {
        addTask('Bir');
        addTask('İki');
        store().deleteTask(store().tasks[1].id);
        addTask('Üç');

        const positions = store().tasks.map(t => t.position);
        expect(new Set(positions).size).toBe(positions.length);
    });
});

describe('updateTask', () => {
    it('yalnızca hedef görevi değiştirir', () => {
        addTask('Bir');
        addTask('İki');
        const [first, second] = store().tasks;

        store().updateTask(first.id, { title: 'Bir (güncel)' });

        expect(store().tasks.find(t => t.id === first.id)?.title).toBe('Bir (güncel)');
        expect(store().tasks.find(t => t.id === second.id)?.title).toBe('İki');
    });

    it('bilinmeyen id için hiçbir şey değiştirmez', () => {
        addTask('Bir');
        const before = store().tasks;

        store().updateTask('yok-boyle-id', { title: 'X' });

        expect(store().tasks).toEqual(before);
    });
});

describe('deleteTask', () => {
    it('yalnızca hedef görevi siler', () => {
        addTask('Bir');
        addTask('İki');
        const target = store().tasks[0];

        store().deleteTask(target.id);

        expect(store().tasks.map(t => t.title)).toEqual(['İki']);
    });
});

describe('toggleComplete', () => {
    it('tamamlanma durumunu tersine çevirir', () => {
        addTask('Bir');
        const id = store().tasks[0].id;

        store().toggleComplete(id);
        expect(store().tasks[0].completed).toBe(true);

        store().toggleComplete(id);
        expect(store().tasks[0].completed).toBe(false);
    });
});

describe('reorderTasks', () => {
    it('position değerlerini yeniden numaralandırır', () => {
        addTask('Bir');
        addTask('İki');
        addTask('Üç');

        const [a, b, c] = store().tasks;
        store().reorderTasks([c, a, b]);

        expect(store().tasks.map(t => [t.title, t.position])).toEqual([
            ['Üç', 0],
            ['Bir', 1],
            ['İki', 2],
        ]);
    });

    it('yeni sıra sonraki eklemeyi de etkiler', () => {
        addTask('Bir');
        addTask('İki');
        const [a, b] = store().tasks;

        store().reorderTasks([b, a]);
        addTask('Üç');

        expect(store().tasks.find(t => t.title === 'Üç')?.position).toBe(2);
    });
});

describe('clearCompleted', () => {
    it('yalnızca tamamlanmış görevleri siler', () => {
        addTask('Bir');
        addTask('İki');
        addTask('Üç');
        store().toggleComplete(store().tasks[1].id);

        store().clearCompleted();

        expect(store().tasks.map(t => t.title)).toEqual(['Bir', 'Üç']);
    });
});

describe('importTasks', () => {
    it('geçerli görevleri ekler ve sayısını döner', () => {
        const added = store().importTasks([
            { id: 'x1', title: 'Dosyadan bir' },
            { id: 'x2', title: 'Dosyadan iki' },
        ]);

        expect(added).toBe(2);
        expect(store().tasks.map(t => t.title)).toEqual(['Dosyadan bir', 'Dosyadan iki']);
    });

    it('aynı id ile gelen görevi tekrar eklemez', () => {
        store().importTasks([{ id: 'x1', title: 'Dosyadan bir' }]);
        const added = store().importTasks([{ id: 'x1', title: 'Dosyadan bir' }]);

        expect(added).toBe(0);
        expect(store().tasks).toHaveLength(1);
    });

    it('aynı dosyada tekrarlanan id-yi bir kez ekler', () => {
        const added = store().importTasks([
            { id: 'x1', title: 'Bir' },
            { id: 'x1', title: 'Bir kopya' },
        ]);

        expect(added).toBe(1);
    });

    it('bozuk kayıtları atlar ama sağlamları alır', () => {
        const added = store().importTasks([
            { title: 'Geçerli' },
            { title: '   ' },
            null,
            'lorem',
            42,
            {},
        ]);

        expect(added).toBe(1);
        expect(store().tasks.map(t => t.title)).toEqual(['Geçerli']);
    });

    it('içe aktarılan görevleri mevcut listenin sonuna koyar', () => {
        addTask('Mevcut');
        store().importTasks([
            { id: 'x1', title: 'Dosyadan', position: 0 },
        ]);

        const positions = store().tasks.map(t => t.position);
        expect(new Set(positions).size).toBe(2);
        expect(store().tasks.find(t => t.title === 'Dosyadan')?.position).toBe(1);
    });

    it('eski biçimdeki tarihleri dönüştürür', () => {
        store().importTasks([
            { id: 'x1', title: 'Eski', dueDate: '2026-08-15T00:00:00.000Z' },
        ]);

        expect(store().tasks[0].dueDate).toBe('2026-08-15');
    });

    it('boş listede hiçbir şey yapmaz', () => {
        expect(store().importTasks([])).toBe(0);
        expect(store().tasks).toEqual([]);
    });
});

describe('filtre durumu', () => {
    it('arama ve filtre değerlerini saklar', () => {
        store().setSearchQuery('rapor');
        store().setFilter('Aktif');

        expect(store().searchQuery).toBe('rapor');
        expect(store().filter).toBe('Aktif');
    });
});

describe('kalıcılık (persist)', () => {
    it('görevleri LocalStorage-a yazar', async () => {
        addTask('Kalıcı görev');

        // persist yazma işlemi mikro görev sırasında tamamlanır.
        await Promise.resolve();

        const raw = localStorage.getItem(STORAGE_KEY);
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw as string);
        expect(parsed.state.tasks[0].title).toBe('Kalıcı görev');
        expect(parsed.version).toBe(1);
    });

    it('yazılan tarihler string olarak saklanır', async () => {
        addTask('Tarihli', { dueDate: '2026-08-15' });
        await Promise.resolve();

        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
        expect(typeof parsed.state.tasks[0].createdAt).toBe('string');
        expect(parsed.state.tasks[0].dueDate).toBe('2026-08-15');
    });
});

describe('v0 -> v1 göçü', () => {
    /**
     * Eski sürüm tarihleri Date sanıyordu ama JSON-a string yazıyordu ve geri
     * çevirmiyordu; position alanı da yoktu. Kayıtlı veri bozulmadan taşınmalı.
     */
    it('eski kaydı okurken tarihleri ve position alanını düzeltir', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 0,
            state: {
                searchQuery: '',
                filter: 'Tüm Görevler',
                tasks: [
                    {
                        id: 'eski-1',
                        title: 'Eski görev',
                        priority: 'Yüksek',
                        category: 'İş',
                        completed: false,
                        createdAt: '2026-01-05T08:00:00.000Z',
                        dueDate: '2026-08-15T00:00:00.000Z',
                    },
                ],
            },
        }));

        await useTaskStore.persist.rehydrate();

        const [task] = store().tasks;
        expect(task.title).toBe('Eski görev');
        expect(task.dueDate).toBe('2026-08-15');
        expect(task.position).toBe(0);
        expect(task.priority).toBe('Yüksek');
        expect(task.category).toBe('İş');
    });

    it('eski kayıttaki bozuk görevleri eler', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: 0,
            state: {
                searchQuery: '',
                filter: 'Tüm Görevler',
                tasks: [
                    { id: 'iyi', title: 'Sağlam' },
                    { id: 'bozuk', title: '' },
                ],
            },
        }));

        await useTaskStore.persist.rehydrate();

        expect(store().tasks.map(t => t.title)).toEqual(['Sağlam']);
    });
});
