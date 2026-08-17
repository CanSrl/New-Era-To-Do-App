import { describe, expect, it } from 'vitest';
import {
    PROJECT_NAME_MAX,
    createProject,
    isProjectNameTaken,
    nextProjectPosition,
    normalizeProject,
    projectsByClient,
    projectsForDisplay,
} from './projects';

describe('normalizeProject', () => {
    it('clientId olmayan kaydı reddeder', () => {
        // Müşterisiz proje şemada da imkânsız: projects.client_id not null.
        expect(normalizeProject({ name: 'Websitesi' }, 0)).toBeNull();
        expect(normalizeProject({ name: 'Websitesi', clientId: '' }, 0)).toBeNull();
    });

    it('adı olmayan kaydı reddeder', () => {
        expect(normalizeProject({ clientId: 'c1', name: '  ' }, 0)).toBeNull();
    });

    it('geçerli kaydı normalize eder', () => {
        const result = normalizeProject({ clientId: 'c1', name: 'Websitesi' }, 2);

        expect(result?.clientId).toBe('c1');
        expect(result?.name).toBe('Websitesi');
        expect(result?.position).toBe(2);
        expect(result?.archived).toBe(false);
    });

    it('adı en fazla PROJECT_NAME_MAX karaktere kırpar', () => {
        const long = 'x'.repeat(PROJECT_NAME_MAX + 10);
        expect(normalizeProject({ clientId: 'c1', name: long }, 0)?.name).toHaveLength(
            PROJECT_NAME_MAX
        );
    });

    // Veritabanındaki `check (hourly_rate is null or hourly_rate >= 0)`
    // karşılığı. Geçersiz değerde kaydı düşürmek yerine `null`'a düşülür:
    // müşteriden miras almak, kısıtı ihlal eden satırı push kuyruğuna sokup
    // o turdaki bütün senkronu 23514 ile düşürmekten iyidir.
    it('negatif hourlyRate değerinde mirasa (null) düşer', () => {
        expect(normalizeProject({ clientId: 'c1', name: 'Site', hourlyRate: -50 }, 0)?.hourlyRate)
            .toBeNull();
    });

    it('sonlu olmayan veya sayı olmayan hourlyRate değerinde mirasa düşer', () => {
        expect(normalizeProject({ clientId: 'c1', name: 'Site', hourlyRate: Number.NaN }, 0)
            ?.hourlyRate).toBeNull();
        expect(normalizeProject({ clientId: 'c1', name: 'Site', hourlyRate: -Infinity }, 0)
            ?.hourlyRate).toBeNull();
        expect(normalizeProject({ clientId: 'c1', name: 'Site', hourlyRate: '900' }, 0)
            ?.hourlyRate).toBeNull();
    });

    // null = müşteriden miras al, 0 = proje ücretsiz. İkisi FARKLI; doğrulama
    // eklerken 0'ın sessizce null'a dönüşmemesi şart.
    it('null mirası, 0 ise ücretsiz projeyi ifade eder', () => {
        expect(normalizeProject({ clientId: 'c1', name: 'Site', hourlyRate: null }, 0)?.hourlyRate)
            .toBeNull();
        expect(normalizeProject({ clientId: 'c1', name: 'Site' }, 0)?.hourlyRate).toBeNull();
        expect(normalizeProject({ clientId: 'c1', name: 'Site', hourlyRate: 0 }, 0)?.hourlyRate)
            .toBe(0);
        expect(normalizeProject({ clientId: 'c1', name: 'Site', hourlyRate: 900 }, 0)?.hourlyRate)
            .toBe(900);
    });

    it('3 karakter olmayan currency değerini varsayılana düşürür', () => {
        expect(normalizeProject({ clientId: 'c1', name: 'Site', currency: 'TR' }, 0)?.currency)
            .toBe('TRY');
        expect(normalizeProject({ clientId: 'c1', name: 'Site', currency: 'TRYX' }, 0)?.currency)
            .toBe('TRY');
        expect(normalizeProject({ clientId: 'c1', name: 'Site', currency: 949 }, 0)?.currency)
            .toBe('TRY');
    });

    it('3 karakterlik currency değerini korur', () => {
        expect(normalizeProject({ clientId: 'c1', name: 'Site', currency: 'EUR' }, 0)?.currency)
            .toBe('EUR');
    });
});

describe('isProjectNameTaken', () => {
    const projects = [createProject('c1', 'Websitesi', 0), createProject('c2', 'Websitesi', 0)];

    it('aynı müşteride aynı ad çakışır', () => {
        expect(isProjectNameTaken(projects, 'c1', 'websitesi')).toBe(true);
    });

    it('FARKLI müşterilerde aynı ad çakışmaz', () => {
        // İki ayrı müşterinin "Websitesi" projesi olması tamamen normaldir;
        // tekilleştirme anahtarı bu yüzden (müşteri, ad) çiftidir.
        expect(isProjectNameTaken(projects, 'c3', 'Websitesi')).toBe(false);
    });

    it('kendi kaydını saymaz', () => {
        expect(isProjectNameTaken(projects, 'c1', 'Websitesi', projects[0].id)).toBe(false);
    });
});

describe('nextProjectPosition', () => {
    it('yalnızca ilgili müşterinin projelerine bakar', () => {
        const projects = [createProject('c1', 'A', 0), createProject('c2', 'B', 9)];
        expect(nextProjectPosition(projects, 'c1')).toBe(1);
    });

    it('projesi olmayan müşteride 0 döner', () => {
        expect(nextProjectPosition([createProject('c1', 'A', 3)], 'c2')).toBe(0);
    });
});

describe('projectsByClient', () => {
    it('yalnızca o müşterinin projelerini sıralı döner', () => {
        const projects = [
            createProject('c1', 'B', 1),
            createProject('c2', 'X', 0),
            createProject('c1', 'A', 0),
        ];
        expect(projectsByClient(projects, 'c1').map((p) => p.name)).toEqual(['A', 'B']);
    });

    it('eşleşme yoksa boş dizi döner', () => {
        expect(projectsByClient([createProject('c1', 'A', 0)], 'c9')).toEqual([]);
    });
});

describe('projectsForDisplay', () => {
    it('arşivlileri listenin dibine indirir', () => {
        const projects = [
            { ...createProject('c1', 'Eski', 0), archived: true },
            createProject('c1', 'Güncel', 1),
        ];

        expect(projectsForDisplay(projects, 'c1').map((p) => p.name)).toEqual([
            'Güncel',
            'Eski',
        ]);
    });

    it('başka müşterinin projesini karıştırmaz', () => {
        const projects = [createProject('c1', 'Bizim', 0), createProject('c2', 'Onların', 0)];

        expect(projectsForDisplay(projects, 'c1').map((p) => p.name)).toEqual(['Bizim']);
    });
});
