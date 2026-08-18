import type { Client, Project, TimeLog } from '@/lib/types';
import { byClientPosition } from '@/lib/clients';
import { byProjectPosition } from '@/lib/projects';
import { amountFor } from '@/lib/time-logs';

/**
 * Zaman ekranının veri şekli: müşteri → proje → toplam.
 *
 * `client: null` müşterisi çözülemeyen kayıtları taşır. Bu gerçek bir ara
 * durum: senkron turları arasında bir kayıt, cihazda henüz olmayan bir
 * müşteriye işaret edebilir. Kaydı düşürmek kullanıcının verisini sessizce yok
 * etmek olurdu (`groupForDelivery` de aynı kararı veriyor); ücreti bilinmediği
 * için tutar 0 ve para birimi `null` kalır — uydurulmaz.
 */
export interface ProjectTotal {
    project: Project | null;
    minutes: number;
    amount: number;
    logs: TimeLog[];
}

export interface ClientTotal {
    client: Client | null;
    /** Müşterinin para birimi; müşteri çözülemiyorsa `null`. */
    currency: string | null;
    minutes: number;
    amount: number;
    projects: ProjectTotal[];
}

export interface CurrencyTotal {
    currency: string;
    minutes: number;
    amount: number;
}

/** Zaman ekranının ve CSV dışa aktarımının ortak filtresi. */
export interface TimeLogFilter {
    clientId?: string;
    projectId?: string;
    /** Yerel takvim günü, 'YYYY-MM-DD'. Aralık her iki ucu da kapsar. */
    from?: string;
    to?: string;
}

/**
 * ISO damgasının **yerel** takvim günü, 'YYYY-MM-DD'.
 *
 * Damgayı `slice(0, 10)` ile kesmek UTC gününü verirdi ve UTC+3'te gece
 * yarısından sonra girilen bir kayıt bir önceki güne düşerdi: kullanıcı 17
 * Ağustos gecesi çalıştığını bilir, raporda 16 Ağustos'ta görürdü. `dueDate`
 * alanındaki "takvim tarihi, an değil" kararının aynısı.
 */
function localDateOf(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Kayıtları filtreler. Ekran ve CSV **aynı** fonksiyonu kullanır: kullanıcı
 * ekranda ne görüyorsa onu dışa aktarır, iki ayrı filtre mantığı ayrışamaz.
 *
 * Boş metinli alanlar yok sayılır; `<select>` ve `<input type="date">` seçim
 * temizlendiğinde `''` döndürüyor ve bu "filtre yok" demek.
 */
export function filterLogs(logs: readonly TimeLog[], filter: TimeLogFilter): TimeLog[] {
    const { clientId, projectId, from, to } = filter;

    return logs.filter((log) => {
        if (clientId && log.clientId !== clientId) return false;
        // Proje filtresi tek başına anlamlıdır: proje zaten tek bir müşteriye
        // ait, müşteriyi ayrıca seçmeye zorlamak gereksiz bir adım olurdu.
        if (projectId && log.projectId !== projectId) return false;

        if (from || to) {
            const day = localDateOf(log.startedAt);
            if (from && day < from) return false;
            if (to && day > to) return false;
        }

        return true;
    });
}

/**
 * En yeni kayıt başta. Eşit damgada `id` ile ayrılır: kararlı olmayan bir
 * sıralama, aynı anda girilen iki kaydın yerini render'dan render'a
 * değiştirirdi.
 */
export function byStartedAtDesc(a: TimeLog, b: TimeLog): number {
    if (a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? 1 : -1;
    return a.id.localeCompare(b.id);
}

/**
 * Kayıtları müşteri → proje kırılımında toplar.
 *
 * Saf fonksiyon; filtreleme çağıranın işidir (`filterLogs`). Kurallar
 * `groupForDelivery` ile bilinçli olarak aynı: müşteriler `position`
 * sırasında, bağsız grup en sonda, her müşteride projesiz grup başta, kaydı
 * olmayan müşteri için grup üretilmez. İki ekranın aynı veriyi farklı sırada
 * göstermesi kullanıcıyı yanıltırdı.
 *
 * Tutar saklanmaz, her okumada `amountFor` ile hesaplanır: ücret değişince
 * geçmiş kayıtların tutarı da güncel ücretten türesin diye (spec §1.2).
 */
export function groupTotals(
    logs: readonly TimeLog[],
    clients: readonly Client[],
    projects: readonly Project[]
): ClientTotal[] {
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const projectById = new Map(projects.map((p) => [p.id, p]));

    // Anahtar olarak '' müşterisi çözülemeyen grubu temsil eder.
    const byClient = new Map<string, Map<string, TimeLog[]>>();

    for (const log of logs) {
        const clientKey = clientById.has(log.clientId) ? log.clientId : '';
        const projectKey = log.projectId && projectById.has(log.projectId) ? log.projectId : '';

        let projectGroups = byClient.get(clientKey);
        if (!projectGroups) {
            projectGroups = new Map();
            byClient.set(clientKey, projectGroups);
        }

        const bucket = projectGroups.get(projectKey);
        if (bucket) bucket.push(log);
        else projectGroups.set(projectKey, [log]);
    }

    const totals: ClientTotal[] = [];

    const named = [...byClient.keys()]
        .filter((key) => key !== '')
        .map((key) => clientById.get(key)!)
        .sort(byClientPosition);

    for (const client of named) {
        totals.push(buildClientTotal(client, byClient.get(client.id)!, projectById));
    }

    const orphan = byClient.get('');
    if (orphan) totals.push(buildClientTotal(null, orphan, projectById));

    return totals;
}

function buildClientTotal(
    client: Client | null,
    projectGroups: Map<string, TimeLog[]>,
    projectById: Map<string, Project>
): ClientTotal {
    const groups: ProjectTotal[] = [];

    // Projesiz grup başta.
    const unassigned = projectGroups.get('');
    if (unassigned) groups.push(buildProjectTotal(null, unassigned, client));

    const named = [...projectGroups.keys()]
        .filter((key) => key !== '')
        .map((key) => projectById.get(key)!)
        .sort(byProjectPosition);

    for (const project of named) {
        groups.push(buildProjectTotal(project, projectGroups.get(project.id)!, client));
    }

    return {
        client,
        currency: client?.currency ?? null,
        minutes: groups.reduce((total, group) => total + group.minutes, 0),
        amount: groups.reduce((total, group) => total + group.amount, 0),
        projects: groups,
    };
}

function buildProjectTotal(
    project: Project | null,
    logs: TimeLog[],
    client: Client | null
): ProjectTotal {
    return {
        project,
        minutes: logs.reduce((total, log) => total + log.durationMinutes, 0),
        // Müşteri çözülemiyorsa ücret de bilinemez: tutar uydurulmaz, 0 kalır.
        amount: client
            ? logs.reduce((total, log) => total + amountFor(log, client, project), 0)
            : 0,
        logs: [...logs].sort(byStartedAtDesc),
    };
}

/**
 * Para birimi başına genel toplam.
 *
 * Kur dönüşümü YOK ve olmayacak: 1000 TL ile 100 USD'yi toplayan tek bir sayı,
 * hangi kuru kullandığı belirsiz olduğu için faturaya esas alınamaz. Para
 * birimi bilinmeyen (müşterisi çözülemeyen) kayıtlar hiçbir toplama girmez.
 */
export function sumByCurrency(totals: readonly ClientTotal[]): CurrencyTotal[] {
    const byCurrency = new Map<string, CurrencyTotal>();

    for (const total of totals) {
        if (!total.currency) continue;

        const existing = byCurrency.get(total.currency);
        if (existing) {
            existing.minutes += total.minutes;
            existing.amount += total.amount;
        } else {
            byCurrency.set(total.currency, {
                currency: total.currency,
                minutes: total.minutes,
                amount: total.amount,
            });
        }
    }

    return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
