import { describe, it, expect } from 'vitest';
import {
    byCategoryPosition,
    categoryKey,
    createCategory,
    DEFAULT_CATEGORIES,
    isNameTaken,
    isValidColor,
    nextCategoryPosition,
    normalizeCategory,
    seedCategories,
    CATEGORY_NAME_MAX,
} from './categories';
import type { Category } from './types';

const make = (overrides: Partial<Category> = {}): Category => ({
    id: 'k1',
    name: 'İş',
    color: '#3b82f6',
    position: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

describe('categoryKey', () => {
    it('büyük/küçük harf ve boşluk farkını yok sayar', () => {
        expect(categoryKey('  İş  ')).toBe(categoryKey('iş'));
        expect(categoryKey('Kişisel')).toBe(categoryKey('KİŞİSEL'));
    });

    it('Türkçe I/İ çiftini doğru katlar', () => {
        // İngilizce toLowerCase() 'İ' harfini 'i̇' (birleşik) yapar ve
        // 'iş' ile eşleşmez; bu yüzden yerel duyarlı biçim kullanılıyor.
        expect(categoryKey('İŞ')).toBe(categoryKey('iş'));
        expect(categoryKey('IŞIK')).toBe(categoryKey('ışık'));
    });

    it('farklı kategorileri ayırmaya devam eder', () => {
        expect(categoryKey('İş')).not.toBe(categoryKey('Okul'));
    });
});

describe('isValidColor', () => {
    it('yalnızca küçük harfli #rrggbb kabul eder', () => {
        expect(isValidColor('#3b82f6')).toBe(true);
        expect(isValidColor('#3B82F6')).toBe(false);
        expect(isValidColor('#abc')).toBe(false);
        expect(isValidColor('kirmizi')).toBe(false);
        expect(isValidColor(undefined)).toBe(false);
    });
});

describe('normalizeCategory', () => {
    it('adı olmayan kaydı reddeder', () => {
        expect(normalizeCategory({ name: '   ' }, 0)).toBeNull();
        expect(normalizeCategory({}, 0)).toBeNull();
        expect(normalizeCategory(null, 0)).toBeNull();
    });

    it('geçersiz rengi varsayılana düşürür', () => {
        expect(normalizeCategory({ name: 'X', color: 'mor' }, 0)?.color).toBe('#6366f1');
    });

    it('çok uzun adı kısaltır', () => {
        const long = 'a'.repeat(120);
        expect(normalizeCategory({ name: long }, 0)?.name).toHaveLength(CATEGORY_NAME_MAX);
    });

    it('updatedAt yoksa createdAt değerine düşer', () => {
        const result = normalizeCategory(
            { name: 'X', createdAt: '2026-01-05T08:00:00.000Z' },
            0
        );
        expect(result?.updatedAt).toBe('2026-01-05T08:00:00.000Z');
    });
});

describe('seedCategories', () => {
    it('varsayılan dört kategoriyi sırayla üretir', () => {
        const seeded = seedCategories();

        // Varsayılan dil Türkçe olduğu için tohum adları legacyName ile
        // aynı çıkar; bu, veritabanı migration'ıyla da hizalı olduklarını
        // gösterir.
        expect(seeded.map((c) => c.name)).toEqual(
            DEFAULT_CATEGORIES.map((c) => c.legacyName)
        );
        expect(seeded.map((c) => c.position)).toEqual([0, 1, 2, 3]);
    });

    it('her çağrıda yeni id üretir', () => {
        const first = seedCategories();
        const second = seedCategories();
        expect(first[0].id).not.toBe(second[0].id);
    });

    it('renkleri veritabanı kısıtına uygun', () => {
        // Migration aynı renkleri yazıyor; geçersiz bir değer push sırasında
        // 23514 ile dönerdi.
        expect(seedCategories().every((c) => isValidColor(c.color))).toBe(true);
    });
});

describe('createCategory', () => {
    it('adı kırpar ve geçersiz rengi varsayılana düşürür', () => {
        const category = createCategory('  Yeni  ', 'yesil', 5);
        expect(category.name).toBe('Yeni');
        expect(category.color).toBe('#6366f1');
        expect(category.position).toBe(5);
    });
});

describe('isNameTaken', () => {
    const categories = [make({ id: 'k1', name: 'İş' }), make({ id: 'k2', name: 'Okul' })];

    it('büyük/küçük harf farkına bakmaz', () => {
        expect(isNameTaken(categories, 'iş')).toBe(true);
        expect(isNameTaken(categories, 'Tatil')).toBe(false);
    });

    it('kategorinin kendi adını çakışma saymaz', () => {
        // Yeniden adlandırma ekranında kendi adını korumak engellenmemeli.
        expect(isNameTaken(categories, 'İş', 'k1')).toBe(false);
        expect(isNameTaken(categories, 'İş', 'k2')).toBe(true);
    });
});

describe('sıralama', () => {
    it('position değerine göre sıralar, eşitlikte oluşturma zamanına düşer', () => {
        const a = make({ id: 'a', position: 1, createdAt: '2026-01-02T00:00:00.000Z' });
        const b = make({ id: 'b', position: 0 });
        const c = make({ id: 'c', position: 1, createdAt: '2026-01-01T00:00:00.000Z' });

        expect([a, b, c].sort(byCategoryPosition).map((x) => x.id)).toEqual(['b', 'c', 'a']);
    });

    it('bir sonraki sıra anahtarı listenin sonunu gösterir', () => {
        expect(nextCategoryPosition([])).toBe(0);
        expect(nextCategoryPosition([make({ position: 3 }), make({ position: 7 })])).toBe(8);
    });
});
