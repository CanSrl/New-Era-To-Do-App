# Niş Modül 1. Dilim — Uygulama Planı

> **Ajan çalışanlar için:** GEREKLİ ALT BECERİ: Bu planı görev görev uygulamak
> için `superpowers:subagent-driven-development` (önerilen) veya
> `superpowers:executing-plans` kullanın. Adımlar takip için onay kutusu
> (`- [ ]`) sözdizimi kullanır.

**Hedef:** Görevleri müşteriye ve projeye bağlamak; yönetim ekranı, teslim
odaklı görünüm ve cihazlar arası senkron dahil, tamamı tek bir özellik
bayrağıyla kapatılabilir halde.

**Mimari:** İki yeni tablo (`clients`, `projects`) mevcut `categories`
desenini izler: local-first Zustand store birincil kaynak, saf birleştirme
fonksiyonları çakışmayı çözer, `runSync` yabancı anahtar bağımlılığına göre
sıralanmış turlar halinde iter. Veri bütünlüğü uygulama katmanında değil
şemada zorlanır: `tasks` tablosundaki bileşik yabancı anahtar, görevin
müşterisiyle projesinin müşterisinin ayrışmasını imkânsız kılar.

**Yığın:** React 19, TypeScript (strict), Vite 8, Tailwind v4, Zustand
(persist), Supabase (Postgres 15+, RLS), Radix, react-i18next, Vitest,
Playwright.

**Kaynak spec:** [2026-08-14-nis-modul-musteri-proje-design.md](../specs/2026-08-14-nis-modul-musteri-proje-design.md)

## Global Kısıtlar

Her görevin gereksinimleri örtük olarak bu bölümü içerir.

- **Postgres 15+** gerekli: `on delete set null (sütun_listesi)` sözdizimi
  buna bağlı.
- **Ad uzunluğu:** müşteri ve proje adları en fazla **80** karakter
  (`CLIENT_NAME_MAX`, `PROJECT_NAME_MAX`). Kategorilerde bu 40'tır; niş
  modülde şirket ve proje adları daha uzun olabildiği için ayrıştı.
- **`clients` ve `projects` üzerinde benzersizlik kısıtı YOKTUR.** Gerekçe
  `categories` ile aynı: çevrimdışı iki cihaz aynı adı üretebilir ve 23505
  o turdaki bütün senkronu düşürürdü. Tekilleştirme birleştirme motorunda,
  tekrar engelleme arayüzdedir.
- **İstemci tipleri dile bağımsızdır.** Kullanıcıya metin döndüren saf
  katmanlar hazır metin değil `TranslationKey` döndürür.
- **i18n anahtarları tiplidir:** `tr.json` referans alınır, `en.json` aynı
  şekli taşımak zorundadır; `src/i18n/i18n.test.ts` bunu doğrular. İki dosya
  **aynı commit'te** güncellenir.
- **`tsconfig.app.json` katı ayarları korunur** (`strict`,
  `noUnusedLocals`, `noUnusedParameters`).
- **`confirm()` / `alert()` kullanılmaz.** Onay diyalogları Radix
  `AlertDialog`.
- **İkon-only butonlar `aria-label` taşır** ve etiket ilgili kaydın adını
  içerir.
- **Yerel Supabase** gerekir: `npx supabase start`. `db reset` sonrası API
  502 dönerse: `docker restart supabase_kong_yapilacaklar-listesi`.
- **Her görev yeşil testle biter.** Yapısal değişiklikten önce testlerin
  yeşil olduğu doğrulanır.

---

## Spec'ten Sapma — Görev 4'te Onayınıza Sunulan

Spec, `mergeClients` ve `mergeProjects` için "`mergeCategories` kodunu
kopyala, genelleştirmeyi zaman kaydı dilimine ertele" diyor. Plan bunun
yerine **`mergeNamed` adında tek bir jenerik çekirdek** çıkarıyor ve üç
varlığın hepsi onu kullanıyor.

**Neden değişti:** Spec'in erteleme gerekçesi "iki örnekten doğru soyutlamayı
çıkarmak zor, üçten kolay" idi. Ama bu dilim tek başına üçüncü örneği
getiriyor — kategoriler, müşteriler, projeler. Soyutlama artık tahmin değil,
gözlem. Ayrıca bu, ertelenen büyük genelleştirme (varlık tanımını veri olarak
yazıp motorun üzerinde dönmesi) değil; yalnızca **birleştirme fonksiyonunun**
ortaklaştırılması. `runSync`, repository katmanı ve store hâlâ varlık başına
elle yazılmış kalıyor — spec'teki asıl borç duruyor.

**Neden güvenli:** `mergeCategories` mevcut testleriyle birlikte duruyor ve
ince bir sarmalayıcıya dönüşüyor. O testler refactor'ı koruyor: davranış
değişirse anında kırmızıya düşerler.

**Kabul etmezseniz:** Görev 4'ü üç ayrı fonksiyonu tam tam yazacak şekilde
bölün; plan başka hiçbir yerde bu karara bağlı değil.

---

## Dosya Yapısı

**Yeni dosyalar:**

| Dosya | Sorumluluk |
| --- | --- |
| `supabase/migrations/20260814120000_niche_module.sql` | İki tablo, kısıtlar, tetikleyici, GRANT + RLS |
| `src/lib/clients.ts` | `Client` saf yardımcıları: doğrulama, normalize, oluştur, sırala |
| `src/lib/projects.ts` | `Project` saf yardımcıları; ayrıca müşteriye göre gruplama |
| `src/lib/client-mapping.ts` | `Client` ↔ veritabanı satırı |
| `src/lib/project-mapping.ts` | `Project` ↔ veritabanı satırı |
| `src/features/clients/ClientManager.tsx` | Müşteri + proje yönetim arayüzü |
| `src/features/clients/ClientProjectSelect.tsx` | TaskForm'a gömülen iki seçici |
| `src/features/delivery/DeliveryView.tsx` | Teslim görünümü gruplaması |
| `src/pages/ClientsPage.tsx` | `/app/clients` rota kabuğu |
| `src/pages/DeliveryPage.tsx` | `/app/delivery` rota kabuğu |

**Değişen dosyalar:**

| Dosya | Değişiklik |
| --- | --- |
| `src/lib/types.ts` | `Client`, `Project`; `Task`'a `clientId`/`projectId` |
| `src/lib/tasks.ts` | `normalizeTask` iki yeni alanı ve değişmezi uygular |
| `src/lib/task-mapping.ts` | İki yeni sütun |
| `src/lib/sync-merge.ts` | `mergeNamed`, `mergeClients`, `mergeProjects`, `remapTaskLinks` |
| `src/lib/task-repository.ts` | Dört fetch/push/delete çifti |
| `src/store/index.ts` | Sekiz alan, eylemler, sürüm 5 göçü |
| `src/components/SyncProvider.tsx` | `pendingCount`, `runSync` sırası |
| `src/components/TaskForm.tsx` | İki seçici |
| `src/config/features.ts` | `nicheModule` bayrağı |
| `src/router.tsx` | İki koşullu rota |
| `src/i18n/locales/{tr,en}.json` | `client.*`, `project.*`, `delivery.*` |
| `.env.example`, `src/vite-env.d.ts` | `VITE_NICHE_MODULE` |

**Yeni test dosyaları:** `src/lib/clients.test.ts`,
`src/lib/projects.test.ts`, `src/lib/sync-merge-clients.test.ts`,
`src/lib/sync-merge-projects.test.ts`, `src/lib/remap-task-links.test.ts`,
`e2e/nis-modul.spec.ts`. `supabase/tests/rls.test.mjs` genişler.

---

## Görev 1: Şema

**Dosyalar:**
- Oluştur: `supabase/migrations/20260814120000_niche_module.sql`
- Değiştir: `supabase/tests/rls.test.mjs` (dosya sonuna, özet bloğundan önce)
- Yeniden üret: `src/lib/database.types.ts`

**Arayüzler:**
- Tüketir: `public.set_updated_at()` (mevcut migration'da tanımlı)
- Üretir: `clients` ve `projects` tabloları; `tasks.client_id`,
  `tasks.project_id` sütunları; `Database['public']['Tables']['clients']` ve
  `['projects']` tipleri

- [ ] **Adım 1: Migration dosyasını yaz**

```sql
-- Niş modül: müşteriler ve projeler.
--
-- Bu migration bilinçli olarak tek dosyada duruyor: starter kit alıcısı niş
-- modülü istemiyorsa dosyayı silip VITE_NICHE_MODULE'ü kapatarak modülü
-- tamamen çıkarabilsin.

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  archived boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_name_not_blank check (btrim(name) <> ''),
  constraint clients_name_max_length check (char_length(name) <= 80),
  -- projects ve tasks buraya BİLEŞİK yabancı anahtarla bağlanacak; bir
  -- yabancı anahtar ancak tam olarak referans verdiği sütun listesinin
  -- üzerindeki bir benzersizlik kısıtına bağlanabilir.
  constraint clients_id_user_id_key unique (id, user_id)
);

comment on table public.clients is
  'Niş modül: kullanıcının müşterileri. Görevler doğrudan buraya veya bir projeye bağlanabilir.';

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create index clients_user_id_idx on public.clients (user_id, position, created_at);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Proje her zaman bir müşteriye aittir; müşterisiz proje anlamsız.
  client_id uuid not null,
  name text not null,
  archived boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_not_blank check (btrim(name) <> ''),
  constraint projects_name_max_length check (char_length(name) <= 80),
  -- user_id referansa katılıyor çünkü FK kontrolü RLS'i ATLAR. Tek sütunlu
  -- referans olsaydı kullanıcı başkasının müşteri id'sini bilirse projesini
  -- ona bağlayabilirdi.
  constraint projects_client_id_fkey
    foreign key (client_id, user_id) references public.clients (id, user_id)
    on delete cascade,
  constraint projects_id_client_id_user_id_key unique (id, client_id, user_id)
);

comment on table public.projects is
  'Niş modül: müşteriye ait projeler. Müşteri silinince cascade ile silinir.';

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create index projects_user_id_idx on public.projects (user_id, position, created_at);
create index projects_client_id_idx on public.projects (client_id);

-- ---------------------------------------------------------------------------
-- tasks: müşteri ve proje bağları
-- ---------------------------------------------------------------------------

alter table public.tasks add column client_id uuid;
alter table public.tasks add column project_id uuid;

-- Bileşik yabancı anahtarlar varsayılan MATCH SIMPLE ile çalışır: sütunlardan
-- HERHANGİ BİRİ null ise kısıt hiç değerlendirilmez. Bu check olmasaydı
-- project_id dolu / client_id boş bir satır aşağıdaki üçlü FK'yı sessizce
-- atlar ve müşterisiz bir projeye asılı görev oluşurdu.
alter table public.tasks
  add constraint tasks_project_requires_client
  check (project_id is null or client_id is not null);

alter table public.tasks
  add constraint tasks_client_id_fkey
  foreign key (client_id, user_id) references public.clients (id, user_id);

-- Tasarımın kilit noktası: client_id referansa katıldığı için "görev A
-- müşterisine bağlı ama projesi B müşterisinin" durumu ŞEMADA imkânsız.
-- Uygulama katmanında kontrol etmek yetmezdi; doğrudan API çağrısıyla aşılırdı.
--
-- on delete set null (project_id): proje silinince görev silinmez, yalnızca
--   proje bağı kopar; client_id yerinde kalır, dolayısıyla yukarıdaki check
--   bozulmaz. Sütun listeli biçim Postgres 15+ ile geliyor.
-- on update cascade: kullanıcı projeyi başka müşteriye taşırsa bağlı
--   görevlerin client_id'si de taşınır; olmasaydı güncelleme FK ile düşerdi.
alter table public.tasks
  add constraint tasks_project_id_fkey
  foreign key (project_id, client_id, user_id)
    references public.projects (id, client_id, user_id)
  on delete set null (project_id)
  on update cascade;

create index tasks_client_id_idx on public.tasks (client_id) where client_id is not null;
create index tasks_project_id_idx on public.tasks (project_id) where project_id is not null;

-- ---------------------------------------------------------------------------
-- Müşteri silme: görevlerin iki bağını da boşalt
-- ---------------------------------------------------------------------------

-- Neden tetikleyici gerekiyor: müşteri silinince projeleri cascade ile
-- gitmeli AMA görevlerin İKİ alanı birden boşalmalı. Bunu yalnızca referans
-- eylemleriyle ifade etmek mümkün değil — tasks_client_id_fkey'e
-- "on delete set null" verilseydi sadece client_id boşalır, project_id dolu
-- kalır ve tasks_project_requires_client patlardı. set null'un sütun listesi
-- yalnızca o kısıtın KENDİ referans sütunlarını kabul eder.
--
-- Tek where yetiyor: projesi üzerinden bağlı her görevin client_id'si zaten
-- aynı müşteriyi gösterir (tasks_project_id_fkey bunu garanti ediyor).
--
-- security definer DEĞİL: tetikleyici çağıran kullanıcının yetkisiyle çalışır,
-- güncellediği satırlar zaten onun kendi görevleridir ve tasks üzerindeki RLS
-- update politikası buna izin verir. Gereksiz yetki yükseltmesi olurdu.
create function public.clear_tasks_for_deleted_client()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.tasks
     set client_id = null, project_id = null
   where client_id = old.id;
  return old;
end;
$$;

-- Satır bazlı before delete tetikleyicisi, yabancı anahtarların referans
-- eylemlerinden (bunlar dahili after tetikleyicileridir) ÖNCE çalışır.
-- Görevler temizlendikten sonra cascade projeleri siler ve ortada onlara
-- işaret eden görev kalmaz.
create trigger clients_clear_tasks
  before delete on public.clients
  for each row execute function public.clear_tasks_for_deleted_client();

-- ---------------------------------------------------------------------------
-- Yetkiler ve RLS
-- ---------------------------------------------------------------------------

-- ⚠️ GRANT olmadan RLS politikaları HİÇ değerlendirilmez ve her istek
-- "permission denied" ile döner. Bu bir kez gerçek bir hataya yol açtı.
grant select, insert, update, delete on public.clients  to authenticated;
grant select, insert, update, delete on public.projects to authenticated;

-- anon'a hiçbir yetki verilmiyor (varsayılan zaten bu; açıkça belirtiliyor).
revoke all on public.clients  from anon;
revoke all on public.projects from anon;

alter table public.clients  enable row level security;
alter table public.projects enable row level security;

create policy clients_select_own on public.clients
  for select to authenticated using ((select auth.uid()) = user_id);
create policy clients_insert_own on public.clients
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy clients_update_own on public.clients
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy clients_delete_own on public.clients
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy projects_select_own on public.projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy projects_insert_own on public.projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy projects_update_own on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy projects_delete_own on public.projects
  for delete to authenticated using ((select auth.uid()) = user_id);
```

- [ ] **Adım 2: Migration'ı uygula**

```bash
npx supabase db reset
```

Beklenen: hatasız tamamlanır. 502 alırsanız:
`docker restart supabase_kong_yapilacaklar-listesi`

- [ ] **Adım 3: Şema güvenlik testlerini yaz**

`supabase/tests/rls.test.mjs` içine, sonuç özetini basan bloktan **önce**
ekleyin. Dosyadaki mevcut `check(...)` yardımcısını ve `a` / `b`
kullanıcılarını kullanır.

```javascript
// --- Niş modül: müşteriler ve projeler ------------------------------------
{
    const { data: client, error: clientError } = await a.client
        .from('clients')
        .insert({ user_id: a.userId, name: 'Acme', position: 0 })
        .select().single();
    check('Müşteri oluşturulabiliyor', !clientError && !!client, clientError?.message);

    const { data: project, error: projectError } = await a.client
        .from('projects')
        .insert({ user_id: a.userId, client_id: client.id, name: 'Websitesi', position: 0 })
        .select().single();
    check('Proje oluşturulabiliyor', !projectError && !!project, projectError?.message);

    // B, A'nın kayıtlarını göremez.
    const { data: leaked } = await b.client.from('clients').select('id').eq('id', client.id);
    check('Başkasının müşterisi okunamıyor', leaked?.length === 0);

    const { data: leakedProject } = await b.client.from('projects').select('id').eq('id', project.id);
    check('Başkasının projesi okunamıyor', leakedProject?.length === 0);

    // B, A'nın müşterisine kendi projesini bağlayamaz. FK kontrolü RLS'i
    // atladığı için user_id referansa katılmasaydı bu GEÇERDİ.
    const { error: crossError } = await b.client
        .from('projects')
        .insert({ user_id: b.userId, client_id: client.id, name: 'Sızma', position: 0 });
    check('Başkasının müşterisine proje bağlanamıyor', !!crossError, crossError?.code);

    // Görev bağları.
    const { data: task, error: taskError } = await a.client
        .from('tasks')
        .insert({
            user_id: a.userId, title: 'Logo', position: 0,
            client_id: client.id, project_id: project.id,
        })
        .select().single();
    check('Görev müşteri+projeye bağlanabiliyor', !taskError && !!task, taskError?.message);

    // project_id dolu / client_id boş: check kısıtı reddetmeli.
    const { error: orphanError } = await a.client
        .from('tasks')
        .insert({ user_id: a.userId, title: 'Yetim', position: 1, project_id: project.id });
    check('project_id varken client_id zorunlu', !!orphanError, orphanError?.code);

    // Tutarsız çift: görev C müşterisine bağlı ama proje Acme'nin.
    const { data: other } = await a.client
        .from('clients').insert({ user_id: a.userId, name: 'Diğer', position: 1 })
        .select().single();
    const { error: mismatchError } = await a.client
        .from('tasks')
        .insert({
            user_id: a.userId, title: 'Tutarsız', position: 2,
            client_id: other.id, project_id: project.id,
        });
    check('Görevin müşterisi projenin müşterisiyle eşleşmek zorunda',
        !!mismatchError, mismatchError?.code);

    // Proje silmek görevi silmez, yalnızca proje bağını koparır.
    await a.client.from('projects').delete().eq('id', project.id);
    const { data: afterProject } = await a.client
        .from('tasks').select('id, client_id, project_id').eq('id', task.id).single();
    check('Proje silinince görev yaşıyor, yalnızca proje bağı kopuyor',
        afterProject?.project_id === null && afterProject?.client_id === client.id,
        JSON.stringify(afterProject));

    // Müşteri silmek: projeleri gider, görev yaşar, iki bağ da boşalır.
    const { data: p2 } = await a.client
        .from('projects')
        .insert({ user_id: a.userId, client_id: client.id, name: 'Destek', position: 1 })
        .select().single();
    await a.client.from('tasks').update({ project_id: p2.id }).eq('id', task.id);

    const { error: deleteError } = await a.client.from('clients').delete().eq('id', client.id);
    check('Müşteri silinebiliyor', !deleteError, deleteError?.message);

    const { data: afterClient } = await a.client
        .from('tasks').select('id, client_id, project_id').eq('id', task.id).single();
    check('Müşteri silinince görev yaşıyor ve iki bağ da boşalıyor',
        afterClient?.client_id === null && afterClient?.project_id === null,
        JSON.stringify(afterClient));

    const { data: orphanProjects } = await a.client
        .from('projects').select('id').eq('client_id', client.id);
    check('Müşteri silinince projeleri de siliniyor', orphanProjects?.length === 0);
}

// --- anon rolü ------------------------------------------------------------
{
    const anonClient = mk();
    const { error: anonClients } = await anonClient.from('clients').select('id');
    check('anon müşterileri okuyamıyor', !!anonClients, anonClients?.message);

    const { error: anonProjects } = await anonClient.from('projects').select('id');
    check('anon projeleri okuyamıyor', !!anonProjects, anonProjects?.message);
}
```

- [ ] **Adım 4: Şema testlerini koş**

```bash
npm run test:rls
```

Beklenen: tüm satırlar PASS. Bir FAIL varsa migration'ı düzeltin ve
`npx supabase db reset` ile baştan uygulayın.

- [ ] **Adım 5: Veritabanı tiplerini yeniden üret**

```bash
npm run db:types
```

Beklenen: `src/lib/database.types.ts` içinde `clients` ve `projects`
tabloları belirir, `tasks` satırında `client_id` ve `project_id` görünür.

- [ ] **Adım 6: Mevcut testlerin hâlâ yeşil olduğunu doğrula**

```bash
npm test -- --run
```

Beklenen: 169 test geçer. Şema değişikliği istemci kodunu henüz
etkilemediği için sayı değişmemeli.

- [ ] **Adım 7: Commit**

```bash
git add supabase/migrations supabase/tests src/lib/database.types.ts
git commit -m "Nis modul semasi: clients ve projects tablolari"
```

---

## Görev 2: İstemci tipleri ve saf yardımcılar

**Dosyalar:**
- Değiştir: `src/lib/types.ts`
- Oluştur: `src/lib/clients.ts`, `src/lib/projects.ts`
- Test: `src/lib/clients.test.ts`, `src/lib/projects.test.ts`
- Değiştir: `src/lib/tasks.ts` (`normalizeTask`)

**Arayüzler:**
- Tüketir: `createId`, `toIsoTimestamp` (`src/lib/tasks.ts`); `categoryKey`
  (`src/lib/categories.ts`)
- Üretir:
  - `interface Client { id, name, archived, position, createdAt, updatedAt }`
  - `interface Project extends Client { clientId: string }`
  - `CLIENT_NAME_MAX = 80`, `PROJECT_NAME_MAX = 80`
  - `normalizeClient(raw: unknown, fallbackPosition: number): Client | null`
  - `createClient(name: string, position: number, now?: string): Client`
  - `byClientPosition(a: Client, b: Client): number`
  - `nextClientPosition(clients: readonly Client[]): number`
  - `isClientNameTaken(clients, name, exceptId?): boolean`
  - `normalizeProject(raw, fallbackPosition): Project | null`
  - `createProject(clientId, name, position, now?): Project`
  - `byProjectPosition`, `nextProjectPosition(projects, clientId)`
  - `isProjectNameTaken(projects, clientId, name, exceptId?): boolean`
  - `projectsByClient(projects, clientId): Project[]`

- [ ] **Adım 1: Başarısız testleri yaz**

`src/lib/clients.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
    CLIENT_NAME_MAX, createClient, isClientNameTaken,
    nextClientPosition, normalizeClient,
} from './clients';

describe('normalizeClient', () => {
    it('adı olmayan kaydı reddeder', () => {
        expect(normalizeClient({ name: '   ' }, 0)).toBeNull();
        expect(normalizeClient(null, 0)).toBeNull();
    });

    it('eksik alanları tamamlar', () => {
        const result = normalizeClient({ name: 'Acme' }, 3);
        expect(result?.name).toBe('Acme');
        expect(result?.archived).toBe(false);
        expect(result?.position).toBe(3);
        expect(result?.id).toBeTruthy();
        expect(result?.updatedAt).toBe(result?.createdAt);
    });

    it('adı en fazla CLIENT_NAME_MAX karaktere kırpar', () => {
        const long = 'x'.repeat(CLIENT_NAME_MAX + 10);
        expect(normalizeClient({ name: long }, 0)?.name).toHaveLength(CLIENT_NAME_MAX);
    });

    it('archived alanını boolean olmayan değerden korur', () => {
        expect(normalizeClient({ name: 'Acme', archived: 'evet' }, 0)?.archived).toBe(false);
        expect(normalizeClient({ name: 'Acme', archived: true }, 0)?.archived).toBe(true);
    });
});

describe('isClientNameTaken', () => {
    const clients = [createClient('Acme', 0), createClient('Startup X', 1)];

    it('büyük/küçük harf ve boşluk farkını yok sayar', () => {
        expect(isClientNameTaken(clients, '  acme ')).toBe(true);
    });

    it('Türkçe I/İ çiftini doğru karşılaştırır', () => {
        const withTurkish = [createClient('İş Bankası', 0)];
        expect(isClientNameTaken(withTurkish, 'iş bankası')).toBe(true);
    });

    it('kendi kaydını saymaz', () => {
        expect(isClientNameTaken(clients, 'Acme', clients[0].id)).toBe(false);
    });
});

describe('nextClientPosition', () => {
    it('boş listede 0 döner', () => {
        expect(nextClientPosition([])).toBe(0);
    });

    it('en büyük position + 1 döner', () => {
        expect(nextClientPosition([createClient('A', 0), createClient('B', 7)])).toBe(8);
    });
});
```

`src/lib/projects.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
    createProject, isProjectNameTaken, nextProjectPosition,
    normalizeProject, projectsByClient,
} from './projects';

describe('normalizeProject', () => {
    it('clientId olmayan kaydı reddeder', () => {
        expect(normalizeProject({ name: 'Websitesi' }, 0)).toBeNull();
    });

    it('adı olmayan kaydı reddeder', () => {
        expect(normalizeProject({ clientId: 'c1', name: '' }, 0)).toBeNull();
    });

    it('geçerli kaydı normalize eder', () => {
        const result = normalizeProject({ clientId: 'c1', name: 'Websitesi' }, 2);
        expect(result?.clientId).toBe('c1');
        expect(result?.position).toBe(2);
        expect(result?.archived).toBe(false);
    });
});

describe('isProjectNameTaken', () => {
    const projects = [createProject('c1', 'Websitesi', 0), createProject('c2', 'Websitesi', 0)];

    it('aynı müşteride aynı ad çakışır', () => {
        expect(isProjectNameTaken(projects, 'c1', 'websitesi')).toBe(true);
    });

    it('farklı müşterilerde aynı ad çakışmaz', () => {
        expect(isProjectNameTaken(projects, 'c3', 'Websitesi')).toBe(false);
    });
});

describe('nextProjectPosition', () => {
    it('yalnızca ilgili müşterinin projelerine bakar', () => {
        const projects = [createProject('c1', 'A', 0), createProject('c2', 'B', 9)];
        expect(nextProjectPosition(projects, 'c1')).toBe(1);
    });
});

describe('projectsByClient', () => {
    it('yalnızca o müşterinin projelerini sıralı döner', () => {
        const projects = [
            createProject('c1', 'B', 1), createProject('c2', 'X', 0), createProject('c1', 'A', 0),
        ];
        expect(projectsByClient(projects, 'c1').map((p) => p.name)).toEqual(['A', 'B']);
    });
});
```

- [ ] **Adım 2: Testlerin başarısız olduğunu doğrula**

```bash
npm test -- --run src/lib/clients.test.ts src/lib/projects.test.ts
```

Beklenen: FAIL — "Failed to resolve import './clients'".

- [ ] **Adım 3: Tipleri ekle**

`src/lib/types.ts` içine:

```typescript
/** Niş modül: kullanıcının müşterisi. */
export interface Client {
    id: string;
    name: string;
    /** Arşivlenmiş kayıt seçicilerde gizlenir ama geçmiş görevlerin bağı korunur. */
    archived: boolean;
    position: number;
    /** ISO 8601. */
    createdAt: string;
    /** ISO 8601. Çakışma bu alana göre çözülür. */
    updatedAt: string;
}

/** Niş modül: bir müşteriye ait proje. */
export interface Project extends Client {
    /** Her proje bir müşteriye aittir; şemada da not null. */
    clientId: string;
}
```

`Task` arayüzüne iki alan ekleyin:

```typescript
    /**
     * Bağlı müşteri. `projectId` doluysa bu da dolu olmak zorundadır —
     * şemadaki tasks_project_requires_client kısıtının istemci karşılığı.
     */
    clientId: string | null;
    /** Bağlı proje. Doluysa projenin müşterisi `clientId` ile aynıdır. */
    projectId: string | null;
```

- [ ] **Adım 4: `src/lib/clients.ts` dosyasını yaz**

```typescript
import type { Client } from './types';
import { createId, toIsoTimestamp } from './tasks';
import { categoryKey } from './categories';

/** Veritabanı kısıtıyla aynı. Kategorilerdeki 40'tan uzun: şirket adları uzayabiliyor. */
export const CLIENT_NAME_MAX = 80;

/**
 * Dışarıdan gelen (LocalStorage, veritabanı) ham veriyi geçerli bir
 * Client'a çevirir. Adı olmayan kayıtlar reddedilir.
 */
export function normalizeClient(raw: unknown, fallbackPosition: number): Client | null {
    if (!raw || typeof raw !== 'object') return null;

    const source = raw as Record<string, unknown>;
    const name = typeof source.name === 'string' ? source.name.trim() : '';
    if (!name) return null;

    const createdAt = toIsoTimestamp(source.createdAt);

    return {
        id: typeof source.id === 'string' && source.id ? source.id : createId(),
        name: name.slice(0, CLIENT_NAME_MAX),
        archived: source.archived === true,
        position: typeof source.position === 'number' && Number.isFinite(source.position)
            ? source.position
            : fallbackPosition,
        createdAt,
        updatedAt: source.updatedAt == null ? createdAt : toIsoTimestamp(source.updatedAt),
    };
}

/** Yeni bir müşteri kaydı üretir. */
export function createClient(
    name: string,
    position: number,
    now: string = new Date().toISOString()
): Client {
    return {
        id: createId(),
        name: name.trim().slice(0, CLIENT_NAME_MAX),
        archived: false,
        position,
        createdAt: now,
        updatedAt: now,
    };
}

/** Sıralama anahtarına göre karşılaştırır; eşitlikte oluşturma sırasına düşer. */
export function byClientPosition(a: Client, b: Client): number {
    if (a.position !== b.position) return a.position - b.position;
    return a.createdAt.localeCompare(b.createdAt);
}

/** Bir sonraki müşterinin alacağı sıralama anahtarı (listenin sonu). */
export function nextClientPosition(clients: readonly Client[]): number {
    if (clients.length === 0) return 0;
    return Math.max(...clients.map((c) => c.position)) + 1;
}

/**
 * Verilen ad başka bir müşteride kullanılıyor mu?
 *
 * Veritabanında benzersizlik kısıtı bilinçli olarak yok (bkz. migration);
 * tekrarı arayüz engelliyor. Karşılaştırma `categoryKey` ile yapılır:
 * Türkçe I/İ çiftini doğru çeviren yerel duyarlı biçim.
 */
export function isClientNameTaken(
    clients: readonly Client[],
    name: string,
    exceptId?: string
): boolean {
    const key = categoryKey(name);
    return clients.some((c) => c.id !== exceptId && categoryKey(c.name) === key);
}
```

- [ ] **Adım 5: `src/lib/projects.ts` dosyasını yaz**

```typescript
import type { Project } from './types';
import { createId, toIsoTimestamp } from './tasks';
import { categoryKey } from './categories';

/** Veritabanı kısıtıyla aynı. */
export const PROJECT_NAME_MAX = 80;

/**
 * Ham veriyi geçerli bir Project'e çevirir. Adı ya da müşterisi olmayan
 * kayıtlar reddedilir — müşterisiz proje şemada da imkânsız.
 */
export function normalizeProject(raw: unknown, fallbackPosition: number): Project | null {
    if (!raw || typeof raw !== 'object') return null;

    const source = raw as Record<string, unknown>;
    const name = typeof source.name === 'string' ? source.name.trim() : '';
    if (!name) return null;

    const clientId = typeof source.clientId === 'string' ? source.clientId : '';
    if (!clientId) return null;

    const createdAt = toIsoTimestamp(source.createdAt);

    return {
        id: typeof source.id === 'string' && source.id ? source.id : createId(),
        clientId,
        name: name.slice(0, PROJECT_NAME_MAX),
        archived: source.archived === true,
        position: typeof source.position === 'number' && Number.isFinite(source.position)
            ? source.position
            : fallbackPosition,
        createdAt,
        updatedAt: source.updatedAt == null ? createdAt : toIsoTimestamp(source.updatedAt),
    };
}

/** Yeni bir proje kaydı üretir. */
export function createProject(
    clientId: string,
    name: string,
    position: number,
    now: string = new Date().toISOString()
): Project {
    return {
        id: createId(),
        clientId,
        name: name.trim().slice(0, PROJECT_NAME_MAX),
        archived: false,
        position,
        createdAt: now,
        updatedAt: now,
    };
}

/** Sıralama anahtarına göre karşılaştırır; eşitlikte oluşturma sırasına düşer. */
export function byProjectPosition(a: Project, b: Project): number {
    if (a.position !== b.position) return a.position - b.position;
    return a.createdAt.localeCompare(b.createdAt);
}

/** Bir müşterinin bir sonraki projesinin alacağı sıralama anahtarı. */
export function nextProjectPosition(projects: readonly Project[], clientId: string): number {
    const own = projects.filter((p) => p.clientId === clientId);
    if (own.length === 0) return 0;
    return Math.max(...own.map((p) => p.position)) + 1;
}

/**
 * Verilen ad aynı müşterinin başka bir projesinde kullanılıyor mu?
 *
 * Kapsam müşteriye göredir: iki farklı müşterinin "Websitesi" adlı projesi
 * olması tamamen normaldir.
 */
export function isProjectNameTaken(
    projects: readonly Project[],
    clientId: string,
    name: string,
    exceptId?: string
): boolean {
    const key = categoryKey(name);
    return projects.some(
        (p) => p.clientId === clientId && p.id !== exceptId && categoryKey(p.name) === key
    );
}

/** Bir müşterinin projelerini sıralı döner. */
export function projectsByClient(
    projects: readonly Project[],
    clientId: string
): Project[] {
    return projects.filter((p) => p.clientId === clientId).sort(byProjectPosition);
}
```

- [ ] **Adım 6: `normalizeTask`'ı güncelle**

`src/lib/tasks.ts` içindeki `normalizeTask`'ın döndürdüğü nesneye iki alan
ekleyin. `clientId`/`projectId` okunurken **değişmez zorlanır**: `projectId`
dolu ama `clientId` boşsa `projectId` düşürülür.

```typescript
    // Şemadaki tasks_project_requires_client kısıtının istemci karşılığı:
    // müşterisi olmayan bir görev projeye bağlı olamaz. Bu satır olmadan
    // bozuk bir kayıt senkronda 23514 ile reddedilir ve o turdaki bütün
    // görev senkronizasyonunu düşürürdü.
    const clientId = typeof source.clientId === 'string' && source.clientId
        ? source.clientId
        : null;
    const projectId = clientId && typeof source.projectId === 'string' && source.projectId
        ? source.projectId
        : null;
```

ve dönen nesneye `clientId,` `projectId,` ekleyin.

- [ ] **Adım 7: Testleri koş**

```bash
npm test -- --run
```

Beklenen: yeni testler dahil hepsi PASS. `Task` arayüzü iki alan kazandığı
için mevcut testlerde tip hatası çıkarsa, o testlerdeki görev nesnelerine
`clientId: null, projectId: null` ekleyin.

- [ ] **Adım 8: Tip kontrolü**

```bash
npx tsc -b --noEmit
```

Beklenen: hatasız.

- [ ] **Adım 9: Commit**

```bash
git add src/lib
git commit -m "Client ve Project tipleri, saf yardimcilar"
```

---

## Görev 3: Store alanları ve sürüm 5 göçü

**Dosyalar:**
- Değiştir: `src/store/index.ts`
- Test: `src/store/store.test.ts` (mevcut dosyaya ekleme)

**Arayüzler:**
- Tüketir: `Client`, `Project` (Görev 2); `createClient`, `nextClientPosition`
  (`src/lib/clients.ts`); `createProject`, `nextProjectPosition`
  (`src/lib/projects.ts`)
- Üretir: store eylemleri `addClient(name)`, `renameClient(id, name)`,
  `setClientArchived(id, archived)`, `deleteClient(id)`,
  `addProject(clientId, name)`, `renameProject(id, name)`,
  `setProjectArchived(id, archived)`, `deleteProject(id)`; ve genişlemiş
  `applySyncResult`

- [ ] **Adım 1: Başarısız testleri yaz**

`src/store/store.test.ts` sonuna:

```typescript
describe('müşteri ve proje eylemleri', () => {
    it('müşteri ekler ve dirty işaretler', () => {
        const store = useTaskStore.getState();
        store.addClient('Acme');
        const state = useTaskStore.getState();
        expect(state.clients).toHaveLength(1);
        expect(state.dirtyClientIds).toContain(state.clients[0].id);
    });

    it('müşteri silince projeleri ve görev bağları temizlenir', () => {
        const store = useTaskStore.getState();
        store.addClient('Acme');
        const clientId = useTaskStore.getState().clients[0].id;
        store.addProject(clientId, 'Websitesi');
        const projectId = useTaskStore.getState().projects[0].id;
        store.addTask({ title: 'Logo', clientId, projectId } as never);
        const taskId = useTaskStore.getState().tasks[0].id;

        store.deleteClient(clientId);
        const state = useTaskStore.getState();

        expect(state.clients).toHaveLength(0);
        expect(state.projects).toHaveLength(0);
        // Görev SİLİNMEZ, yalnızca bağları kopar — veritabanı tetikleyicisiyle
        // aynı davranış.
        const task = state.tasks.find((t) => t.id === taskId);
        expect(task?.clientId).toBeNull();
        expect(task?.projectId).toBeNull();
        // Mezar taşları senkronun silmesi için duruyor.
        expect(state.clientTombstones.map((t) => t.id)).toContain(clientId);
        expect(state.projectTombstones.map((t) => t.id)).toContain(projectId);
    });

    it('proje silince yalnızca proje bağı kopar', () => {
        const store = useTaskStore.getState();
        store.addClient('Acme');
        const clientId = useTaskStore.getState().clients[0].id;
        store.addProject(clientId, 'Websitesi');
        const projectId = useTaskStore.getState().projects[0].id;
        store.addTask({ title: 'Logo', clientId, projectId } as never);

        store.deleteProject(projectId);
        const task = useTaskStore.getState().tasks[0];

        expect(task.projectId).toBeNull();
        expect(task.clientId).toBe(clientId);
    });
});
```

> Bu testler mevcut dosyanın store'u sıfırlama düzenini izlemelidir. Dosyanın
> başındaki `beforeEach` bloğunda store nasıl sıfırlanıyorsa, yeni alanlar
> (`clients: []`, `projects: []`, `dirtyClientIds: []`, `clientTombstones: []`,
> `dirtyProjectIds: []`, `projectTombstones: []`) oraya da eklenmelidir.

- [ ] **Adım 2: Testlerin başarısız olduğunu doğrula**

```bash
npm test -- --run src/store/store.test.ts
```

Beklenen: FAIL — `store.addClient is not a function`.

- [ ] **Adım 3: Store durumunu ve eylemlerini ekle**

`TaskState` arayüzüne:

```typescript
    clients: Client[];
    projects: Project[];
    /** Buluta itilmeyi bekleyen müşteri id'leri. */
    dirtyClientIds: string[];
    clientTombstones: Tombstone[];
    dirtyProjectIds: string[];
    projectTombstones: Tombstone[];
```

Başlangıç durumuna (satır ~101 civarı, `ownerId: null` yanına):

```typescript
            // Tohum YOK: müşteri listesi boş başlar. Kategorilerdeki
            // "tohumlanan adlar çevrilir, iki cihaz iki dilde tohumlanırsa
            // çakışır" riski burada hiç doğmuyor.
            clients: [],
            projects: [],
            dirtyClientIds: [],
            clientTombstones: [],
            dirtyProjectIds: [],
            projectTombstones: [],
```

Eylemler (mevcut kategori eylemlerinin yanına, aynı `withDirty` yardımcısını
kullanarak):

```typescript
            addClient: (name) => set((state) => {
                const client = createClient(name, nextClientPosition(state.clients));
                return {
                    clients: [...state.clients, client],
                    dirtyClientIds: withDirty(state.dirtyClientIds, client.id),
                };
            }),

            renameClient: (id, name) => set((state) => ({
                clients: state.clients.map((c) =>
                    c.id === id
                        ? { ...c, name: name.trim().slice(0, CLIENT_NAME_MAX),
                            updatedAt: new Date().toISOString() }
                        : c
                ),
                dirtyClientIds: withDirty(state.dirtyClientIds, id),
            })),

            setClientArchived: (id, archived) => set((state) => ({
                clients: state.clients.map((c) =>
                    c.id === id ? { ...c, archived, updatedAt: new Date().toISOString() } : c
                ),
                dirtyClientIds: withDirty(state.dirtyClientIds, id),
            })),

            /**
             * Müşteriyi, projelerini ve görev bağlarını birlikte kaldırır.
             *
             * Veritabanındaki clients_clear_tasks tetikleyicisi + cascade ile
             * AYNI sonucu üretir; iki taraf ayrışırsa senkron turunda görev
             * bağları geri diriltilirdi.
             *
             * Görevlerin updatedAt damgası bilinçli olarak tazelenmez: bu bir
             * kullanıcı düzenlemesi değil, bağ onarımıdır. Damgayı ilerletmek
             * aynı görevi başka cihazda gerçekten düzenleyen kullanıcının
             * değişikliğini haksız yere yenerdi.
             */
            deleteClient: (id) => set((state) => {
                const now = new Date().toISOString();
                const doomedProjects = state.projects.filter((p) => p.clientId === id);
                const doomedProjectIds = new Set(doomedProjects.map((p) => p.id));

                return {
                    clients: state.clients.filter((c) => c.id !== id),
                    projects: state.projects.filter((p) => p.clientId !== id),
                    tasks: state.tasks.map((t) =>
                        t.clientId === id ? { ...t, clientId: null, projectId: null } : t
                    ),
                    dirtyClientIds: state.dirtyClientIds.filter((d) => d !== id),
                    clientTombstones: [
                        ...state.clientTombstones.filter((t) => t.id !== id),
                        { id, deletedAt: now },
                    ],
                    dirtyProjectIds: state.dirtyProjectIds.filter((d) => !doomedProjectIds.has(d)),
                    projectTombstones: [
                        ...state.projectTombstones.filter((t) => !doomedProjectIds.has(t.id)),
                        ...doomedProjects.map((p) => ({ id: p.id, deletedAt: now })),
                    ],
                };
            }),

            addProject: (clientId, name) => set((state) => {
                const project = createProject(
                    clientId, name, nextProjectPosition(state.projects, clientId)
                );
                return {
                    projects: [...state.projects, project],
                    dirtyProjectIds: withDirty(state.dirtyProjectIds, project.id),
                };
            }),

            renameProject: (id, name) => set((state) => ({
                projects: state.projects.map((p) =>
                    p.id === id
                        ? { ...p, name: name.trim().slice(0, PROJECT_NAME_MAX),
                            updatedAt: new Date().toISOString() }
                        : p
                ),
                dirtyProjectIds: withDirty(state.dirtyProjectIds, id),
            })),

            setProjectArchived: (id, archived) => set((state) => ({
                projects: state.projects.map((p) =>
                    p.id === id ? { ...p, archived, updatedAt: new Date().toISOString() } : p
                ),
                dirtyProjectIds: withDirty(state.dirtyProjectIds, id),
            })),

            /** Proje silinince görevin YALNIZCA proje bağı kopar; müşteri kalır. */
            deleteProject: (id) => set((state) => ({
                projects: state.projects.filter((p) => p.id !== id),
                tasks: state.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
                dirtyProjectIds: state.dirtyProjectIds.filter((d) => d !== id),
                projectTombstones: [
                    ...state.projectTombstones.filter((t) => t.id !== id),
                    { id, deletedAt: new Date().toISOString() },
                ],
            })),
```

- [ ] **Adım 4: `partialize`, `prepareForSync` ve `applySyncResult`'ı genişlet**

`partialize`'a altı alan ekleyin (`clients`, `projects`, `dirtyClientIds`,
`clientTombstones`, `dirtyProjectIds`, `projectTombstones`).

`prepareForSync` üç dalını da güncelleyin:
- **Aynı hesap** (`state.ownerId === userId`): değişiklik yok.
- **Misafir** (`ownerId === null`): `dirtyClientIds: state.clients.map(c => c.id)`,
  `dirtyProjectIds: state.projects.map(p => p.id)`.
- **Başka hesap**: `clients: []`, `projects: []` ve dört meta alanı `[]`.

`applySyncResult` imzasına ve gövdesine ekleyin:

```typescript
            applySyncResult: ({
                tasks, categories, clients, projects,
                syncedIds, clearedTombstoneIds,
                syncedCategoryIds, clearedCategoryTombstoneIds,
                syncedClientIds, clearedClientTombstoneIds,
                syncedProjectIds, clearedProjectTombstoneIds,
                syncedAt,
            }) => set((state) => {
                // Mevcut gövdedeki cutoff / cleared / alive tanımları
                // OLDUĞU GİBİ KALIR; aşağıdaki dört satır onların altına eklenir.
                const clearedClients = new Set(clearedClientTombstoneIds);
                const clearedProjects = new Set(clearedProjectTombstoneIds);
                const syncedClients = new Set(syncedClientIds);
                const syncedProjects = new Set(syncedProjectIds);

                return {
                    // Mevcut return nesnesindeki tasks / categories / dirtyIds /
                    // tombstones / dirtyCategoryIds / categoryTombstones /
                    // lastSyncedAt alanları OLDUĞU GİBİ KALIR; altına eklenir:
                    clients,
                    projects,
                    dirtyClientIds: state.dirtyClientIds.filter((id) => !syncedClients.has(id)),
                    clientTombstones: state.clientTombstones.filter(
                        (t) => !clearedClients.has(t.id) && alive(t)
                    ),
                    dirtyProjectIds: state.dirtyProjectIds.filter((id) => !syncedProjects.has(id)),
                    projectTombstones: state.projectTombstones.filter(
                        (t) => !clearedProjects.has(t.id) && alive(t)
                    ),
                };
            }),
```

- [ ] **Adım 5: Sürüm 5 göçünü yaz**

`version: 4` → `version: 5`. `migrate` fonksiyonunun sonuna, mevcut
dalların ardından:

```typescript
                // v4 -> v5: niş modül alanları eklendi. Mevcut görevler
                // müşteri/proje bağı olmadan devam eder; boş listeler senkron
                // turunda hiçbir şey göndermez.
                if (version < 5) {
                    state.clients = [];
                    state.projects = [];
                    state.dirtyClientIds = [];
                    state.clientTombstones = [];
                    state.dirtyProjectIds = [];
                    state.projectTombstones = [];
                    state.tasks = state.tasks.map((t) => ({
                        ...t,
                        clientId: t.clientId ?? null,
                        projectId: t.projectId ?? null,
                    }));
                }
```

Migrate başındaki sürüm yorumu bloğuna bir satır ekleyin:
`* v4 -> v5: niş modül (müşteriler, projeler) alanları eklendi.`

- [ ] **Adım 6: Testleri koş**

```bash
npm test -- --run
```

Beklenen: hepsi PASS.

- [ ] **Adım 7: Commit**

```bash
git add src/store src/lib
git commit -m "Store: musteri ve proje alanlari, surum 5 gocu"
```

---

## Görev 4: Birleştirme motoru

> **Bu görev spec'ten sapıyor.** Yukarıdaki "Spec'ten Sapma" bölümünü
> okuyun. Sapmayı kabul etmiyorsanız Adım 3'ü atlayıp `mergeClients` ve
> `mergeProjects`'i `mergeCategories`'in tam kopyaları olarak yazın; testler
> ve sonraki görevler değişmez.

**Dosyalar:**
- Değiştir: `src/lib/sync-merge.ts`
- Test: `src/lib/sync-merge-clients.test.ts`,
  `src/lib/sync-merge-projects.test.ts`, `src/lib/remap-task-links.test.ts`

**Arayüzler:**
- Tüketir: `Client`, `Project`, `Task`, `Tombstone`; `categoryKey`
- Üretir:
  - `mergeClients(input: NamedMergeInput<Client>): NamedMergePlan<Client>` —
    plan alanı adı `items`
  - `mergeProjects(input: NamedMergeInput<Project>): NamedMergePlan<Project>`
  - `remapTaskLinks(tasks, clientIdRemap, projectIdRemap, validClientIds, validProjectIds): Task[]`
  - `mergeCategories` imzası ve dönüş şekli **değişmez** (mevcut testler
    korunur)

- [ ] **Adım 1: Başarısız testleri yaz**

`src/lib/sync-merge-clients.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { mergeClients } from './sync-merge';
import type { Client } from './types';

const client = (over: Partial<Client> & { id: string; name: string }): Client => ({
    archived: false, position: 0,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
});

describe('mergeClients', () => {
    it('dirty olmayan ve bulutta bulunmayan müşteriyi düşürür', () => {
        const plan = mergeClients({
            local: [client({ id: 'a', name: 'Acme' })],
            remote: [], dirtyIds: [], tombstones: [],
        });
        expect(plan.items).toHaveLength(0);
    });

    it('dirty müşteriyi push listesine koyar', () => {
        const local = client({ id: 'a', name: 'Acme' });
        const plan = mergeClients({ local: [local], remote: [], dirtyIds: ['a'], tombstones: [] });
        expect(plan.toPush).toEqual([local]);
    });

    it('çakışmada updatedAt yenisi kazanır', () => {
        const local = client({ id: 'a', name: 'Yerel', updatedAt: '2026-02-02T00:00:00.000Z' });
        const remote = client({ id: 'a', name: 'Bulut', updatedAt: '2026-01-01T00:00:00.000Z' });
        const plan = mergeClients({ local: [local], remote: [remote], dirtyIds: ['a'], tombstones: [] });
        expect(plan.items[0].name).toBe('Yerel');
    });

    it('eşitlikte bulut kazanır ve yerel sürüm atılır', () => {
        const local = client({ id: 'a', name: 'Yerel' });
        const remote = client({ id: 'a', name: 'Bulut' });
        const plan = mergeClients({ local: [local], remote: [remote], dirtyIds: ['a'], tombstones: [] });
        expect(plan.items[0].name).toBe('Bulut');
        expect(plan.discardedIds).toContain('a');
    });

    it('aynı adlı müşteriyi buluttakine katlar ve idRemap üretir', () => {
        const plan = mergeClients({
            local: [client({ id: 'yerel', name: 'Acme' })],
            remote: [client({ id: 'bulut', name: '  acme ' })],
            dirtyIds: ['yerel'], tombstones: [],
        });
        expect(plan.idRemap).toEqual({ yerel: 'bulut' });
        expect(plan.discardedIds).toContain('yerel');
        expect(plan.items.map((c) => c.id)).toEqual(['bulut']);
    });

    it('mezar taşını buluttan silme listesine koyar', () => {
        const plan = mergeClients({
            local: [], remote: [client({ id: 'a', name: 'Acme' })],
            dirtyIds: [], tombstones: [{ id: 'a', deletedAt: '2026-02-01T00:00:00.000Z' }],
        });
        expect(plan.toDelete).toEqual(['a']);
    });

    it('bulutta karşılığı olmayan mezar taşını gereksiz sayar', () => {
        const plan = mergeClients({
            local: [], remote: [], dirtyIds: [],
            tombstones: [{ id: 'a', deletedAt: '2026-02-01T00:00:00.000Z' }],
        });
        expect(plan.obsoleteTombstoneIds).toEqual(['a']);
    });
});
```

`src/lib/sync-merge-projects.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { mergeProjects } from './sync-merge';
import type { Project } from './types';

const project = (
    over: Partial<Project> & { id: string; name: string; clientId: string }
): Project => ({
    archived: false, position: 0,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
});

describe('mergeProjects', () => {
    it('aynı müşterideki aynı adlı projeyi katlar', () => {
        const plan = mergeProjects({
            local: [project({ id: 'yerel', clientId: 'c1', name: 'Websitesi' })],
            remote: [project({ id: 'bulut', clientId: 'c1', name: 'websitesi' })],
            dirtyIds: ['yerel'], tombstones: [],
        });
        expect(plan.idRemap).toEqual({ yerel: 'bulut' });
    });

    it('FARKLI müşterilerdeki aynı adlı projeyi KATLAMAZ', () => {
        const local = project({ id: 'yerel', clientId: 'c1', name: 'Websitesi' });
        const plan = mergeProjects({
            local: [local],
            remote: [project({ id: 'bulut', clientId: 'c2', name: 'Websitesi' })],
            dirtyIds: ['yerel'], tombstones: [],
        });
        // İki ayrı müşterinin "Websitesi" projesi olması tamamen normaldir.
        expect(plan.idRemap).toEqual({});
        expect(plan.toPush).toEqual([local]);
    });

    it('çakışmada updatedAt yenisi kazanır', () => {
        const local = project({
            id: 'p', clientId: 'c1', name: 'Yerel', updatedAt: '2026-03-01T00:00:00.000Z',
        });
        const remote = project({ id: 'p', clientId: 'c1', name: 'Bulut' });
        const plan = mergeProjects({
            local: [local], remote: [remote], dirtyIds: ['p'], tombstones: [],
        });
        expect(plan.items[0].name).toBe('Yerel');
    });
});
```

`src/lib/remap-task-links.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { remapTaskLinks } from './sync-merge';
import type { Task } from './types';

const task = (over: Partial<Task> & { id: string }): Task => ({
    title: 'Görev', description: '', dueDate: null, priority: 'medium',
    categoryId: null, clientId: null, projectId: null,
    completed: false, completedAt: null, position: 0,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
});

describe('remapTaskLinks', () => {
    it('tekilleştirilen müşteriye bağlı görevi bulut id\'sine taşır', () => {
        const result = remapTaskLinks(
            [task({ id: 't', clientId: 'yerel' })],
            { yerel: 'bulut' }, {},
            new Set(['bulut']), new Set()
        );
        expect(result[0].clientId).toBe('bulut');
    });

    it('zincirleme eşlemede hem müşteriyi hem projeyi taşır', () => {
        const result = remapTaskLinks(
            [task({ id: 't', clientId: 'yc', projectId: 'yp' })],
            { yc: 'bc' }, { yp: 'bp' },
            new Set(['bc']), new Set(['bp'])
        );
        expect(result[0].clientId).toBe('bc');
        expect(result[0].projectId).toBe('bp');
    });

    it('karşılığı kalmayan müşteriyi boşaltır ve projeyi de düşürür', () => {
        // Müşteri gidince proje bağı tutulamaz: şemadaki
        // tasks_project_requires_client kısıtı ihlal edilirdi.
        const result = remapTaskLinks(
            [task({ id: 't', clientId: 'yok', projectId: 'p' })],
            {}, {}, new Set(), new Set(['p'])
        );
        expect(result[0].clientId).toBeNull();
        expect(result[0].projectId).toBeNull();
    });

    it('karşılığı kalmayan projeyi boşaltır ama müşteriyi korur', () => {
        const result = remapTaskLinks(
            [task({ id: 't', clientId: 'c', projectId: 'yok' })],
            {}, {}, new Set(['c']), new Set()
        );
        expect(result[0].clientId).toBe('c');
        expect(result[0].projectId).toBeNull();
    });

    it('değişiklik yoksa aynı nesneyi döner', () => {
        const original = task({ id: 't', clientId: 'c' });
        const result = remapTaskLinks([original], {}, {}, new Set(['c']), new Set());
        expect(result[0]).toBe(original);
    });

    it('updatedAt damgasını tazelemez', () => {
        const result = remapTaskLinks(
            [task({ id: 't', clientId: 'yerel' })],
            { yerel: 'bulut' }, {}, new Set(['bulut']), new Set()
        );
        expect(result[0].updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });
});
```

- [ ] **Adım 2: Testlerin başarısız olduğunu doğrula**

```bash
npm test -- --run src/lib/sync-merge-clients.test.ts src/lib/sync-merge-projects.test.ts src/lib/remap-task-links.test.ts
```

Beklenen: FAIL — `mergeClients is not exported`.

- [ ] **Adım 3: Jenerik çekirdeği çıkar**

`src/lib/sync-merge.ts` içine ekleyin:

```typescript
/** Ada göre tekilleştirilebilen, senkronlanan bir kayıt. */
interface NamedRecord {
    id: string;
    name: string;
    updatedAt: string;
}

export interface NamedMergeInput<T extends NamedRecord> {
    local: readonly T[];
    remote: readonly T[];
    dirtyIds: readonly string[];
    tombstones: readonly Tombstone[];
}

export interface NamedMergePlan<T extends NamedRecord> {
    items: T[];
    toPush: T[];
    toDelete: string[];
    discardedIds: string[];
    obsoleteTombstoneIds: string[];
    /** Tekilleştirilen kayıtların yerel id'sinden bulut id'sine eşleme. */
    idRemap: Record<string, string>;
}

/**
 * Ada göre tekilleştirme yapan birleştirme çekirdeği.
 *
 * Kategoriler, müşteriler ve projeler aynı kurallarla birleşir; yalnızca
 * "aynı kayıt" tanımı değişir. `keyOf` bu farkı taşır: kategoriler ve
 * müşteriler için sadece ad, projeler için (müşteri, ad) çifti — iki farklı
 * müşterinin "Websitesi" projesi olması normaldir.
 *
 * Kurallar:
 * - Yalnızca yerelde olan, dirty kayıt: buluta gönderilir.
 * - Yalnızca yerelde olan, dirty OLMAYAN kayıt: bir önceki turda
 *   senkronlanmıştı ve artık bulutta yok; başka cihazda silinmiş demektir.
 * - Yalnızca uzakta olan kayıt: indirilir. Mezar taşı varsa bulutta silinir.
 * - İki tarafta da olan kayıt: updatedAt yenisi kazanır; eşitlikte bulut
 *   kazanır, böylece bütün cihazlar aynı sonuca varır.
 *
 * Tekilleştirme yalnızca id'si bulutta BULUNMAYAN yerel kayıtlara uygulanır.
 * Bulutta karşılığı olan bir kayıt yeniden adlandırılıp başkasıyla aynı ada
 * gelirse birleştirilmez — bu çakışma değil, kullanıcının bilinçli düzenlemesi.
 *
 * Fonksiyon saftır; ağ çağrısı yapmaz.
 */
function mergeNamed<T extends NamedRecord>(
    { local, remote, dirtyIds, tombstones }: NamedMergeInput<T>,
    keyOf: (item: T) => string
): NamedMergePlan<T> {
    const dirty = new Set(dirtyIds);
    const deleted = new Set(tombstones.map((t) => t.id));
    const remoteById = new Map(remote.map((r) => [r.id, r]));
    const localIds = new Set(local.map((l) => l.id));

    // Bulutta aynı anahtar birden fazla kez varsa (benzersizlik kısıtı yok,
    // mümkün) ilk görülen kazanır; böylece bütün cihazlar aynı hedefte buluşur.
    const remoteByKey = new Map<string, T>();
    for (const item of remote) {
        const key = keyOf(item);
        if (!remoteByKey.has(key)) remoteByKey.set(key, item);
    }

    const items: T[] = [];
    const toPush: T[] = [];
    const toDelete: string[] = [];
    const discardedIds: string[] = [];
    const idRemap: Record<string, string> = {};

    for (const localItem of local) {
        if (deleted.has(localItem.id)) continue;

        const remoteItem = remoteById.get(localItem.id);

        if (!remoteItem) {
            const twin = remoteByKey.get(keyOf(localItem));
            if (twin) {
                idRemap[localItem.id] = twin.id;
                // Dirty bayrağı temizlenmezse her turda yeniden gönderilmeye
                // çalışılır ve her seferinde aynı şekilde katlanırdı.
                discardedIds.push(localItem.id);
                continue;
            }

            if (dirty.has(localItem.id)) {
                items.push(localItem);
                toPush.push(localItem);
            }
            continue;
        }

        if (dirty.has(localItem.id)) {
            if (localItem.updatedAt > remoteItem.updatedAt) {
                items.push(localItem);
                toPush.push(localItem);
            } else {
                items.push(remoteItem);
                discardedIds.push(localItem.id);
            }
        } else {
            items.push(remoteItem);
        }
    }

    for (const remoteItem of remote) {
        if (localIds.has(remoteItem.id)) continue;

        if (deleted.has(remoteItem.id)) {
            toDelete.push(remoteItem.id);
            continue;
        }

        items.push(remoteItem);
    }

    const obsoleteTombstoneIds = tombstones
        .filter((t) => !remoteById.has(t.id))
        .map((t) => t.id);

    return { items, toPush, toDelete, discardedIds, obsoleteTombstoneIds, idRemap };
}

/** Müşterileri birleştirir. Tekilleştirme anahtarı: ad. */
export function mergeClients(input: NamedMergeInput<Client>): NamedMergePlan<Client> {
    return mergeNamed(input, (c) => categoryKey(c.name));
}

/**
 * Projeleri birleştirir. Tekilleştirme anahtarı: (müşteri, ad) çifti.
 *
 * Ayırıcı '/' güvenli: müşteri id'si UUID, yani yalnızca onaltılık basamak ve
 * tire içerir. Ad tarafında '/' geçebilir ama bu anahtarı bozmaz — ilk '/'
 * her zaman sınırdır, dolayısıyla iki farklı (müşteri, ad) çifti aynı
 * anahtarı üretemez.
 */
export function mergeProjects(input: NamedMergeInput<Project>): NamedMergePlan<Project> {
    return mergeNamed(input, (p) => `${p.clientId}/${categoryKey(p.name)}`);
}
```

`mergeCategories`'in gövdesini jenerik çağrıya indirin — imzası ve dönüş
şekli **aynı kalmalı** ki mevcut testleri korusun:

```typescript
export function mergeCategories(input: CategoryMergeInput): CategoryMergePlan {
    const { items, ...rest } = mergeNamed<Category>(input, (c) => categoryKey(c.name));
    return { categories: items, ...rest };
}
```

`Client` ve `Project` tiplerini dosyanın üstündeki import'a ekleyin.

- [ ] **Adım 4: `remapTaskLinks`'i yaz**

```typescript
/**
 * Görevlerin müşteri ve proje bağlarını birleştirme sonrasına uyarlar.
 *
 * Üç iş yapar:
 * 1. Tekilleştirilen kayıtlara bağlı görevleri bulut id'sine taşır.
 * 2. Artık var olmayan bir kayda bağlı görevin bağını koparır.
 * 3. Müşteri bağı koparsa proje bağını da koparır.
 *
 * Üçüncüsü şemadaki tasks_project_requires_client kısıtının karşılığıdır:
 * müşterisi olmayan görev projeye bağlı kalamaz. İkincisi yabancı anahtar
 * güvenliği içindir — olmayan bir kayda bağlı görevi göndermek 23503 ile
 * reddedilir ve o turdaki BÜTÜN görev senkronizasyonunu düşürürdü.
 *
 * `updatedAt` bilinçli olarak tazelenmez: bu bir kullanıcı düzenlemesi değil,
 * bağ onarımıdır. Damgayı ilerletmek, aynı görevi başka bir cihazda gerçekten
 * düzenleyen kullanıcının değişikliğini haksız yere yenerdi.
 */
export function remapTaskLinks(
    tasks: readonly Task[],
    clientIdRemap: Record<string, string>,
    projectIdRemap: Record<string, string>,
    validClientIds: ReadonlySet<string>,
    validProjectIds: ReadonlySet<string>
): Task[] {
    return tasks.map((task) => {
        if (task.clientId === null && task.projectId === null) return task;

        let clientId: string | null = null;
        if (task.clientId !== null) {
            const mapped = clientIdRemap[task.clientId] ?? task.clientId;
            clientId = validClientIds.has(mapped) ? mapped : null;
        }

        let projectId: string | null = null;
        // Müşteri düştüyse proje de düşer.
        if (clientId !== null && task.projectId !== null) {
            const mapped = projectIdRemap[task.projectId] ?? task.projectId;
            projectId = validProjectIds.has(mapped) ? mapped : null;
        }

        if (clientId === task.clientId && projectId === task.projectId) return task;
        return { ...task, clientId, projectId };
    });
}
```

- [ ] **Adım 5: Testleri koş**

```bash
npm test -- --run
```

Beklenen: yeni testler PASS **ve** mevcut `sync-merge.test.ts` testleri
(kategori birleştirme dahil) hâlâ PASS. Kategori testleri kırılırsa
`mergeCategories` sarmalayıcısı yanlış; jenerik çekirdeğe dokunmayın, önce
sarmalayıcıyı düzeltin.

- [ ] **Adım 6: Commit**

```bash
git add src/lib
git commit -m "Birlestirme motoru: musteri ve proje, jenerik cekirdek"
```

---

## Görev 5: Repository ve senkron sırası

**Dosyalar:**
- Oluştur: `src/lib/client-mapping.ts`, `src/lib/project-mapping.ts`
- Değiştir: `src/lib/task-repository.ts`, `src/lib/task-mapping.ts`,
  `src/components/SyncProvider.tsx`
- Test: `e2e/senkron.spec.ts` (ekleme)

**Arayüzler:**
- Tüketir: `mergeClients`, `mergeProjects`, `remapTaskLinks` (Görev 4);
  `normalizeClient`, `normalizeProject` (Görev 2)
- Üretir: `fetchRemoteClients()`, `pushRemoteClients(clients, userId)`,
  `deleteRemoteClients(ids)`, `fetchRemoteProjects()`,
  `pushRemoteProjects(projects, userId)`, `deleteRemoteProjects(ids)`,
  `clientToRow`, `rowToClient`, `projectToRow`, `rowToProject`

- [ ] **Adım 1: Eşleme dosyalarını yaz**

`src/lib/client-mapping.ts` — `category-mapping.ts` kalıbının aynısı:

```typescript
import type { Database } from './database.types';
import type { Client } from './types';
import { normalizeClient } from './clients';

type ClientRow = Database['public']['Tables']['clients']['Row'];
export type ClientInsert = Database['public']['Tables']['clients']['Insert'];

/** Yerel müşteriyi veritabanına yazılacak satıra çevirir. */
export function clientToRow(client: Client, userId: string): ClientInsert {
    return {
        id: client.id,
        user_id: userId,
        name: client.name,
        archived: client.archived,
        position: client.position,
        created_at: client.createdAt,
        updated_at: client.updatedAt,
    };
}

/**
 * Veritabanı satırını yerel müşteriye çevirir.
 *
 * Satır normalizeClient'tan geçirilir: veritabanı kısıtları güvenilir olsa da
 * tek bir bozuk satır listeyi çökertmemeli.
 */
export function rowToClient(row: ClientRow): Client {
    const normalized = normalizeClient(
        {
            id: row.id, name: row.name, archived: row.archived,
            position: row.position, createdAt: row.created_at,
        },
        row.position
    );

    // normalizeClient yalnızca ad boşsa null döner; veritabanı kısıtı bunu
    // zaten engelliyor, yine de tip güvenliği için yedek üretilir.
    if (!normalized) {
        return {
            id: row.id, name: row.name || 'Adsız müşteri', archived: row.archived,
            position: row.position, createdAt: row.created_at, updatedAt: row.updated_at,
        };
    }

    return { ...normalized, updatedAt: row.updated_at };
}
```

`src/lib/project-mapping.ts` aynı kalıp; `client_id` ↔ `clientId` alanı
eklenir ve yedek nesnede `clientId: row.client_id`, ad yedeği
`'Adsız proje'` olur.

- [ ] **Adım 2: `task-mapping.ts`'i güncelle**

`taskToRow`'a `client_id: task.clientId,` ve `project_id: task.projectId,`
ekleyin. `rowToTask`'ın `normalizeTask`'a verdiği nesneye
`clientId: row.client_id,` ve `projectId: row.project_id,` ekleyin.

- [ ] **Adım 3: Repository fonksiyonlarını yaz**

`src/lib/task-repository.ts` sonuna:

```typescript
/** Kullanıcının bulut üzerindeki tüm müşterilerini çeker. */
export async function fetchRemoteClients(): Promise<Client[]> {
    const { data, error } = await client().from('clients').select('*');
    if (error) throw new Error(error.message);
    return data.map(rowToClient);
}

/**
 * Müşterileri buluta yazar.
 *
 * Projelerden ve görevlerden ÖNCE çağrılmalıdır: her ikisinin de müşteriye
 * bileşik yabancı anahtarı var, müşteri henüz yokken yazmak 23503 ile
 * reddedilir.
 */
export async function pushRemoteClients(
    clients: readonly Client[], userId: string
): Promise<Client[]> {
    if (clients.length === 0) return [];
    const { data, error } = await client()
        .from('clients')
        .upsert(clients.map((c) => clientToRow(c, userId)), { onConflict: 'id' })
        .select();
    if (error) throw new Error(error.message);
    return data.map(rowToClient);
}

/**
 * Müşterileri buluttan siler.
 *
 * EN SONDA çağrılmalıdır. Veritabanındaki clients_clear_tasks tetikleyicisi
 * bağlı görevlerin iki alanını da boşaltır, ardından cascade projeleri siler.
 * Bağlı görevler silinmez.
 */
export async function deleteRemoteClients(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await client().from('clients').delete().in('id', ids);
    if (error) throw new Error(error.message);
}

/** Kullanıcının bulut üzerindeki tüm projelerini çeker. */
export async function fetchRemoteProjects(): Promise<Project[]> {
    const { data, error } = await client().from('projects').select('*');
    if (error) throw new Error(error.message);
    return data.map(rowToProject);
}

/** Projeleri buluta yazar. Müşterilerden SONRA, görevlerden ÖNCE. */
export async function pushRemoteProjects(
    projects: readonly Project[], userId: string
): Promise<Project[]> {
    if (projects.length === 0) return [];
    const { data, error } = await client()
        .from('projects')
        .upsert(projects.map((p) => projectToRow(p, userId)), { onConflict: 'id' })
        .select();
    if (error) throw new Error(error.message);
    return data.map(rowToProject);
}

/**
 * Projeleri buluttan siler. Görevler yazıldıktan SONRA çağrılmalıdır.
 * Bağlı görevler silinmez; on delete set null (project_id) yalnızca bağı koparır.
 */
export async function deleteRemoteProjects(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await client().from('projects').delete().in('id', ids);
    if (error) throw new Error(error.message);
}
```

Import satırını genişletin: `Client`, `Project` tipleri ve dört eşleme
fonksiyonu.

- [ ] **Adım 4: `SyncProvider`'daki `pendingCount`'u genişlet**

```typescript
    // Müşteriler ve projeler de sayılmak zorunda: yalnızca bu sayı değişince
    // senkron tetikleniyor. Sayılmazlarsa müşteri/proje ekleme bir sonraki
    // yoklamaya (dakikada bir) kadar buluta hiç gitmez. Bu tam olarak
    // kategorilerde bir kez gerçekten oldu.
    const pendingCount =
        dirtyIds.length + tombstones.length +
        dirtyCategoryIds.length + categoryTombstones.length +
        dirtyClientIds.length + clientTombstones.length +
        dirtyProjectIds.length + projectTombstones.length;
```

Dört yeni alanı store seçicisinden okuyun.

- [ ] **Adım 5: `runSync` sırasını kur**

`SyncProvider` içindeki senkron fonksiyonunda, mevcut kategori akışının
yanına. Sıra **serbest değil** — yabancı anahtarlar dayatıyor.

```typescript
// 1. Bulut anlık görüntüleri (paralel çekilebilir).
const [remoteCategories, remoteClients, remoteProjects, remoteTasks] = await Promise.all([
    fetchRemoteCategories(), fetchRemoteClients(), fetchRemoteProjects(), fetchRemoteTasks(),
]);

// 2. Saf birleştirme. Sıra zincirleme id eşlemesi yüzünden önemli:
//    müşteri tekilleştirilirse projelerin clientId'si de yeniden yazılmalı.
//    mergeCategories çağrısı DEĞİŞMEZ, mevcut haliyle kalır.
const categoryPlan = mergeCategories({
    local: categories, remote: remoteCategories,
    dirtyIds: dirtyCategoryIds, tombstones: categoryTombstones,
});
const clientPlan = mergeClients({
    local: clients, remote: remoteClients,
    dirtyIds: dirtyClientIds, tombstones: clientTombstones,
});

// Yerel projelerin clientId'sini müşteri eşlemesiyle güncelle — bu OLMADAN
// tekilleştirilmiş müşteriye bağlı proje push'u 23503 alır.
const projectsWithMappedClients = projects.map((p) => {
    const mapped = clientPlan.idRemap[p.clientId] ?? p.clientId;
    return mapped === p.clientId ? p : { ...p, clientId: mapped };
});

const projectPlan = mergeProjects({
    local: projectsWithMappedClients, remote: remoteProjects,
    dirtyIds: dirtyProjectIds, tombstones: projectTombstones,
});

// mergeTasks çağrısı DEĞİŞMEZ, mevcut haliyle kalır.
const taskPlan = mergeTasks({
    local: tasks, remote: remoteTasks, dirtyIds, tombstones,
});

// 3. Görev bağlarını onar: hem yeniden eşle hem karşılıksızları boşalt.
const validCategoryIds = new Set(categoryPlan.categories.map((c) => c.id));
const validClientIds = new Set(clientPlan.items.map((c) => c.id));
const validProjectIds = new Set(projectPlan.items.map((p) => p.id));
const repairedTasks = remapTaskLinks(
    remapTaskCategories(taskPlan.tasks, categoryPlan.idRemap, validCategoryIds),
    clientPlan.idRemap, projectPlan.idRemap, validClientIds, validProjectIds
);

// Gönderilecek görevler ONARILMIŞ sürümlerdir. taskPlan.toPush ham bağları
// taşır; onarılmamış hâlini göndermek, tekilleştirilmiş bir müşteriye ya da
// artık var olmayan bir projeye işaret eden satır demektir ve 23503 ile o
// turdaki BÜTÜN görev senkronizasyonunu düşürürdü.
const repairedById = new Map(repairedTasks.map((t) => [t.id, t]));
const pushableTasks = taskPlan.toPush.map((t) => repairedById.get(t.id) ?? t);

// 4. YAZMA — bağımlılık sırasına göre.
const savedCategories = await pushRemoteCategories(categoryPlan.toPush, userId);
const savedClients = await pushRemoteClients(clientPlan.toPush, userId);
const savedProjects = await pushRemoteProjects(projectPlan.toPush, userId);
const savedTasks = await pushRemoteTasks(pushableTasks, userId);

// 5. SİLME — ters sırada. Görev önce gider ki projeye/müşteriye asılı
//    kayıt kalmasın; müşteri en sonda, çünkü tetikleyicisi görevlere dokunuyor.
await deleteRemoteTasks(taskPlan.toDelete);
await deleteRemoteProjects(projectPlan.toDelete);
await deleteRemoteClients(clientPlan.toDelete);
await deleteRemoteCategories(categoryPlan.toDelete);
```

`applySyncResult` çağrısına yeni alanları geçirin: `clients`, `projects` ve
dört id listesi (`syncedClientIds` = `savedClients.map(c => c.id)` ile
`clientPlan.discardedIds` birleşimi; kategori kalıbının aynısı).

- [ ] **Adım 6: E2E senkron testi ekle**

`e2e/senkron.spec.ts` sonuna — bu, kategorilerde bir kez gerçekten olan
hatayı koruyan testin müşteri karşılığı:

```typescript
test('yalnızca müşteri değiştiğinde de senkron tetiklenir', async ({ page }) => {
    // pendingCount müşteri sayaçlarını içermezse bu test kırılır: müşteri
    // eklenir ama senkron bir sonraki yoklamaya kadar hiç çalışmaz.
    await page.goto('/app/clients');
    await page.getByRole('button', { name: 'Müşteri ekle' }).click();
    await page.getByLabel('Müşteri adı').fill('Acme');
    await page.getByRole('button', { name: 'Kaydet' }).click();

    await expect(page.getByTestId('sync-status')).toHaveAttribute(
        'data-status', 'syncing', { timeout: 5000 }
    );
});
```

> `sync-status` test id'si ve `data-status` niteliği mevcut senkron
> göstergesinde zaten varsa onu kullanın; yoksa dosyadaki diğer senkron
> testlerinin kullandığı seçiciyi kopyalayın.

- [ ] **Adım 7: Testleri koş**

```bash
npm test -- --run && npx tsc -b --noEmit
```

Beklenen: hepsi PASS, tip hatası yok.

- [ ] **Adım 8: Commit**

```bash
git add src/lib src/components e2e
git commit -m "Senkron: musteri ve proje turlari, bagimlilik sirasi"
```

---

## Görev 6: Özellik bayrağı ve i18n

**Dosyalar:**
- Değiştir: `src/config/features.ts`, `.env.example`, `src/vite-env.d.ts`
- Değiştir: `src/i18n/locales/tr.json`, `src/i18n/locales/en.json`
- Test: `src/config/features.test.ts` (mevcut dosyaya ekleme)

**Arayüzler:**
- Üretir: `features.nicheModule: boolean`; `client.*`, `project.*`,
  `delivery.*` çeviri anahtarları

- [ ] **Adım 1: Bayrak testini yaz**

`src/config/features.test.ts` içine:

```typescript
it('nicheModule yalnızca "true" metniyle açılır', () => {
    // Boolean("false") === true tuzağı: isEnabled bunu kabul etmemeli.
    expect(isEnabled('true')).toBe(true);
    expect(isEnabled('false')).toBe(false);
    expect(isEnabled(undefined)).toBe(false);
    expect(isEnabled('')).toBe(false);
});
```

- [ ] **Adım 2: Bayrağı ekle**

`src/config/features.ts`:

```typescript
    /**
     * Niş modül: müşteriler, projeler ve teslim görünümü.
     *
     * Kapalıyken /app/clients ve /app/delivery rotaları hiç kaydedilmez,
     * TaskForm'daki seçiciler render edilmez ve senkron müşteri/proje
     * adımlarını atlar. import.meta.env derleme zamanı sabiti olduğu için
     * kapalı dallar üretim paketinden elenir.
     */
    nicheModule: isEnabled(import.meta.env.VITE_NICHE_MODULE),
```

`.env.example`:

```bash
# Niş modül: müşteri/proje bağlantılı görev takibi ve teslim görünümü.
# Starter kit'i jenerik tutmak isteyenler bu satırı silebilir veya false
# yapabilir; modül arayüzden, rotalardan ve senkrondan tamamen çıkar.
VITE_NICHE_MODULE=true
```

`src/vite-env.d.ts`:

```typescript
  /**
   * Niş modül (müşteriler, projeler, teslim görünümü). Tanımlı değilse
   * modül tamamen kapalıdır.
   */
  readonly VITE_NICHE_MODULE?: string;
```

- [ ] **Adım 3: Çeviri anahtarlarını ekle**

`tr.json` ve `en.json`'a **aynı commit'te**. Türkçe:

```json
"client": {
  "title": "Müşteriler",
  "add": "Müşteri ekle",
  "edit": "Müşteriyi düzenle",
  "name": "Müşteri adı",
  "none": "Müşterisiz",
  "empty": "Henüz müşteri yok. İlk müşterinizi ekleyin.",
  "archive": "Arşivle",
  "unarchive": "Arşivden çıkar",
  "showArchived": "Arşivi göster",
  "archivedBadge": "Arşivlenmiş",
  "delete": "Müşteriyi sil",
  "deleteTitle": "{{name}} silinsin mi?",
  "deleteBody_zero": "Bu müşteri silinecek. Bağlı görev yok.",
  "deleteBody_one": "Bu müşteri ve {{projectCount}} projesi silinecek. {{count}} görevin müşteri bağı kopacak; görevler silinmez.",
  "deleteBody_other": "Bu müşteri ve {{projectCount}} projesi silinecek. {{count}} görevin müşteri bağı kopacak; görevler silinmez.",
  "nameTaken": "Bu adda bir müşteri zaten var.",
  "nameRequired": "Müşteri adı boş olamaz."
},
"project": {
  "title": "Projeler",
  "add": "Proje ekle",
  "edit": "Projeyi düzenle",
  "name": "Proje adı",
  "none": "Genel",
  "empty": "Bu müşteride henüz proje yok.",
  "selectClientFirst": "Önce müşteri seçin",
  "delete": "Projeyi sil",
  "deleteTitle": "{{name}} silinsin mi?",
  "deleteBody_zero": "Bu proje silinecek. Bağlı görev yok.",
  "deleteBody_one": "Bu proje silinecek. {{count}} görevin proje bağı kopacak; görevler ve müşteri bağı korunur.",
  "deleteBody_other": "Bu proje silinecek. {{count}} görevin proje bağı kopacak; görevler ve müşteri bağı korunur.",
  "nameTaken": "Bu müşteride aynı adda bir proje zaten var.",
  "nameRequired": "Proje adı boş olamaz."
},
"delivery": {
  "title": "Teslim",
  "empty": "Müşteriye bağlı görev yok.",
  "noDueDate": "Tarihsiz"
}
```

İngilizce karşılıkları aynı şekille (`_zero`/`_one`/`_other` çoğul ekleri ve
`{{name}}`, `{{count}}`, `{{projectCount}}` yer tutucuları birebir aynı
kalmalı — `i18n.test.ts` bunu doğruluyor).

- [ ] **Adım 4: i18n testlerini koş**

```bash
npm test -- --run src/i18n/i18n.test.ts src/config/features.test.ts
```

Beklenen: PASS. Eksik anahtar veya yer tutucu uyuşmazlığı varsa test söyler.

- [ ] **Adım 5: Commit**

```bash
git add src/config src/i18n .env.example src/vite-env.d.ts
git commit -m "Nis modul ozellik bayragi ve ceviri anahtarlari"
```

---

## Görev 7: Müşteri ve proje yönetim ekranı

**Dosyalar:**
- Oluştur: `src/features/clients/ClientManager.tsx`,
  `src/pages/ClientsPage.tsx`
- Değiştir: `src/router.tsx`, gezinme bileşeni (`AppLayout` içindeki
  masaüstü ve mobil gezinme listeleri)
- Test: `e2e/nis-modul.spec.ts` (yeni)

**Arayüzler:**
- Tüketir: store eylemleri (Görev 3); `projectsByClient`,
  `isClientNameTaken`, `isProjectNameTaken` (Görev 2); `features.nicheModule`
  (Görev 6)
- Üretir: `/app/clients` rotası

- [ ] **Adım 1: E2E testini yaz**

`e2e/nis-modul.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test.describe('niş modül: müşteri ve proje yönetimi', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/app/clients');
    });

    test('müşteri eklenir ve listede görünür', async ({ page }) => {
        await page.getByRole('button', { name: 'Müşteri ekle' }).click();
        await page.getByLabel('Müşteri adı').fill('Acme');
        await page.getByRole('button', { name: 'Kaydet' }).click();

        await expect(page.getByRole('button', { name: /Acme/ })).toBeVisible();
    });

    test('aynı adla ikinci müşteri engellenir', async ({ page }) => {
        for (const _ of [0, 1]) {
            await page.getByRole('button', { name: 'Müşteri ekle' }).click();
            await page.getByLabel('Müşteri adı').fill('Acme');
            await page.getByRole('button', { name: 'Kaydet' }).click();
        }
        await expect(page.getByText('Bu adda bir müşteri zaten var.')).toBeVisible();
    });

    test('projeler seçili müşteriye göre listelenir', async ({ page }) => {
        await page.getByRole('button', { name: 'Müşteri ekle' }).click();
        await page.getByLabel('Müşteri adı').fill('Acme');
        await page.getByRole('button', { name: 'Kaydet' }).click();
        await page.getByRole('button', { name: /Acme/ }).click();

        await page.getByRole('button', { name: 'Proje ekle' }).click();
        await page.getByLabel('Proje adı').fill('Websitesi');
        await page.getByRole('button', { name: 'Kaydet' }).click();

        await expect(page.getByText('Websitesi')).toBeVisible();
    });

    test('müşteri silme diyaloğu etkiyi sayıyla söyler', async ({ page }) => {
        await page.getByRole('button', { name: 'Müşteri ekle' }).click();
        await page.getByLabel('Müşteri adı').fill('Acme');
        await page.getByRole('button', { name: 'Kaydet' }).click();
        await page.getByRole('button', { name: /Acme/ }).click();

        await page.getByRole('button', { name: 'Proje ekle' }).click();
        await page.getByLabel('Proje adı').fill('Websitesi');
        await page.getByRole('button', { name: 'Kaydet' }).click();

        await page.getByRole('button', { name: 'Acme müşterisini sil' }).click();

        const dialog = page.getByRole('alertdialog');
        await expect(dialog).toContainText('1 projesi');
        await expect(dialog).toContainText('görevler silinmez');
    });

    test('arşivlenen müşteri varsayılan listede gizlenir', async ({ page }) => {
        await page.getByRole('button', { name: 'Müşteri ekle' }).click();
        await page.getByLabel('Müşteri adı').fill('Eski Müşteri');
        await page.getByRole('button', { name: 'Kaydet' }).click();
        await page.getByRole('button', { name: 'Eski Müşteri arşivle' }).click();

        await expect(page.getByRole('button', { name: /Eski Müşteri/ })).toBeHidden();

        await page.getByRole('checkbox', { name: 'Arşivi göster' }).check();
        await expect(page.getByRole('button', { name: /Eski Müşteri/ })).toBeVisible();
    });
});
```

- [ ] **Adım 2: Testlerin başarısız olduğunu doğrula**

```bash
npx playwright test e2e/nis-modul.spec.ts --reporter=list
```

Beklenen: FAIL — `/app/clients` bulunamadı (404 sayfası).

- [ ] **Adım 3: `ClientManager` bileşenini yaz**

Mevcut `CategoryManager`'ı referans alın ve aynı görsel dili koruyun. Yapı:

- İki sütunlu düzen (mobilde tek sütun, seçili müşteri projelerine geçiş).
- **Sol:** müşteri listesi. Her satır: ad, proje sayısı rozeti, düzenle /
  arşivle / sil ikon butonları. Her ikon butonu `aria-label` taşır ve ad
  içerir (`"Acme müşterisini sil"`, `"Acme arşivle"`).
- **Sağ:** seçili müşterinin projeleri, aynı satır düzeni.
- Üstte "Arşivi göster" onay kutusu; kapalıyken `archived` kayıtlar gizli.
- Ekleme/düzenleme Radix `Dialog` içinde tek metin alanı + Kaydet.
  Doğrulama: boş ad → `client.nameRequired`; çakışan ad →
  `client.nameTaken` (`isClientNameTaken` / `isProjectNameTaken`).
- Silme Radix `AlertDialog`. Gövde metni sayıları içerir:

```typescript
// Silmenin etkisini sayıyla söylemek şart: kullanıcı "5 görev bağı kopacak"
// uyarısını görmeden onaylarsa geri alamaz (senkron turunda buluta da gider).
const doomedProjects = projects.filter((p) => p.clientId === client.id);
const doomedProjectIds = new Set(doomedProjects.map((p) => p.id));
const affectedTaskCount = tasks.filter(
    (t) => t.clientId === client.id || (t.projectId && doomedProjectIds.has(t.projectId))
).length;

t('client.deleteBody', {
    count: affectedTaskCount,
    projectCount: doomedProjects.length,
});
```

`src/pages/ClientsPage.tsx` yalnızca sayfa başlığı + `<ClientManager />`
sarmalar (`SettingsPage` kalıbı).

- [ ] **Adım 4: Rotayı ve gezinmeyi bayrakla kaydet**

`src/router.tsx`:

```typescript
/**
 * Niş modül rotaları. features.nicheModule kapalıyken dizi boşalır ve
 * rotalar pakete hiç girmez — /app/__crash ile aynı mekanizma.
 */
const nicheRoutes: RouteObject[] = features.nicheModule
    ? [
        { path: 'clients', element: <ClientsPage />, errorElement: <RouteErrorBoundary /> },
      ]
    : [];
```

`/app` çocuklarına `...nicheRoutes` ekleyin. Gezinme bileşeninde bağlantıyı
aynı bayrakla koşullayın.

- [ ] **Adım 5: E2E testlerini koş**

```bash
npx playwright test e2e/nis-modul.spec.ts --reporter=list
```

Beklenen: hepsi PASS.

- [ ] **Adım 6: Tüm testleri koş**

```bash
npm test -- --run && npm run lint && npx tsc -b --noEmit
```

- [ ] **Adım 7: Commit**

```bash
git add src/features src/pages src/router.tsx src/components e2e
git commit -m "Musteri ve proje yonetim ekrani"
```

---

## Görev 8: TaskForm seçicileri

**Dosyalar:**
- Oluştur: `src/features/clients/ClientProjectSelect.tsx`
- Değiştir: `src/components/TaskForm.tsx`
- Test: `e2e/nis-modul.spec.ts` (ekleme)

**Arayüzler:**
- Tüketir: `projectsByClient` (Görev 2); store `clients`/`projects`
- Üretir: `<ClientProjectSelect clientId projectId onChange />` —
  `onChange(next: { clientId: string | null; projectId: string | null })`

- [ ] **Adım 1: E2E testini yaz**

`e2e/nis-modul.spec.ts` içine yeni bir `describe`:

```typescript
test.describe('niş modül: görev formu seçicileri', () => {
    test('görev müşteriye ve projeye bağlanır', async ({ page }) => {
        await page.goto('/app/clients');
        await page.getByRole('button', { name: 'Müşteri ekle' }).click();
        await page.getByLabel('Müşteri adı').fill('Acme');
        await page.getByRole('button', { name: 'Kaydet' }).click();
        await page.getByRole('button', { name: /Acme/ }).click();
        await page.getByRole('button', { name: 'Proje ekle' }).click();
        await page.getByLabel('Proje adı').fill('Websitesi');
        await page.getByRole('button', { name: 'Kaydet' }).click();

        await page.goto('/app');
        await page.keyboard.press('n');
        await page.getByLabel('Başlık').fill('Logo taslağı');
        await page.getByLabel('Müşteri').selectOption({ label: 'Acme' });
        await page.getByLabel('Proje').selectOption({ label: 'Websitesi' });
        await page.getByRole('button', { name: 'Kaydet' }).click();

        await expect(page.getByText('Logo taslağı')).toBeVisible();
    });

    test('müşteri seçilmeden proje seçici devre dışıdır', async ({ page }) => {
        await page.goto('/app');
        await page.keyboard.press('n');
        await expect(page.getByLabel('Proje')).toBeDisabled();
    });

    test('müşteri değişince seçili proje temizlenir', async ({ page }) => {
        // Bu olmadan form, projesi başka müşteriye ait bir görev gönderirdi
        // ve şemadaki tasks_project_id_fkey bunu reddederdi.
        await page.goto('/app/clients');
        for (const name of ['Acme', 'Startup X']) {
            await page.getByRole('button', { name: 'Müşteri ekle' }).click();
            await page.getByLabel('Müşteri adı').fill(name);
            await page.getByRole('button', { name: 'Kaydet' }).click();
        }
        await page.getByRole('button', { name: /Acme/ }).click();
        await page.getByRole('button', { name: 'Proje ekle' }).click();
        await page.getByLabel('Proje adı').fill('Websitesi');
        await page.getByRole('button', { name: 'Kaydet' }).click();

        await page.goto('/app');
        await page.keyboard.press('n');
        await page.getByLabel('Müşteri').selectOption({ label: 'Acme' });
        await page.getByLabel('Proje').selectOption({ label: 'Websitesi' });
        await page.getByLabel('Müşteri').selectOption({ label: 'Startup X' });

        await expect(page.getByLabel('Proje')).toHaveValue('');
    });
});
```

- [ ] **Adım 2: Testlerin başarısız olduğunu doğrula**

```bash
npx playwright test e2e/nis-modul.spec.ts --reporter=list -g "görev formu"
```

Beklenen: FAIL — `Müşteri` etiketli alan yok.

- [ ] **Adım 3: `ClientProjectSelect` bileşenini yaz**

Mevcut kategori seçicinin görsel dilini izleyin. Davranış kuralları:

```typescript
// Müşteri değişince proje MUTLAKA temizlenir: projesi başka müşteriye ait bir
// görev şemadaki bileşik yabancı anahtarı ihlal eder. Müşteri temizlenince
// proje de temizlenir (tasks_project_requires_client).
function handleClientChange(nextClientId: string | null) {
    onChange({ clientId: nextClientId, projectId: null });
}

// Arşivlenmiş kayıtlar seçenek listesinde YOKTUR — ama göreve zaten bağlıysa
// gösterilir; aksi halde kullanıcı bağı göremeden kaybederdi.
const clientOptions = clients
    .filter((c) => !c.archived || c.id === clientId)
    .sort(byClientPosition);

const projectOptions = clientId
    ? projectsByClient(projects, clientId).filter((p) => !p.archived || p.id === projectId)
    : [];
```

Proje seçici `clientId === null` iken `disabled` ve yer tutucu metni
`project.selectClientFirst`.

- [ ] **Adım 4: `TaskForm`'a bağla**

Form durumuna `clientId` ve `projectId` ekleyin, gönderimde store'a geçirin.
Bileşeni bayrakla koşullayın:

```tsx
{features.nicheModule && (
    <ClientProjectSelect
        clientId={form.clientId}
        projectId={form.projectId}
        onChange={(next) => setForm((f) => ({ ...f, ...next }))}
    />
)}
```

- [ ] **Adım 5: Testleri koş**

```bash
npx playwright test e2e/nis-modul.spec.ts --reporter=list
npm test -- --run
```

Beklenen: hepsi PASS.

- [ ] **Adım 6: Commit**

```bash
git add src/features src/components e2e
git commit -m "TaskForm: musteri ve proje secicileri"
```

---

## Görev 9: Teslim görünümü

**Dosyalar:**
- Oluştur: `src/features/delivery/DeliveryView.tsx`,
  `src/features/delivery/grouping.ts`, `src/pages/DeliveryPage.tsx`
- Değiştir: `src/router.tsx`, gezinme
- Test: `src/features/delivery/grouping.test.ts`, `e2e/nis-modul.spec.ts`

**Arayüzler:**
- Tüketir: store `tasks`/`clients`/`projects`; mevcut `FilterBar`
- Üretir:
  - `groupForDelivery(tasks, clients, projects): DeliveryGroup[]`
  - `interface DeliveryGroup { client: Client | null; projects: { project: Project | null; tasks: Task[] }[] }`
  - `/app/delivery` rotası

- [ ] **Adım 1: Gruplama testini yaz**

`src/features/delivery/grouping.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { groupForDelivery } from './grouping';
import { createClient } from '@/lib/clients';
import { createProject } from '@/lib/projects';
import type { Task } from '@/lib/types';

const task = (over: Partial<Task> & { id: string; title: string }): Task => ({
    description: '', dueDate: null, priority: 'medium',
    categoryId: null, clientId: null, projectId: null,
    completed: false, completedAt: null, position: 0,
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
});
```

- [ ] **Adım 2: Testlerin başarısız olduğunu doğrula**

```bash
npm test -- --run src/features/delivery/grouping.test.ts
```

Beklenen: FAIL — modül bulunamadı.

- [ ] **Adım 3: `grouping.ts` dosyasını yaz**

Saf fonksiyon, yeni sorgu yok — mevcut `tasks` dizisi yeniden gruplanır.
Kurallar:

- Müşteriler `byClientPosition` sırasında; müşterisiz grup (`client: null`)
  en sonda.
- Her müşteri içinde projeler `byProjectPosition`; projesiz grup
  (`project: null`, arayüzde `project.none` = "Genel") **başta**.
- Her grupta görevler `dueDate` artan; `dueDate === null` olanlar sonda,
  aralarında `position`.
- Görevi olmayan müşteri/proje için grup üretilmez.
- Arşivlenmiş müşteri **gizlenmez** — görevi varsa grubu görünür. Arşiv
  yalnızca seçicileri sadeleştirir.

- [ ] **Adım 4: `DeliveryView` ve rotayı yaz**

`DeliveryView.tsx` grupları başlıklarla render eder ve mevcut görev satırı
bileşenini yeniden kullanır (tıklayınca `TaskForm` açılır). Mevcut
`FilterBar` (`all`/`active`/`completed`) ve arama aynen çalışır; arama
görev başlığının yanında müşteri ve proje adında da eşleşir.

`src/router.tsx` içindeki `nicheRoutes` dizisine ekleyin:

```typescript
        { path: 'delivery', element: <DeliveryPage />, errorElement: <RouteErrorBoundary /> },
```

- [ ] **Adım 5: E2E testi ekle**

```typescript
test('teslim görünümü görevleri müşteri ve projeye göre gruplar', async ({ page }) => {
    await page.goto('/app/clients');
    await page.getByRole('button', { name: 'Müşteri ekle' }).click();
    await page.getByLabel('Müşteri adı').fill('Acme');
    await page.getByRole('button', { name: 'Kaydet' }).click();

    await page.goto('/app');
    await page.keyboard.press('n');
    await page.getByLabel('Başlık').fill('Logo taslağı');
    await page.getByLabel('Müşteri').selectOption({ label: 'Acme' });
    await page.getByRole('button', { name: 'Kaydet' }).click();

    await page.goto('/app/delivery');
    const group = page.getByRole('region', { name: 'Acme' });
    await expect(group).toContainText('Genel');
    await expect(group).toContainText('Logo taslağı');
});
```

- [ ] **Adım 6: Testleri koş**

```bash
npm test -- --run && npx playwright test e2e/nis-modul.spec.ts --reporter=list
```

- [ ] **Adım 7: Commit**

```bash
git add src/features src/pages src/router.tsx e2e
git commit -m "Teslim gorunumu: musteri ve projeye gore gruplama"
```

---

## Görev 10: Bayrak kapalı doğrulaması

**Dosyalar:**
- Test: `e2e/nis-modul.spec.ts` (ekleme)
- Değiştir: `CLAUDE.md`

**Arayüzler:**
- Tüketir: Görev 1–9'un tamamı

- [ ] **Adım 1: Bayrak kapalıyken derle ve izini ara**

```bash
VITE_NICHE_MODULE=false npm run build
```

Ardından üretim çıktısında niş modüle ait iz kalmadığını doğrulayın:

```bash
grep -rl "ClientManager\|DeliveryView\|app/clients" dist/assets || echo "iz yok - dogru"
```

Beklenen: `iz yok - dogru`. İz çıkarsa bir yerde bayrak koşulu çalışma
zamanına kalmış demektir; `import.meta.env` koşulunun modül gövdesinde,
render içinde değil, dizi/rota kaydı seviyesinde olduğundan emin olun.

- [ ] **Adım 2: Bayrak açıkken derlemenin hâlâ çalıştığını doğrula**

```bash
VITE_NICHE_MODULE=true npm run build
```

Beklenen: başarılı. Precache boyutunun Sentry parçasını içermediğini
doğrulayın (mevcut davranış korunmalı).

- [ ] **Adım 3: Tüm test paketini koş**

```bash
npm test -- --run
npx playwright test --reporter=list
npm run test:rls
npm run lint
npx tsc -b --noEmit
```

Beklenen: hepsi yeşil. Bu, planın bitiş kapısıdır — bir tanesi bile
kırmızıysa görev tamamlanmamıştır.

- [ ] **Adım 4: `CLAUDE.md`'yi güncelle**

Bunlar **gerçeği yansıtmak zorunda** (dosyanın kendi kuralı):

- **Mevcut durum → Veritabanı:** `clients` ve `projects` tablolarını şema
  listesine ekleyin; `tasks` satırına `client_id`, `project_id` ekleyin.
- **Mevcut durum → Test:** yeni toplam sayıları yazın (birim / e2e / şema).
- **Mimari kararlar:** bileşik yabancı anahtar + `check` kısıtı ikilisini ve
  müşteri silme tetikleyicisini ekleyin; senkron sırası paragrafına müşteri
  ve projeyi ekleyin; `pendingCount` uyarısını genişletin.
- **Fazlar → Faz 5:** 1. dilimi ✅ işaretleyin, kalan işi (`time_logs`, CSV
  dışa aktarım) açıkça yazın.
- **Sapma günlüğü:** iki satır ekleyin — (a) niş modül tek parça planlanmıştı,
  iki dilime bölündü, sebebi zaman kaydının farklı senkron semantiği; (b)
  `mergeNamed` çekirdeği spec "kopyala" derken çıkarıldı, sebebi üçüncü
  örneğin bu dilimde gelmesi. *(b) yalnızca Görev 4'teki sapma kabul
  edildiyse yazılır.*

- [ ] **Adım 5: Commit**

```bash
git add CLAUDE.md e2e
git commit -m "Nis modul 1. dilim tamam: bayrak dogrulamasi ve plan guncellemesi"
```

---

## Öz Değerlendirme

**Spec kapsamı.** Spec'in her bölümü bir göreve karşılık geliyor: §1 şema →
Görev 1; §2 tipler → Görev 2; §3.2 store → Görev 3; §3.4 birleştirme →
Görev 4; §3.3+3.5 senkron sırası ve `pendingCount` → Görev 5; §4.4 bayrak
ve §5 i18n → Görev 6; §4.1 yönetim → Görev 7; §4.2 TaskForm → Görev 8;
§4.3 teslim görünümü → Görev 9; §6 test ve bayrak-kapalı doğrulaması →
Görev 10 (ayrıca her göreve dağıtılmış). §7 uygulama sırası bu plandaki
görev sırasıyla birebir.

**Bilinçli sapma.** Görev 4'teki `mergeNamed` çekirdeği; yukarıda ayrı
bölümde gerekçelendirildi ve reddedilmesi halinde ne yapılacağı yazıldı.

**Kapsam dışı olduğu doğrulanan.** `time_logs` ve CSV dışa aktarım spec'te
açıkça ertelenmişti; planda da yok. Senkron motorunun tam genelleştirilmesi
(varlık tanımını veri olarak yazma) ertelenmiş borç olarak duruyor —
`runSync`, repository ve store hâlâ varlık başına elle yazılıyor.
