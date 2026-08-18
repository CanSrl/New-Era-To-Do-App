import { describe, expect, it } from 'vitest';
import type { Client, Project, TimeLog } from '@/lib/types';
import { byStartedAtDesc, filterLogs, groupTotals, sumByCurrency } from './totals';

const ISO = '2026-08-16T09:00:00.000Z';

function makeClient(over: Partial<Client> & { id: string }): Client {
    return {
        name: `Müşteri ${over.id}`,
        archived: false,
        position: 0,
        hourlyRate: 1000,
        currency: 'TRY',
        createdAt: ISO,
        updatedAt: ISO,
        ...over,
    };
}

function makeProject(over: Partial<Project> & { id: string; clientId: string }): Project {
    return {
        name: `Proje ${over.id}`,
        archived: false,
        position: 0,
        hourlyRate: null,
        currency: 'TRY',
        createdAt: ISO,
        updatedAt: ISO,
        ...over,
    };
}

function makeLog(over: Partial<TimeLog> & { id: string; clientId: string }): TimeLog {
    return {
        taskId: null,
        projectId: null,
        startedAt: ISO,
        durationMinutes: 60,
        note: null,
        createdAt: ISO,
        updatedAt: ISO,
        ...over,
    };
}

/** Yerel takvim gününde belirli bir saate düşen ISO damgası üretir. */
function localIso(year: number, month: number, day: number, hour = 12): string {
    return new Date(year, month - 1, day, hour).toISOString();
}

describe('groupTotals', () => {
    it('müşteri -> proje kırılımında süre ve tutar toplar', () => {
        const client = makeClient({ id: 'c1', hourlyRate: 1000 });
        const project = makeProject({ id: 'p1', clientId: 'c1', hourlyRate: 2000 });

        const [group] = groupTotals(
            [
                makeLog({ id: 'l1', clientId: 'c1', projectId: 'p1', durationMinutes: 90 }),
                makeLog({ id: 'l2', clientId: 'c1', projectId: 'p1', durationMinutes: 30 }),
            ],
            [client],
            [project]
        );

        expect(group.client?.id).toBe('c1');
        expect(group.minutes).toBe(120);
        expect(group.amount).toBe(4000); // 2 saat x 2000 (proje ücreti)
        expect(group.projects).toHaveLength(1);
        expect(group.projects[0].project?.id).toBe('p1');
        expect(group.projects[0].minutes).toBe(120);
    });

    it('projesiz kayıtları müşterinin altında ayrı bir grupta toplar', () => {
        const client = makeClient({ id: 'c1' });
        const project = makeProject({ id: 'p1', clientId: 'c1' });

        const [group] = groupTotals(
            [
                makeLog({ id: 'l1', clientId: 'c1', durationMinutes: 60 }),
                makeLog({ id: 'l2', clientId: 'c1', projectId: 'p1', durationMinutes: 30 }),
            ],
            [client],
            [project]
        );

        // Projesiz grup başta: teslim görünümündeki sırayla aynı.
        expect(group.projects[0].project).toBeNull();
        expect(group.projects[0].minutes).toBe(60);
        expect(group.projects[1].project?.id).toBe('p1');
        expect(group.minutes).toBe(90);
    });

    // Kur dönüşümü YOK: farklı para birimleri asla tek toplama girmez.
    it('farklı para birimlerini ayrı toplar, birbirine eklemez', () => {
        const tl = makeClient({ id: 'c1', currency: 'TRY', hourlyRate: 1000 });
        const usd = makeClient({ id: 'c2', currency: 'USD', hourlyRate: 100 });

        const totals = groupTotals(
            [
                makeLog({ id: 'l1', clientId: 'c1', durationMinutes: 60 }),
                makeLog({ id: 'l2', clientId: 'c2', durationMinutes: 120 }),
            ],
            [tl, usd],
            []
        );

        expect(sumByCurrency(totals)).toEqual([
            { currency: 'TRY', minutes: 60, amount: 1000 },
            { currency: 'USD', minutes: 120, amount: 200 },
        ]);
    });

    it('projenin 0 ücreti mirası ezer, tutar 0 çıkar', () => {
        const client = makeClient({ id: 'c1', hourlyRate: 1500 });
        const free = makeProject({ id: 'p1', clientId: 'c1', hourlyRate: 0 });

        const [group] = groupTotals(
            [makeLog({ id: 'l1', clientId: 'c1', projectId: 'p1', durationMinutes: 120 })],
            [client],
            [free]
        );

        // `??` yerine `||` yazılsaydı 0 mirasa düşer ve ücretsiz proje
        // sessizce 3000 TL olarak faturalanırdı.
        expect(group.amount).toBe(0);
        expect(group.minutes).toBe(120);
    });

    it('müşterisi çözülemeyen kaydı gizlemez, tutarını da uydurmaz', () => {
        // Senkron turları arasında gerçekten oluşabilen ara durum. Kaydı
        // düşürmek kullanıcının verisini sessizce yok etmek olurdu; ücreti
        // bilinmediği için tutar 0 ve para birimi yok.
        const [group] = groupTotals([makeLog({ id: 'l1', clientId: 'yok' })], [], []);

        expect(group.client).toBeNull();
        expect(group.currency).toBeNull();
        expect(group.minutes).toBe(60);
        expect(group.amount).toBe(0);
    });

    it('müşterileri position sırasına dizer, bağsız grubu sona koyar', () => {
        const first = makeClient({ id: 'c1', position: 0 });
        const second = makeClient({ id: 'c2', position: 1 });

        const totals = groupTotals(
            [
                makeLog({ id: 'l1', clientId: 'yok' }),
                makeLog({ id: 'l2', clientId: 'c2' }),
                makeLog({ id: 'l3', clientId: 'c1' }),
            ],
            [second, first],
            []
        );

        expect(totals.map((g) => g.client?.id ?? null)).toEqual(['c1', 'c2', null]);
    });

    it('kaydı olmayan müşteri için grup üretmez', () => {
        const totals = groupTotals([], [makeClient({ id: 'c1' })], []);

        expect(totals).toEqual([]);
    });
});

describe('filterLogs', () => {
    const logs = [
        makeLog({ id: 'l1', clientId: 'c1', startedAt: localIso(2026, 8, 15) }),
        makeLog({ id: 'l2', clientId: 'c1', projectId: 'p1', startedAt: localIso(2026, 8, 16) }),
        makeLog({ id: 'l3', clientId: 'c2', startedAt: localIso(2026, 8, 17) }),
    ];

    it('filtre verilmezse hepsini döndürür', () => {
        expect(filterLogs(logs, {})).toHaveLength(3);
    });

    it('tarih aralığı her iki ucu da KAPSAR', () => {
        const result = filterLogs(logs, { from: '2026-08-15', to: '2026-08-16' });

        // Aralık kullanıcıya "15-16 Ağustos" diye gösteriliyor; uçları dışarıda
        // bırakmak o günün kayıtlarını sessizce raporun dışında bırakırdı.
        expect(result.map((l) => l.id)).toEqual(['l1', 'l2']);
    });

    it('yerel takvim gününe göre filtreler', () => {
        // Gece yarısına yakın kayıt: UTC damgası bir önceki güne düşebilir.
        // Kullanıcı için o iş 17 Ağustos'ta yapıldı, damganın UTC günü değil.
        const lateNight = makeLog({ id: 'gec', clientId: 'c1', startedAt: localIso(2026, 8, 17, 1) });

        expect(filterLogs([lateNight], { from: '2026-08-17', to: '2026-08-17' })).toHaveLength(1);
    });

    it('müşteri filtresi o müşterinin bütün kayıtlarını verir', () => {
        expect(filterLogs(logs, { clientId: 'c1' }).map((l) => l.id)).toEqual(['l1', 'l2']);
    });

    it('proje filtresi seçildiyse müşteri filtresi zorunlu değildir', () => {
        expect(filterLogs(logs, { projectId: 'p1' }).map((l) => l.id)).toEqual(['l2']);
    });

    it('boş metinli filtreleri yok sayar', () => {
        expect(filterLogs(logs, { clientId: '', projectId: '', from: '', to: '' })).toHaveLength(3);
    });
});

describe('byStartedAtDesc', () => {
    it('en yeni kayıt başa gelir', () => {
        const older = makeLog({ id: 'eski', clientId: 'c1', startedAt: localIso(2026, 8, 15) });
        const newer = makeLog({ id: 'yeni', clientId: 'c1', startedAt: localIso(2026, 8, 17) });

        expect([older, newer].sort(byStartedAtDesc).map((l) => l.id)).toEqual(['yeni', 'eski']);
    });

    it('eşit damgada id ile ayırır — sıra render-dan render-a oynamasın', () => {
        const a = makeLog({ id: 'a', clientId: 'c1' });
        const b = makeLog({ id: 'b', clientId: 'c1' });

        expect([b, a].sort(byStartedAtDesc).map((l) => l.id)).toEqual(['a', 'b']);
    });
});
