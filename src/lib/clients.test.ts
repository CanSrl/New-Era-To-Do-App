import { describe, expect, it } from 'vitest';
import {
    CLIENT_NAME_MAX,
    byArchivedThenPosition,
    byClientPosition,
    clientsForDisplay,
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

    // Veritabanındaki `check (hourly_rate >= 0)` karşılığı. Kaydı düşürmek
    // yerine varsayılana düşülür (normalizeCategory'deki renk deseni): bozuk
    // tek alan yüzünden müşteriyi silmek de, kısıtı ihlal eden satırı push
    // kuyruğuna sokup o turdaki bütün senkronu 23514 ile düşürmek de kötü.
    it('negatif hourlyRate değerini varsayılana düşürür', () => {
        expect(normalizeClient({ name: 'Acme', hourlyRate: -50 }, 0)?.hourlyRate).toBe(0);
    });

    it('sonlu olmayan veya sayı olmayan hourlyRate değerinde varsayılana düşer', () => {
        expect(normalizeClient({ name: 'Acme', hourlyRate: Number.NaN }, 0)?.hourlyRate).toBe(0);
        expect(normalizeClient({ name: 'Acme', hourlyRate: Infinity }, 0)?.hourlyRate).toBe(0);
        expect(normalizeClient({ name: 'Acme', hourlyRate: '1500' }, 0)?.hourlyRate).toBe(0);
    });

    it('geçerli hourlyRate değerini korur — 0 dahil', () => {
        expect(normalizeClient({ name: 'Acme', hourlyRate: 1500 }, 0)?.hourlyRate).toBe(1500);
        expect(normalizeClient({ name: 'Acme', hourlyRate: 0 }, 0)?.hourlyRate).toBe(0);
    });

    // Veritabanındaki `check (char_length(currency) = 3)` karşılığı.
    it('3 karakter olmayan currency değerini varsayılana düşürür', () => {
        expect(normalizeClient({ name: 'Acme', currency: 'TR' }, 0)?.currency).toBe('TRY');
        expect(normalizeClient({ name: 'Acme', currency: 'TRYX' }, 0)?.currency).toBe('TRY');
        expect(normalizeClient({ name: 'Acme', currency: '' }, 0)?.currency).toBe('TRY');
    });

    it('metin olmayan currency değerinde varsayılana düşer', () => {
        expect(normalizeClient({ name: 'Acme', currency: 949 }, 0)?.currency).toBe('TRY');
        expect(normalizeClient({ name: 'Acme', currency: null }, 0)?.currency).toBe('TRY');
    });

    it('3 karakterlik currency değerini korur', () => {
        expect(normalizeClient({ name: 'Acme', currency: 'EUR' }, 0)?.currency).toBe('EUR');
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

describe('byArchivedThenPosition', () => {
    it('arşivlenmiş kaydı position\'ı küçük olsa bile sona atar', () => {
        const archived = { ...createClient('Eski', 0), archived: true };
        const active = createClient('Yeni', 9);

        expect([archived, active].sort(byArchivedThenPosition).map((c) => c.name)).toEqual([
            'Yeni',
            'Eski',
        ]);
    });

    it('aynı arşiv durumundakileri position\'a göre sıralar', () => {
        const a = { ...createClient('A', 5), archived: true };
        const b = { ...createClient('B', 1), archived: true };

        expect([a, b].sort(byArchivedThenPosition).map((c) => c.name)).toEqual(['B', 'A']);
    });
});

describe('clientsForDisplay', () => {
    it('girdi dizisini değiştirmez', () => {
        const list = [createClient('B', 2), createClient('A', 1)];
        clientsForDisplay(list);

        expect(list.map((c) => c.name)).toEqual(['B', 'A']);
    });

    it('aktifleri önce, arşivlileri sonra döner', () => {
        const list = [
            { ...createClient('Arşiv', 0), archived: true },
            createClient('Aktif', 1),
        ];

        expect(clientsForDisplay(list).map((c) => c.name)).toEqual(['Aktif', 'Arşiv']);
    });
});
