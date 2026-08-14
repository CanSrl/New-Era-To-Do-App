import { describe, it, expect } from 'vitest';
import i18n, { dateLocaleFor, SUPPORTED_LANGUAGES, toSupported } from './index';
import tr from './locales/tr.json';
import en from './locales/en.json';

type Json = { [key: string]: string | Json };

/** İç içe nesneyi 'a.b.c' -> değer biçiminde düzleştirir. */
function flatten(source: Json, prefix = ''): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(source)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') out[path] = value;
        else Object.assign(out, flatten(value, path));
    }
    return out;
}

/** Metindeki {{deger}} yer tutucularını çıkarır. */
function placeholders(value: string): string[] {
    return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
}

const flatTr = flatten(tr as Json);
const flatEn = flatten(en as Json);

describe('çeviri dosyaları', () => {
    it('iki dilde de aynı anahtarları taşır', () => {
        // Tip sistemi Türkçe dosyayı referans alıyor ve İngilizce dosyayı
        // onunla karşılaştıramıyor; eksik anahtar ancak burada yakalanır.
        expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatTr).sort());
    });

    it('hiçbir çeviri boş değil', () => {
        const empty = Object.entries({ ...flatTr, ...flatEn })
            .filter(([, value]) => value.trim() === '')
            .map(([key]) => key);

        expect(empty).toEqual([]);
    });

    it('yer tutucular iki dilde eşleşir', () => {
        // Bir dilde {{count}} yazıp diğerinde unutmak, o dilde ham sayının
        // hiç görünmemesine yol açar.
        const mismatched = Object.keys(flatTr).filter(
            (key) =>
                placeholders(flatTr[key]).join() !== placeholders(flatEn[key] ?? '').join()
        );

        expect(mismatched).toEqual([]);
    });

    it('çoğul anahtarları her iki dilde de eksiksiz', () => {
        // i18next `_one` görüyorsa `_other` da bekler; biri eksikse o durumda
        // anahtarın kendisi ekrana basılır.
        const singulars = Object.keys(flatTr).filter((key) => key.endsWith('_one'));
        expect(singulars.length).toBeGreaterThan(0);

        for (const key of singulars) {
            const plural = key.replace(/_one$/, '_other');
            expect(flatTr, `tr: ${plural}`).toHaveProperty([plural]);
            expect(flatEn, `en: ${plural}`).toHaveProperty([plural]);
        }
    });

    it('Türkçe metinlerde çevrilmemiş kalıntı yok', () => {
        // İngilizce dosyaya yanlışlıkla Türkçe metin kopyalanmasını yakalar.
        const turkish = /[çğıöşüÇĞİÖŞÜ]/;
        const leftovers = Object.entries(flatEn)
            .filter(([key, value]) => turkish.test(value) && !key.startsWith('language.'))
            .map(([key]) => key);

        expect(leftovers).toEqual([]);
    });
});

describe('toSupported', () => {
    it('bölgesel etiketi taban dile indirger', () => {
        expect(toSupported('tr-TR')).toBe('tr');
        expect(toSupported('en-GB')).toBe('en');
        expect(toSupported('EN')).toBe('en');
    });

    it('desteklenmeyen dili yedek dile düşürür', () => {
        expect(toSupported('de')).toBe('tr');
        expect(toSupported(undefined)).toBe('tr');
        expect(toSupported('')).toBe('tr');
    });
});

describe('dateLocaleFor', () => {
    it('her desteklenen dil için bir date-fns yerelliği verir', () => {
        for (const language of SUPPORTED_LANGUAGES) {
            expect(dateLocaleFor(language)).toBeDefined();
        }
    });

    it('tanınmayan dilde de bir yerellik döndürür', () => {
        expect(dateLocaleFor('de')).toBe(dateLocaleFor('tr'));
    });
});

describe('çeviri davranışı', () => {
    it('çoğul biçimleri sayıya göre seçer', async () => {
        await i18n.changeLanguage('en');
        expect(i18n.t('category.taskCount', { count: 1 })).toBe('1 task');
        expect(i18n.t('category.taskCount', { count: 3 })).toBe('3 tasks');
        await i18n.changeLanguage('tr');
    });

    it('dil değişince aynı anahtar farklı metin verir', async () => {
        const turkish = i18n.t('nav.settings');
        await i18n.changeLanguage('en');
        const english = i18n.t('nav.settings');
        await i18n.changeLanguage('tr');

        expect(turkish).not.toBe(english);
        expect(i18n.t('nav.settings')).toBe(turkish);
    });

    it('değer araya eklenirken kaçışlama yapmaz', () => {
        // escapeValue: false — React zaten kaçışlıyor. Açık kalsaydı
        // tırnak içeren bir kategori adı &quot; olarak görünürdü.
        expect(i18n.t('category.added', { name: 'A "B"' })).toContain('A "B"');
    });
});
