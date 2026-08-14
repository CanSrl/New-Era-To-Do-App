import { describe, expect, it } from 'vitest';
import {
    CLIENT_NAME_MAX,
    byClientPosition,
    createClient,
    isClientNameTaken,
    nextClientPosition,
    normalizeClient,
} from './clients';

describe('normalizeClient', () => {
    it('adı olmayan kaydı reddeder', () => {
        expect(normalizeClient({ name: '   ' }, 0)).toBeNull();
        expect(normalizeClient({}, 0)).toBeNull();
        expect(normalizeClient(null, 0)).toBeNull();
    });

    it('eksik alanları tamamlar', () => {
        const result = normalizeClient({ name: 'Acme' }, 3);

        expect(result?.name).toBe('Acme');
        expect(result?.archived).toBe(false);
        expect(result?.position).toBe(3);
        expect(result?.id).toBeTruthy();
        // updatedAt yoksa oluşturma zamanına düşer; aksi halde ilk senkron
        // turunda damga karşılaştırması anlamsız olurdu.
        expect(result?.updatedAt).toBe(result?.createdAt);
    });

    it('adı en fazla CLIENT_NAME_MAX karaktere kırpar', () => {
        const long = 'x'.repeat(CLIENT_NAME_MAX + 10);
        expect(normalizeClient({ name: long }, 0)?.name).toHaveLength(CLIENT_NAME_MAX);
    });

    it('archived alanını boolean olmayan değerden korur', () => {
        expect(normalizeClient({ name: 'Acme', archived: 'evet' }, 0)?.archived).toBe(false);
        expect(normalizeClient({ name: 'Acme', archived: true }, 0)?.archived).toBe(true);
    });

    it('geçersiz position değerinde yedeğe düşer', () => {
        expect(normalizeClient({ name: 'Acme', position: Number.NaN }, 5)?.position).toBe(5);
        expect(normalizeClient({ name: 'Acme', position: 'iki' }, 5)?.position).toBe(5);
    });
});

describe('createClient', () => {
    it('adın başındaki ve sonundaki boşlukları atar', () => {
        expect(createClient('  Acme  ', 0).name).toBe('Acme');
    });

    it('yeni kayıt arşivlenmemiş başlar', () => {
        expect(createClient('Acme', 0).archived).toBe(false);
    });
});

describe('isClientNameTaken', () => {
    const clients = [createClient('Acme', 0), createClient('Startup X', 1)];

    it('büyük/küçük harf ve boşluk farkını yok sayar', () => {
        expect(isClientNameTaken(clients, '  acme ')).toBe(true);
    });

    it('Türkçe I/İ çiftini doğru karşılaştırır', () => {
        const withTurkish = [createClient('İş Bankası', 0)];
        expect(isClientNameTaken(withTurkish, 'iş bankası')).toBe(true);
    });

    it('kendi kaydını saymaz', () => {
        expect(isClientNameTaken(clients, 'Acme', clients[0].id)).toBe(false);
    });

    it('kullanılmayan adı serbest bırakır', () => {
        expect(isClientNameTaken(clients, 'Yeni Müşteri')).toBe(false);
    });
});

describe('nextClientPosition', () => {
    it('boş listede 0 döner', () => {
        expect(nextClientPosition([])).toBe(0);
    });

    it('en büyük position + 1 döner', () => {
        expect(nextClientPosition([createClient('A', 0), createClient('B', 7)])).toBe(8);
    });
});

describe('byClientPosition', () => {
    it('position\'a göre sıralar', () => {
        const list = [createClient('B', 2), createClient('A', 1)];
        expect([...list].sort(byClientPosition).map((c) => c.name)).toEqual(['A', 'B']);
    });

    it('eşitlikte oluşturma sırasına düşer', () => {
        const first = createClient('İlk', 0, '2026-01-01T00:00:00.000Z');
        const second = createClient('İkinci', 0, '2026-01-02T00:00:00.000Z');
        expect([second, first].sort(byClientPosition).map((c) => c.name)).toEqual([
            'İlk',
            'İkinci',
        ]);
    });
});
