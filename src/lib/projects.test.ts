import { describe, expect, it } from 'vitest';
import {
    PROJECT_NAME_MAX,
    createProject,
    isProjectNameTaken,
    nextProjectPosition,
    normalizeProject,
    projectsByClient,
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
