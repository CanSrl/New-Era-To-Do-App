/**
 * Niş modülün birleştirme motoru — saf fonksiyon testleri.
 *
 * `mergeClients` / `mergeProjects` kuralları `mergeCategories` ile aynıdır;
 * buradaki asıl yük **bağ onarımı**: müşteri ve proje arasındaki üç sütunlu
 * yabancı anahtar, istemci tarafının veritabanıyla birebir aynı sonucu
 * üretmesini zorunlu kılıyor. İki taraf ayrışırsa senkron turunda görev
 * bağları geri dirilir.
 */
import { describe, expect, it } from 'vitest';
import type { Client, Project, Task } from './types';
import {
    mergeClients,
    mergeProjects,
    remapProjectClients,
    remapTaskLinks,
} from './sync-merge-niche';

const ISO = '2026-08-14T10:00:00.000Z';
const LATER = '2026-08-14T11:00:00.000Z';

function makeClient(over: Partial<Client> & { id: string }): Client {
    return {
        name: `Müşteri ${over.id}`,
        archived: false,
        position: 0,
        hourlyRate: 0,
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

function makeTask(over: Partial<Task> & { id: string }): Task {
    return {
        title: `Görev ${over.id}`,
        priority: 'medium',
        completed: false,
        categoryId: null,
        clientId: null,
        projectId: null,
        position: 0,
        createdAt: ISO,
        updatedAt: ISO,
        ...over,
    };
}

const noInput = { local: [], remote: [], dirtyIds: [], tombstones: [] };

describe('mergeClients', () => {
    it('yalnızca yerelde olan dirty müşteriyi gönderir', () => {
        const local = makeClient({ id: 'c1' });

        const plan = mergeClients({ ...noInput, local: [local], dirtyIds: ['c1'] });

        expect(plan.toPush).toEqual([local]);
        expect(plan.clients).toEqual([local]);
    });

    it('yalnızca yerelde olan dirty OLMAYAN müşteriyi cihazdan düşürür', () => {
        // Bir önceki turda senkronlanmıştı ve artık bulutta yok: başka cihazda
        // silinmiş demektir.
        const plan = mergeClients({ ...noInput, local: [makeClient({ id: 'c1' })] });

        expect(plan.clients).toEqual([]);
        expect(plan.toPush).toEqual([]);
    });

    it('yalnızca uzakta olan müşteriyi indirir', () => {
        const remote = makeClient({ id: 'c1' });

        const plan = mergeClients({ ...noInput, remote: [remote] });

        expect(plan.clients).toEqual([remote]);
    });

    it('çakışmada updatedAt yenisi kazanır', () => {
        const local = makeClient({ id: 'c1', name: 'Yerel', updatedAt: LATER });
        const remote = makeClient({ id: 'c1', name: 'Uzak', updatedAt: ISO });

        const plan = mergeClients({
            ...noInput, local: [local], remote: [remote], dirtyIds: ['c1'],
        });

        expect(plan.clients).toEqual([local]);
        expect(plan.toPush).toEqual([local]);
    });

    it('eşitlikte bulut kazanır ve yerel dirty bayrağı temizlenir', () => {
        // Bütün cihazlar aynı sonuca varsın diye. Dirty temizlenmezse kayıt
        // her turda yeniden denenip her seferinde kaybederek sonsuza dek
        // dirty kalırdı.
        const local = makeClient({ id: 'c1', name: 'Yerel' });
        const remote = makeClient({ id: 'c1', name: 'Uzak' });

        const plan = mergeClients({
            ...noInput, local: [local], remote: [remote], dirtyIds: ['c1'],
        });

        expect(plan.clients).toEqual([remote]);
        expect(plan.toPush).toEqual([]);
        expect(plan.discardedIds).toEqual(['c1']);
    });

    it('mezar taşı olan uzak müşteriyi silinecekler listesine alır', () => {
        const plan = mergeClients({
            ...noInput,
            remote: [makeClient({ id: 'c1' })],
            tombstones: [{ id: 'c1', deletedAt: ISO }],
        });

        expect(plan.toDelete).toEqual(['c1']);
        expect(plan.clients).toEqual([]);
    });

    it('bulutta karşılığı olmayan mezar taşını gereksiz sayar', () => {
        const plan = mergeClients({
            ...noInput, tombstones: [{ id: 'c1', deletedAt: ISO }],
        });

        expect(plan.obsoleteTombstoneIds).toEqual(['c1']);
        expect(plan.toDelete).toEqual([]);
    });

    describe('ada göre tekilleştirme', () => {
        it('aynı adlı yerel müşteriyi buluttakine katlar', () => {
            // Misafirken "Acme" oluşturup, zaten "Acme"si olan bir hesaba
            // giriş yapmak. İkisi de korunursa kullanıcı iki Acme görür.
            const plan = mergeClients({
                ...noInput,
                local: [makeClient({ id: 'c-yerel', name: 'Acme' })],
                remote: [makeClient({ id: 'c-bulut', name: 'Acme' })],
                dirtyIds: ['c-yerel'],
            });

            expect(plan.clients.map((c) => c.id)).toEqual(['c-bulut']);
            expect(plan.idRemap).toEqual({ 'c-yerel': 'c-bulut' });
            expect(plan.toPush).toEqual([]);
            expect(plan.discardedIds).toEqual(['c-yerel']);
        });

        it('ad karşılaştırması Türkçe büyük/küçük harfe duyarsızdır', () => {
            const plan = mergeClients({
                ...noInput,
                local: [makeClient({ id: 'c-yerel', name: 'İSTANBUL AJANS' })],
                remote: [makeClient({ id: 'c-bulut', name: 'istanbul ajans' })],
                dirtyIds: ['c-yerel'],
            });

            expect(plan.idRemap).toEqual({ 'c-yerel': 'c-bulut' });
        });

        it('id-si bulutta BULUNAN müşteriyi ada göre katlamaz', () => {
            // Kullanıcı bilinçli olarak iki müşteriye aynı adı vermiş olabilir;
            // bu bir çakışma değil, düzenlemedir.
            const local = makeClient({ id: 'c1', name: 'Acme', updatedAt: LATER });
            const plan = mergeClients({
                ...noInput,
                local: [local],
                remote: [makeClient({ id: 'c1', name: 'Eski' }), makeClient({ id: 'c2', name: 'Acme' })],
                dirtyIds: ['c1'],
            });

            expect(plan.idRemap).toEqual({});
            expect(plan.toPush).toEqual([local]);
        });

        it('bulutta aynı ad iki kez varsa ilk görülen hedef olur', () => {
            // Benzersizlik kısıtı yok, mümkün. Bütün cihazlar aynı hedefte
            // buluşsun diye kural belirlenmiş olmalı.
            const plan = mergeClients({
                ...noInput,
                local: [makeClient({ id: 'c-yerel', name: 'Acme' })],
                remote: [
                    makeClient({ id: 'c-bulut-1', name: 'Acme' }),
                    makeClient({ id: 'c-bulut-2', name: 'Acme' }),
                ],
                dirtyIds: ['c-yerel'],
            });

            expect(plan.idRemap).toEqual({ 'c-yerel': 'c-bulut-1' });
        });
    });
});

describe('mergeProjects', () => {
    it('yalnızca yerelde olan dirty projeyi gönderir', () => {
        const local = makeProject({ id: 'p1', clientId: 'c1' });

        const plan = mergeProjects({ ...noInput, local: [local], dirtyIds: ['p1'] });

        expect(plan.toPush).toEqual([local]);
    });

    it('çakışmada updatedAt yenisi kazanır', () => {
        const local = makeProject({ id: 'p1', clientId: 'c1', name: 'Yerel', updatedAt: LATER });
        const remote = makeProject({ id: 'p1', clientId: 'c1', name: 'Uzak' });

        const plan = mergeProjects({
            ...noInput, local: [local], remote: [remote], dirtyIds: ['p1'],
        });

        expect(plan.projects).toEqual([local]);
    });

    it('mezar taşı olan uzak projeyi silinecekler listesine alır', () => {
        const plan = mergeProjects({
            ...noInput,
            remote: [makeProject({ id: 'p1', clientId: 'c1' })],
            tombstones: [{ id: 'p1', deletedAt: ISO }],
        });

        expect(plan.toDelete).toEqual(['p1']);
    });

    describe('ada göre tekilleştirme', () => {
        it('aynı müşterideki aynı adlı projeyi buluttakine katlar', () => {
            const plan = mergeProjects({
                ...noInput,
                local: [makeProject({ id: 'p-yerel', clientId: 'c1', name: 'Websitesi' })],
                remote: [makeProject({ id: 'p-bulut', clientId: 'c1', name: 'Websitesi' })],
                dirtyIds: ['p-yerel'],
            });

            expect(plan.projects.map((p) => p.id)).toEqual(['p-bulut']);
            expect(plan.idRemap).toEqual({ 'p-yerel': 'p-bulut' });
            expect(plan.discardedIds).toEqual(['p-yerel']);
        });

        it('FARKLI müşterilerdeki aynı adlı projeleri katlamaz', () => {
            // Kapsam bilinçli olarak müşteriye göredir: iki müşterinin de
            // "Websitesi" projesi olması tamamen normaldir.
            const local = makeProject({ id: 'p-yerel', clientId: 'c1', name: 'Websitesi' });
            const plan = mergeProjects({
                ...noInput,
                local: [local],
                remote: [makeProject({ id: 'p-bulut', clientId: 'c2', name: 'Websitesi' })],
                dirtyIds: ['p-yerel'],
            });

            expect(plan.idRemap).toEqual({});
            expect(plan.toPush).toEqual([local]);
            expect(plan.projects.map((p) => p.id).sort()).toEqual(['p-bulut', 'p-yerel']);
        });
    });
});

describe('remapProjectClients', () => {
    it('tekilleştirilen müşteriye bağlı projeyi bulut id-sine taşır', () => {
        const local = makeProject({ id: 'p1', clientId: 'c-yerel' });

        const { projects } = remapProjectClients(
            [local],
            { 'c-yerel': 'c-bulut' },
            new Set(['c-bulut'])
        );

        expect(projects[0].clientId).toBe('c-bulut');
    });

    it('müşterisi kalmayan projeyi düşürür (cascade)', () => {
        // Veritabanında `on delete cascade`: müşteri silinince projeleri de
        // gider. İstemci tarafı aynı sonucu üretmezse proje bir sonraki turda
        // olmayan bir müşteriye bağlı olarak gönderilir ve 23503 alınır.
        const { projects, droppedIds } = remapProjectClients(
            [makeProject({ id: 'p1', clientId: 'c-silinmis' })],
            {},
            new Set(['c1'])
        );

        expect(projects).toEqual([]);
        expect(droppedIds).toEqual(['p1']);
    });

    it('düşen projelerin id-sini bildirir ki dirty bayrakları temizlensin', () => {
        // Bildirilmezse kayıt sonsuza dek "gönderilmeyi bekliyor" kalır ve
        // her turda hiç var olmayan bir şeyi göndermeye çalışırdı.
        const { droppedIds } = remapProjectClients(
            [
                makeProject({ id: 'p1', clientId: 'c-silinmis' }),
                makeProject({ id: 'p2', clientId: 'c1' }),
            ],
            {},
            new Set(['c1'])
        );

        expect(droppedIds).toEqual(['p1']);
    });

    it('değişmeyen projeyi aynı nesne olarak döner', () => {
        const project = makeProject({ id: 'p1', clientId: 'c1' });

        const { projects } = remapProjectClients([project], {}, new Set(['c1']));

        expect(projects[0]).toBe(project);
    });

    it('updatedAt damgasını ilerletmez', () => {
        // Bu bir kullanıcı düzenlemesi değil, bağ onarımı. Damgayı ilerletmek
        // aynı projeyi başka cihazda gerçekten düzenleyen kullanıcının
        // değişikliğini haksız yere yenerdi.
        const { projects } = remapProjectClients(
            [makeProject({ id: 'p1', clientId: 'c-yerel' })],
            { 'c-yerel': 'c-bulut' },
            new Set(['c-bulut'])
        );

        expect(projects[0].updatedAt).toBe(ISO);
    });
});

describe('remapTaskLinks', () => {
    const clients = new Set(['c1', 'c2']);
    const projects = new Map([
        ['p1', makeProject({ id: 'p1', clientId: 'c1' })],
        ['p2', makeProject({ id: 'p2', clientId: 'c2' })],
    ]);

    const remap = (tasks: Task[], clientIdRemap = {}, projectIdRemap = {}) =>
        remapTaskLinks(tasks, {
            clientIdRemap,
            projectIdRemap,
            validClientIds: clients,
            projectsById: projects,
        });

    it('bağsız görevi olduğu gibi bırakır', () => {
        const task = makeTask({ id: 't1' });

        expect(remap([task])[0]).toBe(task);
    });

    it('geçerli bağları koruyan görevi aynı nesne olarak döner', () => {
        const task = makeTask({ id: 't1', clientId: 'c1', projectId: 'p1' });

        expect(remap([task])[0]).toBe(task);
    });

    it('tekilleştirilen müşteriyi bulut id-sine taşır', () => {
        const task = makeTask({ id: 't1', clientId: 'c-yerel' });

        const [result] = remap([task], { 'c-yerel': 'c1' });

        expect(result.clientId).toBe('c1');
    });

    it('tekilleştirilen projeyi bulut id-sine taşır', () => {
        const task = makeTask({ id: 't1', clientId: 'c1', projectId: 'p-yerel' });

        const [result] = remap([task], {}, { 'p-yerel': 'p1' });

        expect(result.projectId).toBe('p1');
    });

    it('silinmiş müşteriye bağlı projesiz görevin bağını boşaltır', () => {
        // Veritabanındaki `clients_clear_tasks` tetikleyicisinin karşılığı.
        const task = makeTask({ id: 't1', clientId: 'c-silinmis' });

        const [result] = remap([task]);

        expect(result.clientId).toBeNull();
    });

    it('müşterisi ve projesi birlikte silinen görevin İKİ bağını da boşaltır', () => {
        // Müşteri silinince projeleri cascade ile gider; ikisi birden yok olur.
        // Yalnızca client_id boşaltılsaydı project_id dolu kalır ve şemadaki
        // `tasks_project_requires_client` kısıtı patlardı.
        const task = makeTask({ id: 't1', clientId: 'c-silinmis', projectId: 'p-silinmis' });

        const [result] = remap([task]);

        expect(result.clientId).toBeNull();
        expect(result.projectId).toBeNull();
    });

    it('projesi duran görev, eski müşterisi silinmiş olsa bile projeyi izler', () => {
        // İnce nokta: bu durum şemada imkânsızdır (üçlü FK engeller), yani
        // ancak şu sırayla oluşabilir — başka cihaz projeyi c2'ye TAŞIDI
        // (cascade görevin client_id'sini zaten c2 yaptı), SONRA eski
        // müşteriyi sildi (tetikleyicinin `where client_id = old.id` koşulu
        // artık tutmuyor). Veritabanının vardığı sonuç c2/p2'dir.
        //
        // Bağları körü körüne boşaltmak, kullanıcının hâlâ duran bir projeye
        // ait görevini sessizce "müşterisiz" yapardı.
        const task = makeTask({ id: 't1', clientId: 'c-silinmis', projectId: 'p2' });

        const [result] = remap([task]);

        expect(result.clientId).toBe('c2');
        expect(result.projectId).toBe('p2');
    });

    it('silinmiş projeye bağlı görevin yalnızca proje bağını koparır', () => {
        // `on delete set null (project_id)`: görev silinmez, müşteri bağı durur.
        const task = makeTask({ id: 't1', clientId: 'c1', projectId: 'p-silinmis' });

        const [result] = remap([task]);

        expect(result.projectId).toBeNull();
        expect(result.clientId).toBe('c1');
    });

    it('projesi başka müşteriye taşınmış görevi projenin peşinden götürür', () => {
        // `on update cascade`: projects.client_id değişirse bağlı görevlerin
        // client_id-si de otomatik taşınır. İstemci aynı şeyi yapmazsa görev
        // "c1 müşterisine bağlı ama projesi c2-nin" hâline düşer — bu satır
        // ŞEMADA imkânsız ve push 23503 ile reddedilirdi.
        const task = makeTask({ id: 't1', clientId: 'c1', projectId: 'p2' });

        const [result] = remap([task]);

        expect(result.clientId).toBe('c2');
        expect(result.projectId).toBe('p2');
    });

    it('müşterisi olmadan projeye bağlı görevi projenin müşterisine bağlar', () => {
        const task = makeTask({ id: 't1', clientId: null, projectId: 'p1' });

        const [result] = remap([task]);

        expect(result.clientId).toBe('c1');
        expect(result.projectId).toBe('p1');
    });

    it('updatedAt damgasını ilerletmez', () => {
        const task = makeTask({ id: 't1', clientId: 'c-silinmis', projectId: 'p1' });

        const [result] = remap([task]);

        expect(result.updatedAt).toBe(ISO);
    });
});
