import type { TFunction } from 'i18next';
import type { Client, Project, Task, TimeLog } from '@/lib/types';
import { amountFor, effectiveRate } from '@/lib/time-logs';
import { byStartedAtDesc, groupTotals, sumByCurrency, type TimeLogFilter } from './totals';

/** CSV'ye yazılacak kayıtların bağlarını çözmek için gereken listeler. */
export interface CsvSources {
    clients: readonly Client[];
    projects: readonly Project[];
    tasks: readonly Task[];
}

/**
 * Excel'in Türkçe kurulumu için gereken bayt sırası işareti.
 *
 * Olmadan dosya ANSI sanılır ve "Müşteri" gibi başlıklar bozuk görünür —
 * dışa aktarımın en sık bildirilen hatası budur ve kullanıcı bunu kendi
 * verisinin bozulması sanır.
 */
const BOM = '﻿';

/**
 * Ayraç noktalı virgüldür, virgül değil.
 *
 * Excel'in Türkçe yerelliğinde liste ayracı ";"; virgülle üretilen dosya tek
 * sütuna sıkışır. Aynı yerellik ondalık ayracı da virgül yaptığı için sayılar
 * `1,5` biçiminde yazılır — ikisi birlikte değişmek zorunda.
 */
const DELIMITER = ';';

/** Boş hücre; okunurluk için adlandırıldı (satırlar 9 sütun geniş). */
const EMPTY_CELL = '';

/**
 * Alıntılama gerektiren karakterler: ayraç, tırnak ve satır sonları.
 * Ayraçtan türetilir — `DELIMITER` değişirse kaçış kuralı da değişmeli.
 */
const NEEDS_QUOTES = new RegExp(`["\\r\\n${DELIMITER}]`);

/**
 * RFC 4180 alıntılaması: ayraç/tırnak/satır sonu içeren hücre tırnaklanır ve
 * içindeki tırnaklar ikilenir.
 *
 * ⚠️ Bu iş başta `papaparse` ile yapılıyordu ve kütüphane **çıkarıldı**:
 * papaparse yan etkili bir modül olduğu için tree-shaking onu atamıyor,
 * `VITE_NICHE_MODULE=false` derlemesinde bile pakette kalıyordu (ölçüldü:
 * `BAD_DELIMITERS`, `RECORD_SEP`) — dinamik import bile parçayı üretmeye
 * devam etti. "Niş modül izsiz çıkar" sözü, üretilen tek satırlık bir kaçış
 * kuralından daha değerli.
 */
function escapeCell(value: string): string {
    return NEEDS_QUOTES.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Satırları CSV metnine çevirir. Satır sonu CRLF: Excel'in beklediği biçim. */
function toCsv(rows: readonly string[][]): string {
    return rows.map((row) => row.map(escapeCell).join(DELIMITER)).join('\r\n');
}

/**
 * ISO damganın **yerel** gün ve saati, 'YYYY-MM-DD HH:mm'.
 *
 * `totals.ts`'teki `localDateOf` ile aynı kural: damgayı `slice` ile kesmek
 * UTC gününü verir ve UTC+3'te gece yarısından sonra girilen kayıt raporda
 * bir önceki güne düşerdi. Ekranda ne görüldüyse dosyada da o yazmalı.
 */
function localStamp(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return EMPTY_CELL;

    const pad = (value: number) => String(value).padStart(2, '0');

    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

/**
 * Dakikayı ondalık saate çevirir: 90 → `1,5`.
 *
 * Faturalama saat üzerinden yapılır; "1 sa 30 dk" metni hücrede toplanamaz.
 * Gereksiz sıfırlar atılır (`1,5`, `1,50` değil) ama ondalık ayraç virgüldür.
 */
function formatHours(minutes: number): string {
    return String(Number((minutes / 60).toFixed(2))).replace('.', ',');
}

/** Para değeri her zaman iki basamak: fatura kuruşu yuvarlamaz. */
function formatMoney(amount: number): string {
    return amount.toFixed(2).replace('.', ',');
}

function headerRow(t: TFunction): string[] {
    return [
        t('time.csv.date'),
        t('time.csv.client'),
        t('time.csv.project'),
        t('time.csv.task'),
        t('time.csv.note'),
        t('time.csv.hours'),
        t('time.csv.rate'),
        t('time.csv.amount'),
        t('time.csv.currency'),
    ];
}

/**
 * Filtrelenmiş kayıtları CSV metnine çevirir.
 *
 * Saf fonksiyon: filtreleme çağıranın işidir (`filterLogs`) ve başlıklar
 * `t` ile dışarıdan gelir — saf katman hazır metin üretmez. Kayıtlar
 * ekrandaki sırayla (en yeni başta) yazılır; farklı sıralamak "ekranda ne
 * görüyorsan onu aktarırsın" sözünü bozardı.
 *
 * Sonda müşteri → proje ve para birimi başına özet satırları bulunur.
 */
export function buildTimeCsv(
    logs: readonly TimeLog[],
    sources: CsvSources,
    t: TFunction
): string {
    const clientById = new Map(sources.clients.map((client) => [client.id, client]));
    const projectById = new Map(sources.projects.map((project) => [project.id, project]));
    const taskById = new Map(sources.tasks.map((task) => [task.id, task]));

    const rows: string[][] = [headerRow(t)];

    for (const log of [...logs].sort(byStartedAtDesc)) {
        const client = clientById.get(log.clientId);
        const project = log.projectId ? projectById.get(log.projectId) : undefined;
        const task = log.taskId ? taskById.get(log.taskId) : undefined;

        rows.push([
            localStamp(log.startedAt),
            client?.name ?? t('time.unknownClient'),
            project?.name ?? EMPTY_CELL,
            task?.title ?? EMPTY_CELL,
            log.note ?? EMPTY_CELL,
            formatHours(log.durationMinutes),
            /*
             * Müşterisi çözülemeyen kayıt DÜŞÜRÜLMEZ ama tutarı uydurulmaz:
             * ücret bilinmediği için para sütunları boş kalır. 0 yazmak
             * "bu iş ücretsizdi" gibi okunur ve faturayı eksiltirdi.
             */
            client ? formatMoney(effectiveRate(client, project)) : EMPTY_CELL,
            client ? formatMoney(amountFor(log, client, project)) : EMPTY_CELL,
            client?.currency ?? EMPTY_CELL,
        ]);
    }

    if (logs.length > 0) {
        rows.push([]);
        rows.push(...summaryRows(logs, sources, t));
    }

    return BOM + toCsv(rows);
}

/**
 * Özet blok: her müşteri için toplam, altında projeleri, en sonda para birimi
 * başına genel toplam.
 *
 * Ekrandaki `groupTotals`/`sumByCurrency` ile **aynı** fonksiyonlardan türer;
 * ayrı bir toplama mantığı yazmak, ekranla dosyanın farklı sayılar
 * göstermesine açık kapı bırakırdı. Etiket ilk sütunda durur, böylece dosya
 * hem gözle hem formülle ayrıştırılabilir.
 */
function summaryRows(
    logs: readonly TimeLog[],
    sources: CsvSources,
    t: TFunction
): string[][] {
    const totals = groupTotals(logs, sources.clients, sources.projects);
    const rows: string[][] = [];

    for (const total of totals) {
        const clientName = total.client?.name ?? t('time.unknownClient');

        rows.push([
            t('time.csv.clientTotal'),
            clientName,
            EMPTY_CELL,
            EMPTY_CELL,
            EMPTY_CELL,
            formatHours(total.minutes),
            EMPTY_CELL,
            total.currency ? formatMoney(total.amount) : EMPTY_CELL,
            total.currency ?? EMPTY_CELL,
        ]);

        for (const group of total.projects) {
            rows.push([
                t('time.csv.projectTotal'),
                clientName,
                group.project?.name ?? t('time.projectNone'),
                EMPTY_CELL,
                EMPTY_CELL,
                formatHours(group.minutes),
                EMPTY_CELL,
                total.currency ? formatMoney(group.amount) : EMPTY_CELL,
                total.currency ?? EMPTY_CELL,
            ]);
        }
    }

    /*
     * Kur dönüşümü yok: genel toplam para birimi BAŞINA verilir. Tek bir
     * sayıya indirgemek, hangi kurdan çevrildiği belirsiz olduğu için
     * faturaya esas alınamaz (ekrandaki kararın aynısı).
     */
    for (const total of sumByCurrency(totals)) {
        rows.push([
            t('time.csv.grandTotal'),
            EMPTY_CELL,
            EMPTY_CELL,
            EMPTY_CELL,
            EMPTY_CELL,
            formatHours(total.minutes),
            EMPTY_CELL,
            formatMoney(total.amount),
            total.currency,
        ]);
    }

    return rows;
}

/** Türkçe harfler ASCII karşılığına indirgenir; aksanlılar NFD ile ayıklanır. */
const TURKISH_ASCII: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
};

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[çğıöşü]/g, (char) => TURKISH_ASCII[char] ?? char)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * İndirilecek dosyanın adı; ekrandaki filtreyi yansıtır.
 *
 * Kullanıcı arka arkaya birkaç dışa aktarım yapıyor ve hepsi aynı adla
 * inseydi "(1)", "(2)" ekleriyle hangisinin hangi aralık olduğu kaybolurdu.
 * Ad dile bağlı değildir: dosya adları depodaki yol kuralıyla İngilizce.
 */
export function csvFileName(filter: TimeLogFilter, clients: readonly Client[]): string {
    const client = filter.clientId
        ? clients.find((candidate) => candidate.id === filter.clientId)
        : undefined;

    const parts = ['time-logs', client ? slugify(client.name) : '', filter.from ?? '', filter.to ?? ''];

    return `${parts.filter(Boolean).join('-')}.csv`;
}
