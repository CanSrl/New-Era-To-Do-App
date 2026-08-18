import { describe, it, expect } from 'vitest';
import i18n from '@/i18n';
import { createClient } from '@/lib/clients';
import { createProject } from '@/lib/projects';
import { createTimeLog } from '@/lib/time-logs';
import type { Client, Project, Task, TimeLog } from '@/lib/types';
import { buildTimeCsv, csvFileName } from './time-csv';

const t = i18n.t;

/**
 * Yerel saatten ISO damga üretir.
 *
 * `new Date('2026-08-17T14:30')` yerine bileşenlerden kurulur: dosyadaki
 * beklentiler **yerel** tarih üzerinden yazılı ve makinenin saat dilimi
 * değiştiğinde kaymamalı (`localDateOf`'un koruduğu kuralın aynısı).
 */
function localIso(year: number, month: number, day: number, hour = 9, minute = 0): string {
    return new Date(year, month - 1, day, hour, minute).toISOString();
}

function makeClient(name: string, hourlyRate: number, currency = 'TRY'): Client {
    return { ...createClient(name, 0), hourlyRate, currency };
}

function makeProject(client: Client, name: string, hourlyRate: number | null = null): Project {
    return { ...createProject(client.id, name, 0), hourlyRate };
}

function makeLog(input: {
    client: Client;
    project?: Project;
    task?: Task;
    minutes: number;
    startedAt?: string;
    note?: string;
}): TimeLog {
    return createTimeLog({
        clientId: input.client.id,
        projectId: input.project?.id ?? null,
        taskId: input.task?.id ?? null,
        startedAt: input.startedAt ?? localIso(2026, 8, 17, 14, 30),
        durationMinutes: input.minutes,
        note: input.note ?? null,
    });
}

const EMPTY = { clients: [], projects: [], tasks: [] };

describe('buildTimeCsv', () => {
    it('UTF-8 BOM ile başlar', () => {
        // BOM olmadan Excel'in Türkçe kurulumu dosyayı ANSI sanar ve
        // "Müşteri" gibi başlıklar bozuk görünür.
        expect(buildTimeCsv([], EMPTY, t).startsWith('﻿')).toBe(true);
    });

    it('ayraç noktalı virgüldür', () => {
        // Excel TR'de liste ayracı ";" — virgül kullanılsaydı her satır tek
        // hücreye sıkışırdı. Ondalık ayracın virgül olmasının sebebi de bu.
        expect(buildTimeCsv([], EMPTY, t)).toContain('Tarih;Müşteri;');
    });

    it('boş sonuç için yalnızca başlık satırı üretir', () => {
        const csv = buildTimeCsv([], EMPTY, t);

        expect(csv.replace('﻿', '').trim().split('\n')).toHaveLength(1);
    });

    it('süreyi ondalık saat olarak, virgüllü yazar', () => {
        const client = makeClient('Acme', 1000);
        const log = makeLog({ client, minutes: 90 });

        const csv = buildTimeCsv([log], { ...EMPTY, clients: [client] }, t);

        expect(csv).toContain(';1,5;');
    });

    it('tutarı etkin ücretten hesaplar ve iki basamak yazar', () => {
        const client = makeClient('Acme', 1000);
        // Proje ücreti müşteriyi ezer; `??` kuralının CSV tarafındaki izi.
        const project = makeProject(client, 'Websitesi', 2000);
        const log = makeLog({ client, project, minutes: 30 });

        const csv = buildTimeCsv([log], { ...EMPTY, clients: [client], projects: [project] }, t);

        // 0,5 saat x 2000 = 1000,00 — müşterinin 1000'i değil projenin 2000'i.
        expect(csv).toContain(';1000,00;TRY');
    });

    it('ücretsiz projeyi mirasa düşürmez', () => {
        const client = makeClient('Acme', 1000);
        const project = makeProject(client, 'Bakım', 0);
        const log = makeLog({ client, project, minutes: 60 });

        const csv = buildTimeCsv([log], { ...EMPTY, clients: [client], projects: [project] }, t);

        expect(csv).toContain(';0,00;TRY');
    });

    it('tarihi yerel gün ve saatle yazar', () => {
        const client = makeClient('Acme', 0);
        const log = makeLog({ client, minutes: 60, startedAt: localIso(2026, 8, 17, 14, 30) });

        const csv = buildTimeCsv([log], { ...EMPTY, clients: [client] }, t);

        // Damgayı UTC'den okumak UTC+3'te gece yarısı sonrası kayıtları bir
        // önceki güne düşürürdü.
        expect(csv).toContain('2026-08-17 14:30;Acme');
    });

    it('görev başlığını ve notu ayrı sütunlara yazar', () => {
        const client = makeClient('Acme', 0);
        const task = { id: 'gorev-1', title: 'Anasayfa' } as Task;
        const log = makeLog({ client, task, minutes: 60, note: 'ilk tur' });

        const csv = buildTimeCsv([log], { ...EMPTY, clients: [client], tasks: [task] }, t);

        expect(csv).toContain('Anasayfa;ilk tur;');
    });

    it('içinde noktalı virgül geçen not alanını tırnaklar', () => {
        const client = makeClient('Acme', 0);
        const log = makeLog({ client, minutes: 60, note: 'a; b' });

        const csv = buildTimeCsv([log], { ...EMPTY, clients: [client] }, t);

        // Kaçış kuralı papaparse'a bırakılıyor; bu test ayraç değişirse
        // kaçışın da değiştiğini sabitler.
        expect(csv).toContain('"a; b"');
    });

    it('sonda müşteri, proje ve para birimi özet satırları bulunur', () => {
        const client = makeClient('Acme', 1000);
        const project = makeProject(client, 'Websitesi');
        const logs = [
            makeLog({ client, project, minutes: 60 }),
            makeLog({ client, minutes: 30 }),
        ];

        const csv = buildTimeCsv(logs, { ...EMPTY, clients: [client], projects: [project] }, t);
        const lines = csv.replace('﻿', '').trim().split('\n');

        expect(csv).toContain('Müşteri toplamı;Acme');
        expect(csv).toContain('Proje toplamı;Acme;Websitesi');
        expect(csv).toContain('Genel toplam');

        // Özet kayıtların ARDINDAN gelir; başa konsaydı satırları aramak için
        // her dosyada kaydırmak gerekirdi.
        const firstSummary = lines.findIndex((line) => line.startsWith('Müşteri toplamı'));
        expect(firstSummary).toBeGreaterThan(logs.length);
    });

    it('müşterisi çözülemeyen kaydı düşürmez, tutarını uydurmaz', () => {
        const client = makeClient('Acme', 1000);
        // Kayıt duruyor ama müşterisi bu cihazda henüz yok (senkron arası).
        const log = makeLog({ client, minutes: 60 });

        const csv = buildTimeCsv([log], EMPTY, t);

        expect(csv).toContain('Bilinmeyen müşteri');
        // Ücreti bilinmiyor: tutar ve para birimi boş kalır, 0 yazılmaz.
        expect(csv).not.toContain('Genel toplam;');
    });

    it('kayıtları en yeniden eskiye sıralar (ekranla aynı)', () => {
        const client = makeClient('Acme', 0);
        const eski = makeLog({ client, minutes: 60, startedAt: localIso(2026, 8, 10), note: 'eski' });
        const yeni = makeLog({ client, minutes: 60, startedAt: localIso(2026, 8, 17), note: 'yeni' });

        const csv = buildTimeCsv([eski, yeni], { ...EMPTY, clients: [client] }, t);

        expect(csv.indexOf('yeni')).toBeLessThan(csv.indexOf('eski'));
    });
});

describe('csvFileName', () => {
    it('filtre yokken sade bir ad döner', () => {
        expect(csvFileName({}, [])).toBe('time-logs.csv');
    });

    it('seçili müşterinin adını ekler', () => {
        const client = makeClient('Acme Ajans', 0);

        expect(csvFileName({ clientId: client.id }, [client])).toBe('time-logs-acme-ajans.csv');
    });

    it('Türkçe karakterleri ASCII karşılığına indirger', () => {
        const client = makeClient('Şirket Çözüm', 0);

        // Dosya adı işletim sistemleri ve indirme başlıkları arasında
        // dolaşıyor; ASCII dışı karakter bazı kurulumlarda bozuluyor.
        expect(csvFileName({ clientId: client.id }, [client])).toBe('time-logs-sirket-cozum.csv');
    });

    it('tarih aralığını ekler', () => {
        expect(csvFileName({ from: '2026-08-01', to: '2026-08-18' }, []))
            .toBe('time-logs-2026-08-01-2026-08-18.csv');
    });

    it('bilinmeyen müşteri id\'sini yok sayar', () => {
        expect(csvFileName({ clientId: 'yok' }, [])).toBe('time-logs.csv');
    });
});
