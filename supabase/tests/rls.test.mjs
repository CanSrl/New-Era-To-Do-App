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

// --- Niş modül: sahiplik ---------------------------------------------------
const nicheClient = await (async () => {
    const { data, error } = await a.client.from('clients')
        .insert({ user_id: a.userId, name: 'Acme', position: 0 }).select().single();
    check('Müşteri oluşturulabiliyor', !error && !!data, error?.message ?? '');
    return data;
})();

const nicheProject = await (async () => {
    const { data, error } = await a.client.from('projects')
        .insert({ user_id: a.userId, client_id: nicheClient.id, name: 'Websitesi', position: 0 })
        .select().single();
    check('Proje oluşturulabiliyor', !error && !!data, error?.message ?? '');
    return data;
})();

{
    const { data } = await b.client.from('clients').select('id').eq('id', nicheClient.id);
    check('Başka kullanıcı müşterileri GÖREMİYOR', data?.length === 0, `adet=${data?.length}`);
}
{
    const { data } = await b.client.from('projects').select('id').eq('id', nicheProject.id);
    check('Başka kullanıcı projeleri GÖREMİYOR', data?.length === 0, `adet=${data?.length}`);
}
{
    // projects.client_id bileşik FK'sının asıl işi: FK kontrolü RLS'i atladığı
    // için tek sütunlu referansla B, A'nın müşterisine proje asabilirdi.
    const { error } = await b.client.from('projects')
        .insert({ user_id: b.userId, client_id: nicheClient.id, name: 'Sızma', position: 0 });
    check('Proje BAŞKASININ müşterisine bağlanamıyor', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
}
{
    const anon = mk();
    const { error: c } = await anon.from('clients').select('id');
    check('Oturumsuz müşteri erişimi reddediliyor', !!c, c ? `reddedildi: ${c.code}` : 'VERİ DÖNDÜ!');
    const { error: p } = await anon.from('projects').select('id');
    check('Oturumsuz proje erişimi reddediliyor', !!p, p ? `reddedildi: ${p.code}` : 'VERİ DÖNDÜ!');
}

// --- Niş modül: tasks bağlarının bütünlüğü --------------------------------
const nicheTask = await (async () => {
    const { data, error } = await a.client.from('tasks')
        .insert({
            user_id: a.userId, title: 'Logo taslağı', position: 20,
            client_id: nicheClient.id, project_id: nicheProject.id,
        }).select().single();
    check('Görev müşteri ve projeye bağlanabiliyor', !error && !!data, error?.message ?? '');
    return data;
})();

{
    // MATCH SIMPLE yüzünden client_id null iken üçlü FK hiç değerlendirilmez;
    // bu check olmasaydı müşterisiz bir projeye asılı görev oluşurdu.
    const { error } = await a.client.from('tasks')
        .insert({ user_id: a.userId, title: 'Yetim', position: 21, project_id: nicheProject.id });
    check('project_id varken client_id zorunlu', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
}
{
    // Tasarımın kilit noktası: görevin müşterisiyle projenin müşterisi ayrışamaz.
    const { data: other } = await a.client.from('clients')
        .insert({ user_id: a.userId, name: 'Diğer Müşteri', position: 1 }).select().single();
    const { error } = await a.client.from('tasks')
        .insert({
            user_id: a.userId, title: 'Tutarsız', position: 22,
            client_id: other.id, project_id: nicheProject.id,
        });
    check('Görevin müşterisi projenin müşterisiyle eşleşmek zorunda', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
    await a.client.from('clients').delete().eq('id', other.id);
}
{
    // on update cascade: proje başka müşteriye taşınırsa görevin client_id'si
    // de taşınmalı; olmasaydı güncelleme FK hatasıyla düşerdi.
    const { data: target } = await a.client.from('clients')
        .insert({ user_id: a.userId, name: 'Taşınacak Müşteri', position: 2 }).select().single();
    const { error } = await a.client.from('projects')
        .update({ client_id: target.id }).eq('id', nicheProject.id);
    check('Proje başka müşteriye taşınabiliyor', !error, error?.message ?? '');

    const { data: moved } = await a.client.from('tasks')
        .select('client_id, project_id').eq('id', nicheTask.id).single();
    check('Proje taşınınca görevin müşterisi de taşınıyor (on update cascade)',
        moved?.client_id === target.id && moved?.project_id === nicheProject.id,
        `client_id=${moved?.client_id}`);

    // Sonraki testler için geri al.
    await a.client.from('projects').update({ client_id: nicheClient.id }).eq('id', nicheProject.id);
    await a.client.from('clients').delete().eq('id', target.id);
}
{
    // Proje silmek görevi silmemeli; yalnızca proje bağı kopar, müşteri kalır.
    await a.client.from('projects').delete().eq('id', nicheProject.id);
    const { data } = await a.client.from('tasks')
        .select('id, client_id, project_id').eq('id', nicheTask.id).single();
    check('Proje silinince görev duruyor', !!data, `görev=${data?.id}`);
    check('Proje silinince yalnızca project_id boşalıyor',
        data?.project_id === null && data?.client_id === nicheClient.id,
        `project_id=${data?.project_id} client_id=${data?.client_id}`);
}
{
    // Müşteri silme: tetikleyici önce görevlerin iki bağını da boşaltır,
    // ardından cascade projeleri siler. Görevler silinmez.
    const { data: p2 } = await a.client.from('projects')
        .insert({ user_id: a.userId, client_id: nicheClient.id, name: 'Destek', position: 1 })
        .select().single();
    await a.client.from('tasks')
        .update({ client_id: nicheClient.id, project_id: p2.id }).eq('id', nicheTask.id);

    const { error } = await a.client.from('clients').delete().eq('id', nicheClient.id);
    check('Müşteri silinebiliyor', !error, error?.message ?? '');

    const { data: task } = await a.client.from('tasks')
        .select('id, client_id, project_id').eq('id', nicheTask.id).single();
    check('Müşteri silinince görev duruyor', !!task, `görev=${task?.id}`);
    check('Müşteri silinince görevin iki bağı da boşalıyor',
        task?.client_id === null && task?.project_id === null,
        `client_id=${task?.client_id} project_id=${task?.project_id}`);

    const { data: orphans } = await a.client.from('projects')
        .select('id').eq('client_id', nicheClient.id);
    check('Müşteri silinince projeleri de siliniyor', orphans?.length === 0,
        `kalan=${orphans?.length}`);
}
{
    // categories ile aynı gerekçe: benzersizlik kısıtı senkronu kilitlerdi.
    const { error: first } = await a.client.from('clients')
        .insert({ user_id: a.userId, name: 'Tekrar', position: 7 });
    const { error: second } = await a.client.from('clients')
        .insert({ user_id: a.userId, name: 'Tekrar', position: 8 });
    check('Aynı adlı ikinci müşteri kabul ediliyor (local-first gereği)',
        !first && !second, second?.message ?? '');
}
{
    const { error } = await a.client.from('clients')
        .insert({ user_id: a.userId, name: '   ', position: 9 });
    check('Boş müşteri adı reddediliyor', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
}

// --- Niş modül: zaman kaydı (time_logs) ------------------------------------
//
// nicheClient/nicheProject bu noktada zaten silinmiş (yukarıdaki "Müşteri
// silinince..." bloğu), bu yüzden time_logs testleri kendi müşteri/proje/görev
// kayıtlarını kurar.
const tlClient = await (async () => {
    const { data, error } = await a.client.from('clients')
        .insert({ user_id: a.userId, name: 'Zaman Müşterisi', position: 10 })
        .select().single();
    check('Zaman kaydı için müşteri oluşturulabiliyor', !error && !!data, error?.message ?? '');
    return data;
})();

const tlProject = await (async () => {
    const { data, error } = await a.client.from('projects')
        .insert({ user_id: a.userId, client_id: tlClient.id, name: 'Zaman Projesi', position: 10 })
        .select().single();
    check('Zaman kaydı için proje oluşturulabiliyor', !error && !!data, error?.message ?? '');
    return data;
})();

const tlTask = await (async () => {
    const { data, error } = await a.client.from('tasks')
        .insert({
            user_id: a.userId, title: 'Zaman görevi', position: 30,
            client_id: tlClient.id, project_id: tlProject.id,
        }).select().single();
    check('Zaman kaydı için görev oluşturulabiliyor', !error && !!data, error?.message ?? '');
    return data;
})();

const tlLog = await (async () => {
    const { data, error } = await a.client.from('time_logs')
        .insert({
            user_id: a.userId,
            task_id: tlTask.id,
            client_id: tlClient.id,
            project_id: tlProject.id,
            started_at: '2026-08-16T09:00:00Z',
            duration_minutes: 90,
        }).select().single();
    check('Zaman kaydı oluşturulabiliyor', !error && !!data, error?.message ?? '');
    return data;
})();

{
    const { data, error } = await b.client.from('time_logs').select('id').eq('id', tlLog.id);
    check('Başka kullanıcı zaman kaydını GÖREMİYOR', !error && data?.length === 0,
        error?.message ?? `adet=${data?.length}`);
}
{
    const { data, error } = await b.client.from('time_logs')
        .update({ duration_minutes: 5 }).eq('id', tlLog.id).select();
    check('Başka kullanıcı zaman kaydını güncelleyemiyor', !error && data?.length === 0,
        error?.message ?? `etkilenen=${data?.length}`);
    const { data: after } = await a.client.from('time_logs')
        .select('duration_minutes').eq('id', tlLog.id).single();
    check('Zaman kaydı süresi değişmeden kaldı', after?.duration_minutes === 90,
        `duration_minutes=${after?.duration_minutes}`);
}
{
    const { data, error } = await b.client.from('time_logs').delete().eq('id', tlLog.id).select();
    check('Başka kullanıcı zaman kaydını silemiyor', !error && data?.length === 0,
        error?.message ?? `etkilenen=${data?.length}`);
    const { data: still } = await a.client.from('time_logs').select('id').eq('id', tlLog.id).maybeSingle();
    check('Zaman kaydı hâlâ duruyor', !!still, `kayıt=${still?.id}`);
}
{
    // (client_id, user_id) bileşik FK'nın asıl işi: tek sütunlu referans
    // olsaydı B, A'nın müşteri id'sini bilerek kendi adına kayıt açabilirdi.
    const { error } = await b.client.from('time_logs')
        .insert({
            user_id: b.userId, client_id: tlClient.id,
            started_at: '2026-08-16T10:00:00Z', duration_minutes: 30,
        });
    check('Başkasının müşterisine zaman kaydı yazılamıyor', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
}
{
    // Görevin müşterisiyle projenin müşterisi ayrışamaz — tasks'taki üçlü
    // FK'nın aynısı burada da geçerli.
    const { data: otherClient } = await a.client.from('clients')
        .insert({ user_id: a.userId, name: 'Diğer Zaman Müşterisi', position: 11 }).select().single();
    const { error } = await a.client.from('time_logs')
        .insert({
            user_id: a.userId, client_id: otherClient.id, project_id: tlProject.id,
            started_at: '2026-08-16T11:00:00Z', duration_minutes: 30,
        });
    check('Tutarsız (project_id, client_id) çifti reddediliyor', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
    await a.client.from('clients').delete().eq('id', otherClient.id);
}
{
    // MATCH SIMPLE yüzünden client_id null iken üçlü FK hiç değerlendirilmez;
    // time_logs_project_requires_client check'i bunu kapatıyor.
    const { error } = await a.client.from('time_logs')
        .insert({
            user_id: a.userId, project_id: tlProject.id,
            started_at: '2026-08-16T11:00:00Z', duration_minutes: 30,
        });
    check('project_id dolu / client_id boş satır reddediliyor', !!error,
        error ? `reddedildi: ${error.code}` : 'İZİN VERİLDİ!');
}
{
    const { error: zero } = await a.client.from('time_logs')
        .insert({
            user_id: a.userId, client_id: tlClient.id,
            started_at: '2026-08-16T12:00:00Z', duration_minutes: 0,
        });
    check('duration_minutes 0 reddediliyor', !!zero,
        zero ? `reddedildi: ${zero.code}` : 'İZİN VERİLDİ!');

    const { error: negative } = await a.client.from('time_logs')
        .insert({
            user_id: a.userId, client_id: tlClient.id,
            started_at: '2026-08-16T12:00:00Z', duration_minutes: -5,
        });
    check('duration_minutes negatif reddediliyor', !!negative,
        negative ? `reddedildi: ${negative.code}` : 'İZİN VERİLDİ!');

    const { error: tooLong } = await a.client.from('time_logs')
        .insert({
            user_id: a.userId, client_id: tlClient.id,
            started_at: '2026-08-16T12:00:00Z', duration_minutes: 1441,
        });
    check('duration_minutes 1441 reddediliyor', !!tooLong,
        tooLong ? `reddedildi: ${tooLong.code}` : 'İZİN VERİLDİ!');

    const { data: maxLog, error: max } = await a.client.from('time_logs')
        .insert({
            user_id: a.userId, client_id: tlClient.id,
            started_at: '2026-08-16T12:00:00Z', duration_minutes: 1440,
        }).select().single();
    check('duration_minutes 1440 kabul ediliyor', !max && !!maxLog, max?.message ?? '');
    if (maxLog) await a.client.from('time_logs').delete().eq('id', maxLog.id);
}
{
    // Görev silinince kayıt DURUR, yalnızca bağı kopar.
    await a.client.from('tasks').delete().eq('id', tlTask.id);
    const { data: afterTask } = await a.client.from('time_logs')
        .select('*').eq('id', tlLog.id).maybeSingle();
    check('Görev silinince zaman kaydı silinmiyor', !!afterTask, `kayıt=${afterTask?.id}`);
    check('Görev silinince task_id boşalıyor', afterTask?.task_id === null,
        `task_id=${afterTask?.task_id}`);
}
{
    // Proje silmek kaydı silmemeli; yalnızca proje bağı kopar, müşteri kalır.
    await a.client.from('projects').delete().eq('id', tlProject.id);
    const { data: afterProject } = await a.client.from('time_logs')
        .select('*').eq('id', tlLog.id).maybeSingle();
    check('Proje silinince zaman kaydı silinmiyor', !!afterProject, `kayıt=${afterProject?.id}`);
    check('Proje silinince yalnızca project_id boşalıyor',
        afterProject?.project_id === null && afterProject?.client_id === tlClient.id,
        `project_id=${afterProject?.project_id} client_id=${afterProject?.client_id}`);
}
{
    // client_id not null olduğu için boşaltılamaz: müşteri silinince kayıt gider.
    const { error } = await a.client.from('clients').delete().eq('id', tlClient.id);
    check('Zaman kaydının müşterisi silinebiliyor', !error, error?.message ?? '');
    const { data: afterClient } = await a.client.from('time_logs')
        .select('id').eq('id', tlLog.id).maybeSingle();
    check('Müşteri silinince zaman kaydı da siliniyor', afterClient === null,
        `kayıt=${afterClient?.id}`);
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} kontrol geçti`);
process.exit(failed.length ? 1 : 0);
