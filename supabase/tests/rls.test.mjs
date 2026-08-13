/**
 * Şema güvenlik testleri: RLS politikaları, tetikleyiciler ve kısıtlar.
 *
 * Yerel Supabase yığınına karşı çalışır:
 *   npx supabase start
 *   npm run test:rls
 *
 * Bu testler bir kez gerçek bir hatayı yakaladı: tablolara `authenticated`
 * rolü için GRANT verilmediğinde RLS politikaları hiç değerlendirilmiyor ve
 * her istek "permission denied" ile dönüyordu. Şema değiştikçe koruma
 * sağlaması için tutuluyor.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON =
    process.env.SUPABASE_ANON_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const results = [];
function check(name, passed, detail = '') {
    results.push({ name, passed });
    console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const mk = () => createClient(URL, ANON);
const stamp = Date.now();

const health = await fetch(`${URL}/auth/v1/health`).catch(() => null);
if (!health?.ok) {
    console.error(
        `Supabase ${URL} adresinde yanıt vermiyor.\n` +
        `Önce "npx supabase start" çalıştırın. (db reset sonrası Kong'un\n` +
        `yeniden başlatılması gerekebilir: docker restart supabase_kong_<proje>)`
    );
    process.exit(1);
}

async function signUp(tag) {
    const client = mk();
    const email = `${tag}${stamp}@example.com`;
    const { data, error } = await client.auth.signUp({ email, password: 'parola12345' });
    if (error) throw new Error(`${tag} signUp: ${error.message}`);
    if (!data.session) throw new Error(`${tag} signUp: oturum dönmedi (e-posta onayı açık olabilir)`);
    return { client, userId: data.user.id, email };
}

const a = await signUp('kullanici-a-');
const b = await signUp('kullanici-b-');

// --- Profil tetikleyicisi -------------------------------------------------
{
    const { data, error } = await a.client
        .from('profiles').select('id, email, display_name').eq('id', a.userId);
    check('Kayıt sonrası profil otomatik oluşuyor',
        !error && data?.length === 1 && data[0].email === a.email,
        error?.message ?? `display_name=${data?.[0]?.display_name}`);
}

// --- Sahiplik: okuma ve yazma --------------------------------------------
let taskId = null;
{
    const { data, error } = await a.client.from('tasks')
        .insert({ user_id: a.userId, title: 'A görevi', priority: 'high', position: 1 })
        .select().single();
    taskId = data?.id ?? null;
    check('Kullanıcı kendi görevini ekleyebiliyor', !error && !!data, error?.message ?? '');
    check('completed_at ilk eklemede null', data?.completed_at === null, `completed_at=${data?.completed_at}`);
}
{
    const { data, error } = await a.client.from('tasks').select('id');
    check('Kullanıcı kendi görevini görebiliyor', !error && data?.length === 1,
        error?.message ?? `adet=${data?.length}`);
}
{
    const { data, error } = await b.client.from('tasks').select('id');
    check('Başka kullanıcı görevleri GÖREMİYOR', !error && data?.length === 0,
        error?.message ?? `adet=${data?.length}`);
}
{
    const { data, error } = await b.client.from('tasks')
        .update({ title: 'ELE GECIRILDI' }).eq('id', taskId).select();
    check('Başka kullanıcı görevi güncelleyemiyor', !error && data?.length === 0,
        error?.message ?? `etkilenen=${data?.length}`);
    const { data: after } = await a.client.from('tasks').select('title').eq('id', taskId).single();
    check('Görev başlığı değişmeden kaldı', after?.title === 'A görevi', `başlık=${after?.title}`);
}
{
    const { data, error } = await b.client.from('tasks').delete().eq('id', taskId).select();
    check('Başka kullanıcı görevi silemiyor', !error && data?.length === 0,
        error?.message ?? `etkilenen=${data?.length}`);
    const { count } = await a.client.from('tasks').select('id', { count: 'exact', head: true });
    check('Görev hâlâ duruyor', count === 1, `adet=${count}`);
}
{
    const { error } = await b.client.from('tasks')
        .insert({ user_id: a.userId, title: 'Sahte', position: 0 });
    check('Başkası adına görev eklenemiyor', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
}
{
    const { data, error } = await b.client.from('profiles').select('id').eq('id', a.userId);
    check('Başka kullanıcının profili görünmüyor', !error && data?.length === 0,
        error?.message ?? `adet=${data?.length}`);
}

// --- Oturumsuz (anon) erişim ---------------------------------------------
// anon rolüne hiç GRANT verilmediği için hata da boş küme de kabul edilir;
// ikisi de veri sızmadığı anlamına gelir.
{
    const { data, error } = await mk().from('tasks').select('id');
    check('Oturumsuz erişim veri döndürmüyor', !!error || data?.length === 0,
        error ? `reddedildi: ${error.code}` : `adet=${data?.length}`);
}
{
    const { error } = await mk().from('tasks').insert({ user_id: a.userId, title: 'Anon', position: 0 });
    check('Oturumsuz ekleme reddediliyor', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
}

// --- Tetikleyiciler -------------------------------------------------------
{
    const { data } = await a.client.from('tasks')
        .update({ completed: true }).eq('id', taskId).select().single();
    check('Tamamlanınca completed_at doluyor', !!data?.completed_at, `completed_at=${data?.completed_at}`);
    const { data: undone } = await a.client.from('tasks')
        .update({ completed: false }).eq('id', taskId).select().single();
    check('Geri alınınca completed_at temizleniyor', undone?.completed_at === null,
        `completed_at=${undone?.completed_at}`);
}
{
    const { data: before } = await a.client.from('tasks').select('updated_at').eq('id', taskId).single();
    await new Promise((r) => setTimeout(r, 1100));
    const { data: after } = await a.client.from('tasks')
        .update({ title: 'A görevi v2' }).eq('id', taskId).select().single();
    check('updated_at güncellemede tazeleniyor', after?.updated_at !== before?.updated_at,
        `${before?.updated_at} -> ${after?.updated_at}`);
}

// --- Kısıtlar -------------------------------------------------------------
{
    const { error } = await a.client.from('tasks').insert({ user_id: a.userId, title: '   ', position: 0 });
    check('Boş başlık reddediliyor', !!error, error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
}
{
    const { error } = await a.client.from('tasks')
        .insert({ user_id: a.userId, title: 'X', priority: 'urgent', position: 0 });
    check('Geçersiz öncelik reddediliyor', !!error, error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
}

// --- categories -----------------------------------------------------------
let categoryA = null;
{
    const { data, error } = await a.client.from('categories')
        .insert({ user_id: a.userId, name: 'A-Kategori', color: '#3b82f6', position: 0 })
        .select().single();
    categoryA = data?.id ?? null;
    check('Kullanıcı kendi kategorisini ekleyebiliyor', !error && !!data, error?.message ?? '');
}
{
    const { data, error } = await b.client.from('categories').select('id');
    check('Başka kullanıcı kategorileri GÖREMİYOR', !error && data?.length === 0,
        error?.message ?? `adet=${data?.length}`);
}
{
    const { data, error } = await b.client.from('categories')
        .update({ name: 'ELE GECIRILDI' }).eq('id', categoryA).select();
    check('Başka kullanıcı kategoriyi güncelleyemiyor', !error && data?.length === 0,
        error?.message ?? `etkilenen=${data?.length}`);
}
{
    const { data, error } = await b.client.from('categories').delete().eq('id', categoryA).select();
    check('Başka kullanıcı kategoriyi silemiyor', !error && data?.length === 0,
        error?.message ?? `etkilenen=${data?.length}`);
}
{
    const { data, error } = await mk().from('categories').select('id');
    check('Oturumsuz kategori erişimi veri döndürmüyor', !!error || data?.length === 0,
        error ? `reddedildi: ${error.code}` : `adet=${data?.length}`);
}
{
    const { error } = await a.client.from('categories')
        .insert({ user_id: a.userId, name: 'Bozuk', color: 'kirmizi' });
    check('Geçersiz renk biçimi reddediliyor', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
}
{
    const { error } = await a.client.from('categories').insert({ user_id: a.userId, name: '   ' });
    check('Boş kategori adı reddediliyor', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
}
{
    // Aynı ad bilinçli olarak serbest: benzersizlik kısıtı olsaydı iki cihazın
    // çevrimdışıyken oluşturduğu aynı adlı kategori senkronu kilitlerdi.
    const { error } = await a.client.from('categories')
        .insert({ user_id: a.userId, name: 'A-Kategori', color: '#10b981', position: 9 });
    check('Aynı adlı ikinci kategori kabul ediliyor (local-first gereği)', !error,
        error?.message ?? '');
    await a.client.from('categories').delete().eq('name', 'A-Kategori').eq('position', 9);
}

// --- tasks <-> categories bağı --------------------------------------------
//
// Bileşik yabancı anahtarın (category_id, user_id) asıl işi budur: FK kontrolü
// RLS'i atladığı için, tek sütunlu bir referansla kullanıcı başkasının kategori
// id'sini bilirse görevini ona bağlayabilirdi.
{
    const { error } = await a.client.from('tasks')
        .update({ category_id: categoryA }).eq('id', taskId);
    check('Görev kendi kategorisine bağlanabiliyor', !error, error?.message ?? '');
}
{
    const { data: bTask } = await b.client.from('tasks')
        .insert({ user_id: b.userId, title: 'B görevi', position: 0 }).select().single();
    const { error } = await b.client.from('tasks')
        .update({ category_id: categoryA }).eq('id', bTask.id);
    check('Görev BAŞKASININ kategorisine bağlanamıyor', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
    await b.client.from('tasks').delete().eq('id', bTask.id);
}
{
    // Kategori silmek görevi silmemeli; görev "Kategorisiz" olarak kalır.
    await a.client.from('categories').delete().eq('id', categoryA);
    const { data } = await a.client.from('tasks').select('id, category_id').eq('id', taskId).single();
    check('Kategori silinince görev duruyor', !!data, `görev=${data?.id}`);
    check('Kategori silinince görevin category_id alanı boşalıyor', data?.category_id === null,
        `category_id=${data?.category_id}`);
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
process.exit(failed.length ? 1 : 0);
