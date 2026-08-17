import { describe, expect, it } from 'vitest';
import { clientToRow, projectToRow, rowToClient, rowToProject } from './niche-mapping';
import type { Client, Project } from './types';

const ISO = '2026-08-14T10:00:00.000Z';
const LATER = '2026-08-14T11:00:00.000Z';

const client: Client = {
    id: 'c1',
    name: 'Acme A.Ş.',
    archived: false,
    position: 3,
    hourlyRate: 1500,
    currency: 'TRY',
    createdAt: ISO,
    updatedAt: ISO,
};

const project: Project = {
    id: 'p1',
    clientId: 'c1',
    name: 'Websitesi',
    archived: false,
    position: 1,
    hourlyRate: null,
    currency: 'TRY',
    createdAt: ISO,
    updatedAt: ISO,
};

describe('clientToRow', () => {
    it('alan adlarını snake_case-e çevirir ve user_id ekler', () => {
        expect(clientToRow(client, 'user-1')).toEqual({
            id: 'c1',
            user_id: 'user-1',
            name: 'Acme A.Ş.',
            archived: false,
            position: 3,
            hourly_rate: 1500,
            currency: 'TRY',
            created_at: ISO,
            updated_at: ISO,
        });
    });
});

describe('rowToClient', () => {
    it('satırı yerel müşteriye çevirir', () => {
        const result = rowToClient({
            id: 'c1', user_id: 'user-1', name: 'Acme A.Ş.', archived: true,
            position: 3, hourly_rate: 1500, currency: 'TRY',
            created_at: ISO, updated_at: LATER,
        });

        expect(result).toEqual({
            id: 'c1',
            name: 'Acme A.Ş.',
            archived: true,
            position: 3,
            hourlyRate: 1500,
            currency: 'TRY',
            createdAt: ISO,
            updatedAt: LATER,
        });
    });

    it('sunucunun updated_at değerini korur', () => {
        // normalizeClient updatedAt-i createdAt-e düşürebilir; sunucu damgası
        // alınmazsa bir sonraki turda "uzak daha eski" sanılırdı.
        const result = rowToClient({
            id: 'c1', user_id: 'user-1', name: 'Acme', archived: false,
            position: 0, hourly_rate: 0, currency: 'TRY',
            created_at: ISO, updated_at: LATER,
        });

        expect(result.updatedAt).toBe(LATER);
    });

    it('adı boş bir satırda bile çökmez', () => {
        // Veritabanı kısıtı bunu engelliyor; yine de tek bozuk satır listeyi
        // çökertmemeli.
        const result = rowToClient({
            id: 'c1', user_id: 'user-1', name: '', archived: false,
            position: 0, hourly_rate: 0, currency: 'TRY',
            created_at: ISO, updated_at: ISO,
        });

        expect(result.id).toBe('c1');
        expect(result.name).toBeTruthy();
    });
});

describe('projectToRow', () => {
    it('client_id dahil bütün alanları çevirir', () => {
        expect(projectToRow(project, 'user-1')).toEqual({
            id: 'p1',
            user_id: 'user-1',
            client_id: 'c1',
            name: 'Websitesi',
            archived: false,
            position: 1,
            hourly_rate: null,
            created_at: ISO,
            updated_at: ISO,
        });
    });
});

describe('rowToProject', () => {
    it('satırı yerel projeye çevirir', () => {
        const result = rowToProject({
            id: 'p1', user_id: 'user-1', client_id: 'c1', name: 'Websitesi',
            archived: false, position: 1, hourly_rate: null,
            created_at: ISO, updated_at: LATER,
        });

        expect(result).toEqual({
            id: 'p1',
            clientId: 'c1',
            name: 'Websitesi',
            archived: false,
            position: 1,
            hourlyRate: null,
            currency: 'TRY',
            createdAt: ISO,
            updatedAt: LATER,
        });
    });

    it('adı boş bir satırda bile müşteri bağını korur', () => {
        // Bağ kaybolursa proje şemada imkânsız bir hâle (müşterisiz proje)
        // düşer ve bir sonraki push 23502 ile reddedilirdi.
        const result = rowToProject({
            id: 'p1', user_id: 'user-1', client_id: 'c1', name: '',
            archived: false, position: 0, hourly_rate: null,
            created_at: ISO, updated_at: ISO,
        });

        expect(result.clientId).toBe('c1');
        expect(result.name).toBeTruthy();
    });
});
