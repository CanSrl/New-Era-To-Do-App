import type { Client, FilterStatus, Project, Task } from '@/lib/types';
import { byClientPosition } from '@/lib/clients';
import { byProjectPosition } from '@/lib/projects';

/**
 * Teslim görünümünün veri şekli: müşteri → proje → görevler.
 *
 * `client: null` müşterisiz görevleri, `project: null` ise bir müşterinin
 * projeye bağlanmamış görevlerini taşır. İkisi de gerçek bir durum, hata
 * değil: müşteri ve proje bağları opsiyoneldir.
 */
export interface DeliveryProjectGroup {
    project: Project | null;
    tasks: Task[];
}

export interface DeliveryGroup {
    client: Client | null;
    projects: DeliveryProjectGroup[];
}

/**
 * Teslim görünümünün filtresi.
 *
 * Durum filtresi (`all`/`active`/`completed`) görev listesindekiyle **birebir
 * aynı** anlama gelir; kullanıcı iki ekran arasında geçerken kuralın
 * değişmesi kafa karıştırırdı.
 *
 * Arama ise burada daha geniş: görev başlığı ve açıklamasının yanında
 * **müşteri ve proje adında** da eşleşir. Ekranın konusu müşteriye göre teslim
 * olduğu için "Acme" yazan kullanıcı o müşterinin işlerini görmeyi bekler;
 * yalnızca başlıkta arasaydık, başlığında "Acme" geçmeyen görevler
 * gizlenirdi.
 */
export function filterForDelivery(
    tasks: readonly Task[],
    options: {
        searchQuery: string;
        filter: FilterStatus;
        clients: readonly Client[];
        projects: readonly Project[];
    }
): Task[] {
    const { searchQuery, filter, clients, projects } = options;
    const needle = searchQuery.trim().toLocaleLowerCase('tr');

    const clientNameById = new Map(clients.map((c) => [c.id, c.name.toLocaleLowerCase('tr')]));
    const projectNameById = new Map(projects.map((p) => [p.id, p.name.toLocaleLowerCase('tr')]));

    return tasks.filter((task) => {
        if (filter === 'active' && task.completed) return false;
        if (filter === 'completed' && !task.completed) return false;
        if (!needle) return true;

        const haystack = [
            task.title,
            task.description ?? '',
        ].map((value) => value.toLocaleLowerCase('tr'));

        if (task.clientId) haystack.push(clientNameById.get(task.clientId) ?? '');
        if (task.projectId) haystack.push(projectNameById.get(task.projectId) ?? '');

        return haystack.some((value) => value.includes(needle));
    });
}

/**
 * Görevleri teslim odaklı okumak için yeniden gruplar.
 *
 * Saf fonksiyon: yeni sorgu yok, store'daki mevcut diziler yeniden düzenlenir.
 * Filtreleme (tamamlandı/aktif, arama) çağıranın işidir — buraya verilen liste
 * ne ise o gruplanır. Böylece mevcut `FilterBar` ve arama kutusu olduğu gibi
 * çalışır ve bu dosya onların semantiğini tekrar etmez.
 *
 * Kurallar:
 * - Müşteriler `position` sırasında; müşterisiz grup **en sonda**. Sondadır
 *   çünkü ekranın konusu müşteriye göre teslim; bağsız işler artık kalemi.
 * - Her müşteri içinde projesiz grup **başta** (arayüzde "Projesiz"), sonra
 *   projeler `position` sırasında. Projesiz iş çoğunlukla "hemen bakılacak"
 *   olan taraftır.
 * - Görevler `dueDate` artan; tarihsizler **sonda**, kendi aralarında
 *   `position`. Aynı tarihe düşenler de `position` ile ayrılır, yoksa sıra
 *   render'dan render'a oynardı.
 * - Görevi olmayan müşteri ya da proje için grup üretilmez — boş başlık
 *   ekranı doldurur, bilgi vermez.
 * - Arşivlenmiş müşteri **gizlenmez**: görevi varsa grubu görünür kalır.
 *   Arşivin işi seçicileri sadeleştirmek, geçmiş işi saklamak değil.
 * - Var olmayan bir müşteriye/projeye bağlı görev sessizce kaybolmaz;
 *   müşterisiz/projesiz gruba düşer. Senkron turları arasında bu ara durum
 *   gerçekten oluşabiliyor.
 */
export function groupForDelivery(
    tasks: readonly Task[],
    clients: readonly Client[],
    projects: readonly Project[]
): DeliveryGroup[] {
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const projectById = new Map(projects.map((p) => [p.id, p]));

    // Görevi olan müşteriler; anahtar olarak '' müşterisiz grubu temsil eder.
    const byClient = new Map<string, Map<string, Task[]>>();

    for (const task of tasks) {
        // Bağ bir kayda çözülemiyorsa bağsız sayılır.
        const clientKey = task.clientId && clientById.has(task.clientId) ? task.clientId : '';
        const projectKey = task.projectId && projectById.has(task.projectId) ? task.projectId : '';

        let projectGroups = byClient.get(clientKey);
        if (!projectGroups) {
            projectGroups = new Map();
            byClient.set(clientKey, projectGroups);
        }

        const bucket = projectGroups.get(projectKey);
        if (bucket) bucket.push(task);
        else projectGroups.set(projectKey, [task]);
    }

    const groups: DeliveryGroup[] = [];

    const named = [...byClient.keys()]
        .filter((key) => key !== '')
        .map((key) => clientById.get(key)!)
        .sort(byClientPosition);

    for (const client of named) {
        groups.push({
            client,
            projects: buildProjectGroups(byClient.get(client.id)!, projectById),
        });
    }

    // Müşterisiz grup her zaman en sonda.
    const orphan = byClient.get('');
    if (orphan) {
        groups.push({ client: null, projects: buildProjectGroups(orphan, projectById) });
    }

    return groups;
}

function buildProjectGroups(
    projectGroups: Map<string, Task[]>,
    projectById: Map<string, Project>
): DeliveryProjectGroup[] {
    const result: DeliveryProjectGroup[] = [];

    // Projesiz grup başta.
    const unassigned = projectGroups.get('');
    if (unassigned) {
        result.push({ project: null, tasks: [...unassigned].sort(byDueDate) });
    }

    const named = [...projectGroups.keys()]
        .filter((key) => key !== '')
        .map((key) => projectById.get(key)!)
        .sort(byProjectPosition);

    for (const project of named) {
        result.push({
            project,
            tasks: [...projectGroups.get(project.id)!].sort(byDueDate),
        });
    }

    return result;
}

/**
 * Teslim tarihine göre artan; tarihsizler sonda, eşitlikte `position`.
 *
 * `dueDate` 'YYYY-MM-DD' biçiminde olduğu için metin karşılaştırması tarih
 * karşılaştırmasıyla aynı sonucu verir — Date nesnesi üretmeye gerek yok ve
 * saat dilimi sorunu da doğmaz.
 */
function byDueDate(a: Task, b: Task): number {
    if (a.dueDate && b.dueDate) {
        if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
        return a.position - b.position;
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.position - b.position;
}
