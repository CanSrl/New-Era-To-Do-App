/**
 * Teslim görünümünün gruplama mantığı.
 *
 * Saf fonksiyon olarak ayrı duruyor ki sıralama ve gruplama kuralları
 * arayüzden bağımsız sınanabilsin: "hangi görev hangi başlığın altında ve
 * hangi sırada" sorusu React render etmeden cevaplanabilmeli.
 */
import { describe, expect, it } from 'vitest';
import { filterForDelivery, groupForDelivery } from './grouping';
import { createClient } from '@/lib/clients';
import { createProject } from '@/lib/projects';
import type { Task } from '@/lib/types';

// `dueDate` opsiyoneldir (`string | undefined`), `null` atanamaz —
// tarihsiz görev alanı hiç taşımaz. `completedAt` istemci Task tipinde yok.
const task = (over: Partial<Task> & { id: string; title: string }): Task => ({
    priority: 'medium',
    categoryId: null, clientId: null, projectId: null,
    completed: false, position: 0,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
});

describe('groupForDelivery', () => {
    const acme = createClient('Acme', 0);
    const site = createProject(acme.id, 'Websitesi', 0);

    it('görevleri müşteri ve proje altında gruplar', () => {
        const groups = groupForDelivery(
            [task({ id: 't1', title: 'Logo', clientId: acme.id, projectId: site.id })],
            [acme], [site]
        );
        expect(groups[0].client?.name).toBe('Acme');
        expect(groups[0].projects[0].project?.name).toBe('Websitesi');
        expect(groups[0].projects[0].tasks[0].title).toBe('Logo');
    });

    it('projesiz görevler "Genel" grubuna (project null) düşer', () => {
        const groups = groupForDelivery(
            [task({ id: 't1', title: 'Telefon', clientId: acme.id })], [acme], [site]
        );
        expect(groups[0].projects[0].project).toBeNull();
    });

    it('müşterisiz görevler client null grubunda ve EN SONDA gelir', () => {
        const groups = groupForDelivery(
            [
                task({ id: 't1', title: 'Fatura' }),
                task({ id: 't2', title: 'Logo', clientId: acme.id }),
            ],
            [acme], [site]
        );
        expect(groups[groups.length - 1].client).toBeNull();
    });

    it('grup içinde görevleri teslim tarihine göre sıralar, tarihsizler sonda', () => {
        const groups = groupForDelivery(
            [
                task({ id: 't1', title: 'Tarihsiz', clientId: acme.id }),
                task({ id: 't2', title: 'Geç', clientId: acme.id, dueDate: '2026-08-20' }),
                task({ id: 't3', title: 'Erken', clientId: acme.id, dueDate: '2026-08-15' }),
            ],
            [acme], [site]
        );
        expect(groups[0].projects[0].tasks.map((t) => t.title))
            .toEqual(['Erken', 'Geç', 'Tarihsiz']);
    });

    it('arşivlenmiş müşteriyi gizler ama görevlerini müşterisiz gruba taşımaz', () => {
        const archived = { ...createClient('Eski', 1), archived: true };
        const groups = groupForDelivery(
            [task({ id: 't1', title: 'Eski iş', clientId: archived.id })], [archived], []
        );
        // Arşiv "gizle" demek, "görevi kaybet" demek değil: grup görünür kalır.
        expect(groups.some((g) => g.client?.id === archived.id)).toBe(true);
    });

    it('görevi olmayan müşteri için grup üretmez', () => {
        const groups = groupForDelivery([], [acme], [site]);
        expect(groups).toHaveLength(0);
    });

    // --- Şartnamede yazılı olmayan, ama davranışı belirsiz bırakan durumlar ---

    it('projesiz grup, projeli grupların ÖNÜNDE gelir', () => {
        const groups = groupForDelivery(
            [
                task({ id: 't1', title: 'Projeli', clientId: acme.id, projectId: site.id }),
                task({ id: 't2', title: 'Projesiz', clientId: acme.id }),
            ],
            [acme], [site]
        );
        expect(groups[0].projects[0].project).toBeNull();
        expect(groups[0].projects[1].project?.id).toBe(site.id);
    });

    it('müşterileri position sırasına göre dizer', () => {
        const ikinci = createClient('Beta', 1);
        const birinci = createClient('Alfa', 0);
        const groups = groupForDelivery(
            [
                task({ id: 't1', title: 'B işi', clientId: ikinci.id }),
                task({ id: 't2', title: 'A işi', clientId: birinci.id }),
            ],
            // Giriş sırası bilinçli olarak ters: sıralama position'dan gelmeli.
            [ikinci, birinci], []
        );
        expect(groups.map((g) => g.client?.name)).toEqual(['Alfa', 'Beta']);
    });

    it('aynı gün teslim edilecek görevleri position ile ayırır', () => {
        const groups = groupForDelivery(
            [
                task({ id: 't1', title: 'İkinci', clientId: acme.id, dueDate: '2026-08-15', position: 1 }),
                task({ id: 't2', title: 'Birinci', clientId: acme.id, dueDate: '2026-08-15', position: 0 }),
            ],
            [acme], []
        );
        expect(groups[0].projects[0].tasks.map((t) => t.title)).toEqual(['Birinci', 'İkinci']);
    });

    it('silinmiş müşteriye bağlı görevi müşterisiz gruba düşürür', () => {
        // Senkron turları arasında böyle bir ara durum oluşabilir: görevin
        // clientId'si duruyor ama müşteri listeden gitmiş. Görev kaybolmamalı.
        const groups = groupForDelivery(
            [task({ id: 't1', title: 'Yetim', clientId: 'olmayan-id' })], [], []
        );
        expect(groups).toHaveLength(1);
        expect(groups[0].client).toBeNull();
        expect(groups[0].projects[0].tasks[0].title).toBe('Yetim');
    });

    it('tamamlanmış görevleri de gruplar — filtreleme çağıranın işi', () => {
        const groups = groupForDelivery(
            [task({ id: 't1', title: 'Bitti', clientId: acme.id, completed: true })],
            [acme], []
        );
        expect(groups[0].projects[0].tasks).toHaveLength(1);
    });
});

describe('filterForDelivery', () => {
    const acme = createClient('Acme Ajans', 0);
    const site = createProject(acme.id, 'Websitesi', 0);
    const base = { clients: [acme], projects: [site] };

    it('durum filtresi görev listesindekiyle aynı anlama gelir', () => {
        const tasks = [
            task({ id: 't1', title: 'Açık' }),
            task({ id: 't2', title: 'Bitmiş', completed: true }),
        ];

        expect(filterForDelivery(tasks, { ...base, searchQuery: '', filter: 'active' }))
            .toHaveLength(1);
        expect(filterForDelivery(tasks, { ...base, searchQuery: '', filter: 'completed' })[0].title)
            .toBe('Bitmiş');
        expect(filterForDelivery(tasks, { ...base, searchQuery: '', filter: 'all' }))
            .toHaveLength(2);
    });

    it('arama görev başlığında eşleşir', () => {
        const result = filterForDelivery(
            [task({ id: 't1', title: 'Logo taslağı' }), task({ id: 't2', title: 'Fatura' })],
            { ...base, searchQuery: 'logo', filter: 'all' }
        );
        expect(result.map((t) => t.title)).toEqual(['Logo taslağı']);
    });

    it('arama MÜŞTERİ adında da eşleşir', () => {
        // Asıl fark bu: ekranın konusu müşteriye göre teslim, dolayısıyla
        // "Acme" yazan kullanıcı başlığında Acme geçmeyen görevleri de bekler.
        const result = filterForDelivery(
            [
                task({ id: 't1', title: 'Fatura kes', clientId: acme.id }),
                task({ id: 't2', title: 'Alakasız' }),
            ],
            { ...base, searchQuery: 'acme', filter: 'all' }
        );
        expect(result.map((t) => t.title)).toEqual(['Fatura kes']);
    });

    it('arama PROJE adında da eşleşir', () => {
        const result = filterForDelivery(
            [task({ id: 't1', title: 'Fatura kes', clientId: acme.id, projectId: site.id })],
            { ...base, searchQuery: 'websitesi', filter: 'all' }
        );
        expect(result).toHaveLength(1);
    });

    it('Türkçe büyük/küçük harf farkını doğru ele alır', () => {
        // 'I'/'ı' ve 'İ'/'i' çiftleri Türkçe'de İngilizce kurallarıyla
        // eşleşmez; toLowerCase() yerine toLocaleLowerCase('tr') gerekiyor.
        const isler = createClient('İŞLER', 1);
        const result = filterForDelivery(
            [task({ id: 't1', title: 'Bir şey', clientId: isler.id })],
            { clients: [isler], projects: [], searchQuery: 'işler', filter: 'all' }
        );
        expect(result).toHaveLength(1);
    });

    it('arama ve durum filtresi birlikte uygulanır', () => {
        const result = filterForDelivery(
            [
                task({ id: 't1', title: 'Logo', clientId: acme.id, completed: true }),
                task({ id: 't2', title: 'Logo v2', clientId: acme.id }),
            ],
            { ...base, searchQuery: 'acme', filter: 'active' }
        );
        expect(result.map((t) => t.title)).toEqual(['Logo v2']);
    });

    it('boş arama hiçbir görevi elemez', () => {
        const tasks = [task({ id: 't1', title: 'A' }), task({ id: 't2', title: 'B' })];
        expect(filterForDelivery(tasks, { ...base, searchQuery: '   ', filter: 'all' }))
            .toHaveLength(2);
    });
});
