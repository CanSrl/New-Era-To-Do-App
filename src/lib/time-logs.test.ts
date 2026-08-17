import { describe, expect, it } from 'vitest';
import { amountFor, effectiveRate, elapsedMinutes, normalizeTimeLog } from './time-logs';
import type { Client, Project, TimeLog } from './types';

const client: Client = {
    id: 'c1', name: 'Acme', archived: false, position: 0,
    hourlyRate: 1500, currency: 'TRY',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};

const project = (hourlyRate: number | null): Project => ({
    ...client, id: 'p1', clientId: 'c1', name: 'Site', hourlyRate,
});

describe('effectiveRate', () => {
    it('proje ucreti null ise musteriden miras alir', () => {
        expect(effectiveRate(client, project(null))).toBe(1500);
    });

    it('proje yoksa musteri ucreti gecerlidir', () => {
        expect(effectiveRate(client, null)).toBe(1500);
    });

    // Regresyon: `project.hourlyRate || client.hourlyRate` yazilsaydi 0
    // mirasa duser ve ucretsiz proje sessizce faturalanirdi.
    it('projenin 0 ucreti mirasi EZER — ucretsiz proje demektir', () => {
        expect(effectiveRate(client, project(0))).toBe(0);
    });

    it('proje ucreti doluysa musteriyi ezer', () => {
        expect(effectiveRate(client, project(2000))).toBe(2000);
    });
});

describe('amountFor', () => {
    const log: TimeLog = {
        id: 'l1', taskId: null, clientId: 'c1', projectId: null,
        startedAt: '2026-08-16T09:00:00.000Z', durationMinutes: 90, note: null,
        createdAt: '2026-08-16T09:00:00.000Z', updatedAt: '2026-08-16T09:00:00.000Z',
    };

    it('sure x etkin ucret', () => {
        expect(amountFor(log, client, null)).toBe(2250); // 1.5 saat x 1500
    });
});

describe('elapsedMinutes', () => {
    it('now ile startedAt arasindaki farki dakika olarak verir', () => {
        const timer = {
            taskId: 't1', clientId: 'c1', projectId: null,
            startedAt: '2026-08-16T09:00:00.000Z', note: null,
        };
        expect(elapsedMinutes(timer, '2026-08-16T10:30:00.000Z')).toBe(90);
    });

    // Sayac startedAt damgasindan turetilir; sekme uykuya dalsa da dogru kalir.
    it('gecmise donuk saat farkinda negatif dondurmez', () => {
        const timer = {
            taskId: null, clientId: 'c1', projectId: null,
            startedAt: '2026-08-16T10:00:00.000Z', note: null,
        };
        expect(elapsedMinutes(timer, '2026-08-16T09:00:00.000Z')).toBe(0);
    });
});

describe('normalizeTimeLog', () => {
    it('musterisiz kaydi reddeder', () => {
        expect(normalizeTimeLog({ id: 'l1', durationMinutes: 30 })).toBeNull();
    });

    it('suresi tavani asan kaydi reddeder', () => {
        expect(normalizeTimeLog({
            id: 'l1', clientId: 'c1',
            startedAt: '2026-08-16T09:00:00.000Z', durationMinutes: 1441,
        })).toBeNull();
    });

    // clientId zorunludur: diger butun alanlar gecerli olsa bile eksikse kayit
    // dusurulur. (Sema tarafinda time_logs.client_id NOT NULL.)
    it('diger alanlar gecerli olsa da clientId yoksa reddeder', () => {
        expect(normalizeTimeLog({
            id: 'l1', projectId: 'p1',
            startedAt: '2026-08-16T09:00:00.000Z', durationMinutes: 30,
        })).toBeNull();
    });
});
