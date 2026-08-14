import { describe, it, expect } from 'vitest';
import { mergeCategories, remapTaskCategories } from './sync-merge';
import type { Category, Task } from './types';

function makeCategory(id: string, overrides: Partial<Category> = {}): Category {
    return {
        id,
        name: `Kategori ${id}`,
        color: '#3b82f6',
        position: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
    return {
        id,
        title: `Görev ${id}`,
        priority: 'medium',
        completed: false,
        categoryId: null,
        clientId: null,
        projectId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        position: 0,
        ...overrides,
    };
}

const ids = (categories: readonly Category[]) => categories.map((c) => c.id).sort();

describe('mergeCategories', () => {
    it('yalnızca yerelde olan dirty kategoriyi gönderir', () => {
        const plan = mergeCategories({
            local: [makeCategory('a')],
            remote: [],
            dirtyIds: ['a'],
            tombstones: [],
        });

        expect(ids(plan.categories)).toEqual(['a']);
        expect(ids(plan.toPush)).toEqual(['a']);
        expect(plan.idRemap).toEqual({});
    });

    it('yalnızca yerelde olan temiz kategoriyi düşürür', () => {
        // Bir önceki turda senkronlanmıştı ve artık bulutta yok: başka
        // cihazda silinmiş demektir.
        const plan = mergeCategories({
            local: [makeCategory('a')],
            remote: [],
            dirtyIds: [],
            tombstones: [],
        });

        expect(plan.categories).toEqual([]);
        expect(plan.toPush).toEqual([]);
    });

    it('çakışmada daha yeni updatedAt kazanır', () => {
        const local = makeCategory('a', { name: 'Yerel', updatedAt: '2026-02-02T00:00:00.000Z' });
        const remote = makeCategory('a', { name: 'Uzak', updatedAt: '2026-01-01T00:00:00.000Z' });

        const plan = mergeCategories({
            local: [local], remote: [remote], dirtyIds: ['a'], tombstones: [],
        });

        expect(plan.categories[0].name).toBe('Yerel');
        expect(ids(plan.toPush)).toEqual(['a']);
    });

    it('damgalar eşitse bulut kazanır ve yerel sürüm atılır', () => {
        const local = makeCategory('a', { name: 'Yerel' });
        const remote = makeCategory('a', { name: 'Uzak' });

        const plan = mergeCategories({
            local: [local], remote: [remote], dirtyIds: ['a'], tombstones: [],
        });

        expect(plan.categories[0].name).toBe('Uzak');
        expect(plan.toPush).toEqual([]);
        expect(plan.discardedIds).toEqual(['a']);
    });

    it('mezar taşı buluttaki kategoriyi sildirir', () => {
        const plan = mergeCategories({
            local: [],
            remote: [makeCategory('a')],
            dirtyIds: [],
            tombstones: [{ id: 'a', deletedAt: '2026-01-02T00:00:00.000Z' }],
        });

        expect(plan.toDelete).toEqual(['a']);
        expect(plan.categories).toEqual([]);
    });

    it('bulutta karşılığı olmayan mezar taşını atar', () => {
        const plan = mergeCategories({
            local: [],
            remote: [],
            dirtyIds: [],
            tombstones: [{ id: 'yok', deletedAt: '2026-01-02T00:00:00.000Z' }],
        });

        expect(plan.obsoleteTombstoneIds).toEqual(['yok']);
        expect(plan.toDelete).toEqual([]);
    });
});

describe('mergeCategories — ada göre tekilleştirme', () => {
    it('aynı adı taşıyan yerel ve bulut kategorisini katlar', () => {
        // Misafir cihaz kendi "İş" kategorisini oluşturmuştu; hesapta zaten
        // başka bir cihazdan gelen "İş" var. İkisi de korunursa kullanıcı
        // listede aynı kategoriyi iki kez görür.
        const local = makeCategory('yerel-is', { name: 'İş' });
        const remote = makeCategory('bulut-is', { name: 'İş' });

        const plan = mergeCategories({
            local: [local],
            remote: [remote],
            dirtyIds: ['yerel-is'],
            tombstones: [],
        });

        expect(ids(plan.categories)).toEqual(['bulut-is']);
        expect(plan.toPush).toEqual([]);
        expect(plan.idRemap).toEqual({ 'yerel-is': 'bulut-is' });
    });

    it('katlanan kategorinin dirty bayrağını temizler', () => {
        // Temizlenmezse her turda yeniden gönderilmeye çalışılır ve her
        // seferinde aynı şekilde katlanarak sonsuza dek dirty kalırdı.
        const plan = mergeCategories({
            local: [makeCategory('yerel-is', { name: 'İş' })],
            remote: [makeCategory('bulut-is', { name: 'İş' })],
            dirtyIds: ['yerel-is'],
            tombstones: [],
        });

        expect(plan.discardedIds).toEqual(['yerel-is']);
    });

    it('büyük/küçük harf ve boşluk farkını aynı kategori sayar', () => {
        const plan = mergeCategories({
            local: [makeCategory('y', { name: '  iş ' })],
            remote: [makeCategory('b', { name: 'İş' })],
            dirtyIds: ['y'],
            tombstones: [],
        });

        expect(plan.idRemap).toEqual({ y: 'b' });
    });

    it('id eşleşen kategoriyi ada bakarak katlamaz', () => {
        // Kullanıcı bir kategoriyi başka bir kategoriyle aynı ada getirmiş
        // olabilir; bu bir çakışma değil, bilinçli düzenleme.
        const local = makeCategory('a', { name: 'Okul', updatedAt: '2026-03-03T00:00:00.000Z' });
        const remote = [makeCategory('a', { name: 'Eski' }), makeCategory('b', { name: 'Okul' })];

        const plan = mergeCategories({ local: [local], remote, dirtyIds: ['a'], tombstones: [] });

        expect(plan.idRemap).toEqual({});
        expect(ids(plan.categories)).toEqual(['a', 'b']);
    });

    it('bulutta aynı ad iki kez varsa bütün cihazlar aynı hedefte buluşur', () => {
        // Benzersizlik kısıtı bilinçli olarak yok, dolayısıyla bu durum
        // mümkün. Cihazların farklı hedefler seçmesi ayrışmaya yol açardı.
        const remote = [makeCategory('b1', { name: 'İş' }), makeCategory('b2', { name: 'İş' })];

        const first = mergeCategories({
            local: [makeCategory('y', { name: 'İş' })], remote, dirtyIds: ['y'], tombstones: [],
        });
        const second = mergeCategories({
            local: [makeCategory('z', { name: 'İş' })], remote, dirtyIds: ['z'], tombstones: [],
        });

        expect(first.idRemap.y).toBe(second.idRemap.z);
    });

    it('adı eşleşmeyen yerel kategori normal şekilde gönderilir', () => {
        const plan = mergeCategories({
            local: [makeCategory('y', { name: 'Tatil' })],
            remote: [makeCategory('b', { name: 'İş' })],
            dirtyIds: ['y'],
            tombstones: [],
        });

        expect(plan.idRemap).toEqual({});
        expect(ids(plan.toPush)).toEqual(['y']);
        expect(ids(plan.categories)).toEqual(['b', 'y']);
    });

    it('tekrar çalıştırıldığında yeni bir değişiklik üretmez', () => {
        // Yakınsama: ilk tur katladıktan sonra ikinci turda gönderilecek
        // veya silinecek bir şey kalmamalı.
        const remote = [makeCategory('bulut-is', { name: 'İş' })];
        const first = mergeCategories({
            local: [makeCategory('yerel-is', { name: 'İş' })],
            remote,
            dirtyIds: ['yerel-is'],
            tombstones: [],
        });

        const second = mergeCategories({
            local: first.categories,
            remote,
            dirtyIds: [],
            tombstones: [],
        });

        expect(ids(second.categories)).toEqual(['bulut-is']);
        expect(second.toPush).toEqual([]);
        expect(second.toDelete).toEqual([]);
        expect(second.idRemap).toEqual({});
    });
});

describe('remapTaskCategories', () => {
    const valid = new Set(['bulut-is', 'okul']);

    it('katlanan kategoriye bağlı görevi bulut kaydına taşır', () => {
        const tasks = [makeTask('t1', { categoryId: 'yerel-is' })];

        const result = remapTaskCategories(tasks, { 'yerel-is': 'bulut-is' }, valid);

        expect(result[0].categoryId).toBe('bulut-is');
    });

    it('artık var olmayan kategoriye bağlı görevi kategorisiz yapar', () => {
        // Olmayan bir kategoriye bağlı görevi göndermek 23503 ile reddedilir
        // ve o turdaki bütün görev senkronizasyonunu düşürürdü.
        const tasks = [makeTask('t1', { categoryId: 'silinmis' })];

        expect(remapTaskCategories(tasks, {}, valid)[0].categoryId).toBeNull();
    });

    it('geçerli bağı ve kategorisiz görevi olduğu gibi bırakır', () => {
        const tasks = [
            makeTask('t1', { categoryId: 'okul' }),
            makeTask('t2', { categoryId: null }),
        ];

        const result = remapTaskCategories(tasks, {}, valid);

        expect(result[0]).toBe(tasks[0]);
        expect(result[1]).toBe(tasks[1]);
    });

    it('katlanan kategori geçersizse görevi kategorisiz bırakır', () => {
        const tasks = [makeTask('t1', { categoryId: 'yerel' })];

        expect(remapTaskCategories(tasks, { yerel: 'yok' }, valid)[0].categoryId).toBeNull();
    });

    it('updatedAt damgasını ilerletmez', () => {
        // Bu bir kullanıcı düzenlemesi değil, bağ onarımı. Damgayı ilerletmek
        // aynı görevi başka cihazda gerçekten düzenleyen kullanıcının
        // değişikliğini haksız yere yenerdi.
        const tasks = [
            makeTask('t1', { categoryId: 'yerel-is', updatedAt: '2026-01-01T00:00:00.000Z' }),
        ];

        const result = remapTaskCategories(tasks, { 'yerel-is': 'bulut-is' }, valid);

        expect(result[0].updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });
});
