/**
 * Repository katmanının **sayfalama** davranışı.
 *
 * Neden ayrı bir dosya: PostgREST tek yanıtta en fazla 1000 satır döndürür ve
 * bu sınır sessizdir — 1000 satır dönen bir yanıttan "hepsi bu" mu yoksa
 * "kırpıldı" mı olduğu anlaşılmaz. Kırpılma burada zararsız değil: senkron tam
 * anlık görüntü karşılaştırması yapıyor, yani 1000'inci satırdan sonrası
 * "uzakta yok" sayılır ve birleştirme motoru onları **yerelden siler**.
 * Kullanıcı için sonuç sessiz veri kaybıdır.
 *
 * Buradaki testler o yüzden istek aralıklarını doğrudan sınıyor.
 *
 * Eşleme katmanı taklit ediliyor: sınanan şey satırın Task'e çevrilmesi değil,
 * kaç istek yapıldığı ve hangi aralıklarla yapıldığı.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type RangeCall = { table: string; from: number; to: number };

const state = vi.hoisted(() => ({
    rows: [] as unknown[],
    calls: [] as RangeCall[],
    error: null as { message: string } | null,
}));

vi.mock('./supabase', () => ({
    isSupabaseConfigured: true,
    supabase: {
        from(table: string) {
            return {
                select: () => ({
                    order: () => ({
                        range: (from: number, to: number) => {
                            state.calls.push({ table, from, to });
                            if (state.error) {
                                return Promise.resolve({ data: null, error: state.error });
                            }
                            // Gerçek PostgREST gibi: aralık kadarını döndür.
                            return Promise.resolve({
                                data: state.rows.slice(from, to + 1),
                                error: null,
                            });
                        },
                    }),
                }),
            };
        },
    },
}));

// Eşleme fonksiyonları kimlik fonksiyonuna indirgeniyor.
vi.mock('./task-mapping', () => ({
    rowToTask: (row: unknown) => row,
    taskToRow: (row: unknown) => row,
}));
vi.mock('./category-mapping', () => ({
    rowToCategory: (row: unknown) => row,
    categoryToRow: (row: unknown) => row,
}));
vi.mock('./niche-mapping', () => ({
    rowToClient: (row: unknown) => row,
    rowToProject: (row: unknown) => row,
    clientToRow: (row: unknown) => row,
    projectToRow: (row: unknown) => row,
}));

const { fetchRemoteTasks, SyncTooLargeError } = await import('./task-repository');

/** `n` adet ayırt edilebilir sahte satır. */
function makeRows(n: number): { id: string }[] {
    return Array.from({ length: n }, (_, i) => ({ id: `satir-${i}` }));
}

beforeEach(() => {
    state.rows = [];
    state.calls = [];
    state.error = null;
});

describe('fetchRemoteTasks — sayfalama', () => {
    it('tek sayfaya sığan veriyi tek istekte çeker', async () => {
        state.rows = makeRows(42);

        const result = await fetchRemoteTasks();

        expect(result).toHaveLength(42);
        expect(state.calls).toEqual([{ table: 'tasks', from: 0, to: 999 }]);
    });

    it('1000 satırı aşan veriyi sayfa sayfa çeker ve BİRLEŞTİRİR', async () => {
        state.rows = makeRows(1500);

        const result = await fetchRemoteTasks();

        // Asıl mesele bu: eskiden 1000 satır dönerdi ve kalan 500 görev
        // "uzakta silinmiş" sayılıp yerelden de silinirdi.
        expect(result).toHaveLength(1500);
        expect(state.calls).toEqual([
            { table: 'tasks', from: 0, to: 999 },
            { table: 'tasks', from: 1000, to: 1999 },
        ]);
    });

    it('satır sayısı tam sayfa katıysa boş bir sayfa daha isteyip durur', async () => {
        state.rows = makeRows(2000);

        const result = await fetchRemoteTasks();

        // Dolu sayfa "devamı olabilir" demektir; son sayfa ancak boş (ya da
        // eksik) gelince anlaşılır.
        expect(result).toHaveLength(2000);
        expect(state.calls).toHaveLength(3);
        expect(state.calls[2]).toEqual({ table: 'tasks', from: 2000, to: 2999 });
    });

    it('sayfalar arası sıralama bozulmadan birleşir', async () => {
        state.rows = makeRows(1200);

        const result = await fetchRemoteTasks() as { id: string }[];

        expect(result[0].id).toBe('satir-0');
        expect(result[999].id).toBe('satir-999');
        expect(result[1000].id).toBe('satir-1000');
        expect(result[1199].id).toBe('satir-1199');
    });
});

describe('fetchRemoteTasks — emniyet tavanı', () => {
    it('tavanı aşan veride sessizce kırpmak yerine SyncTooLargeError atar', async () => {
        state.rows = makeRows(10_500);

        await expect(fetchRemoteTasks()).rejects.toThrow(SyncTooLargeError);
    });

    it('atılan hata hangi tablonun taştığını söyler', async () => {
        state.rows = makeRows(10_500);

        await expect(fetchRemoteTasks()).rejects.toMatchObject({ table: 'tasks' });
    });

    it('tavana dayanmadan önce yapılan istekleri boşa harcamaz', async () => {
        state.rows = makeRows(10_500);

        await expect(fetchRemoteTasks()).rejects.toThrow();

        // 10 sayfa çekilir (0..9999), 11. istek yapılmadan tavan devreye girer.
        expect(state.calls).toHaveLength(10);
    });
});

describe('fetchRemoteTasks — hata yolu', () => {
    it('PostgREST hatasını Error olarak yükseltir', async () => {
        state.error = { message: 'permission denied for table tasks' };

        await expect(fetchRemoteTasks()).rejects.toThrow('permission denied for table tasks');
    });

    it('hata alınca sonraki sayfayı istemez', async () => {
        state.rows = makeRows(5000);
        state.error = { message: 'boom' };

        await expect(fetchRemoteTasks()).rejects.toThrow('boom');
        expect(state.calls).toHaveLength(1);
    });
});
