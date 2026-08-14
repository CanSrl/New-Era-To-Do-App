# Constraints (SPEC)

Synthesized from 2 SPEC-classified documents. Precedence: both default SPEC,
no per-doc override, no locked flags. Where the two sources contradict, both
variants are preserved verbatim and surfaced in `.planning/INGEST-CONFLICTS.md`.

Source shorthand:
- `SPEC-DESIGN` = `docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md`
- `SPEC-PLAN` = `docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md`

---

## CON-01: `clients` tablosu şeması
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.1); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 1 Adım 1)
- type: schema
- content:
  ```
  id          uuid pk default gen_random_uuid()
  user_id     uuid not null -> auth.users(id) on delete cascade
  name        text not null, btrim(name) <> '', char_length(name) <= 80
  archived    boolean not null default false
  position    double precision not null default 0
  created_at  timestamptz not null default now()
  updated_at  timestamptz not null default now()  -- set_updated_at tetikleyicisi
  constraint clients_id_user_id_key unique (id, user_id)
  index clients_user_id_idx on (user_id, position, created_at)
  ```
  `unique (id, user_id)` zorunludur: hem `projects` hem `tasks` buraya bileşik
  yabancı anahtarla bağlanır ve bir FK ancak tam olarak referans verdiği sütun
  listesi üzerindeki bir benzersizlik kısıtına bağlanabilir.

## CON-02: `clients` tablosunda renk sütunu yoktur
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.1)
- type: schema
- content: Görev satırında zaten kategori renk rozeti var; ikinci renkli rozet
  gürültü olur. Teslim görünümü müşterileri başlıkla ayırır.

## CON-03: `archived` alanı silme yerine arşiv sağlar
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.1)
- type: schema
- content: Serbest çalışan iki yılda onlarca müşteri biriktirir. Silme tek
  seçenek olsaydı geçmiş görevlerin bağı kopardı; arşiv kaydı seçiciden gizler
  ama geçmişi korur.

## CON-04: `clients` ve `projects` üzerinde ad benzersizlik kısıtı YOKTUR
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.1); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Global Kısıtlar)
- type: schema
- content: `categories` ile aynı gerekçe. Çevrimdışı iki cihaz aynı adla kayıt
  oluşturabilir; `unique (user_id, name)` olsaydı ikinci cihazın push'u 23505
  ile düşer ve **o turdaki bütün senkronu** beraberinde götürürdü.
  Tekilleştirme istemcideki birleştirme motorunda, tekrar engelleme arayüzdedir.

## CON-05: `projects` tablosu şeması ve bileşik yabancı anahtarı
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.2); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 1 Adım 1)
- type: schema
- content:
  ```sql
  client_id uuid not null   -- proje her zaman bir müşteriye aittir
  constraint projects_client_id_fkey
    foreign key (client_id, user_id) references public.clients (id, user_id)
    on delete cascade
  constraint projects_id_client_id_user_id_key unique (id, client_id, user_id)
  index projects_user_id_idx on (user_id, position, created_at)
  index projects_client_id_idx on (client_id)
  ```
  `user_id` referansa katılır çünkü **FK kontrolü RLS'i atlar**: tek sütunlu
  referans olsaydı kullanıcı başkasının müşteri id'sini bilirse projesini ona
  bağlayabilirdi. Üçlü benzersizlik `(id, user_id)` değildir çünkü `tasks`
  projeye `(project_id, client_id, user_id)` üçlüsüyle bağlanır.

## CON-06: `tasks.client_id` / `tasks.project_id` ve üç bütünlük kısıtı
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.3); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 1 Adım 1)
- type: schema
- content: İki sütun da nullable (görev müşterisiz, ya da müşterili-projesiz
  olabilir). Üç kısıt birlikte tutarlılığı sağlar:
  ```sql
  -- (1) Proje varsa müşteri de olmalı
  constraint tasks_project_requires_client
    check (project_id is null or client_id is not null)

  -- (2) Müşteri bağı geçerli olmalı (referans eylemi yok = no action)
  constraint tasks_client_id_fkey
    foreign key (client_id, user_id) references public.clients (id, user_id)

  -- (3) Projenin müşterisi görevin müşterisiyle aynı olmalı
  constraint tasks_project_id_fkey
    foreign key (project_id, client_id, user_id)
      references public.projects (id, client_id, user_id)
    on delete set null (project_id)
    on update cascade

  index tasks_client_id_idx  on tasks (client_id)  where client_id  is not null
  index tasks_project_id_idx on tasks (project_id) where project_id is not null
  ```
  (3) tasarımın kilit noktasıdır: `client_id`'yi referansa katmak "görev A
  müşterisine bağlı ama projesi B müşterisinin" durumunu **şemada imkânsız**
  kılar. Uygulama katmanında kontrol yeterli olmazdı — doğrudan API çağrısıyla
  aşılırdı.

## CON-07: (1) numaralı `check` MATCH SIMPLE yüzünden zorunludur
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.3); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 1 Adım 1)
- type: schema
- content: Bileşik yabancı anahtarlar varsayılan `MATCH SIMPLE` ile çalışır ve
  sütunlardan **herhangi biri** NULL ise kısıt hiç değerlendirilmez. O `check`
  olmasaydı `project_id` dolu / `client_id` boş bir satır (3)'ü sessizce atlar
  ve müşterisiz bir projeye asılı görev oluşurdu.

## CON-08: `on delete set null (project_id)` ve `on update cascade` gerekçeleri
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.3)
- type: schema
- content: `on delete set null (project_id)` — tek bir proje silinince görev
  silinmez, yalnızca proje bağı kopar; `client_id` yerinde kalır, dolayısıyla
  (1) bozulmaz. Sütun listeli biçim **Postgres 15+** ile gelir.
  `on update cascade` — kullanıcı bir projeyi başka müşteriye taşırsa
  (`projects.client_id` güncellenir) bağlı görevlerin `client_id`'si de otomatik
  taşınır; olmasaydı güncelleme FK hatasıyla düşerdi.

## CON-09: Müşteri silme tetikleyicisi `clear_tasks_for_deleted_client`
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.4); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 1 Adım 1)
- type: schema
- content:
  ```sql
  create function public.clear_tasks_for_deleted_client()
  returns trigger language plpgsql
  set search_path = ''            -- yalnızca SPEC-PLAN'da; bkz. INGEST-CONFLICTS INFO
  as $$
  begin
    update public.tasks
       set client_id = null, project_id = null
     where client_id = old.id;
    return old;
  end;
  $$;

  create trigger clients_clear_tasks
    before delete on public.clients
    for each row execute function public.clear_tasks_for_deleted_client();
  ```
  **Neden gerekli:** müşteri silinince projeleri cascade ile gitmeli **ve**
  görevlerin iki alanı birden boşalmalı. Yalnızca referans eylemleriyle ifade
  edilemez — (2)'ye `on delete set null` verilseydi sadece `client_id` boşalır,
  `project_id` dolu kalır ve (1) patlardı; `set null`'un sütun listesi yalnızca
  o kısıtın **kendi** referans sütunlarını kabul eder.
  **Tek `where` yetiyor:** projesi üzerinden bağlı her görevin `client_id`'si
  zaten aynı müşteriyi gösterir — (3) bunu garanti eder.
  **Sıra garantili:** satır bazlı `before delete`, FK referans eylemlerinden
  (dahili `after` tetikleyicileri) önce çalışır.
  **`security definer` kullanılmaz:** tetikleyici çağıranın yetkisiyle çalışır,
  güncellediği satırlar zaten onun kendi görevleridir; gereksiz yetki
  yükseltmesi olurdu.

## CON-10: GRANT ve RLS kalıbı
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.5); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 1 Adım 1)
- type: schema
- content: `categories` ile birebir aynı kalıp — `authenticated` rolüne dört
  yetki (`select/insert/update/delete`), `anon`'a `revoke all`, iki tabloda da
  `enable row level security`, dört politika, hepsi `(select auth.uid()) = user_id`
  üzerinden.
  **GRANT olmadan RLS politikaları hiç değerlendirilmez** ve her istek
  "permission denied" döner. Bu bir kez gerçek bir hataya yol açtı;
  `supabase/tests/rls.test.mjs` bunu korur.

## CON-11: Migration tek dosyada durur (çıkarılabilirlik)
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§4.4); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 1 Adım 1)
- type: schema
- content: `supabase/migrations/20260814120000_niche_module.sql`. Starter kit
  alıcısı niş modülü istemiyorsa dosyayı silip `VITE_NICHE_MODULE`'ü kapatarak
  modülü tamamen çıkarabilir.

## CON-12: Postgres 15+ zorunludur
- source: docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Global Kısıtlar); docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.3)
- type: nfr
- content: `on delete set null (sütun_listesi)` sözdizimi Postgres 15+ gerektirir.

## CON-13: `Client` / `Project` istemci tipleri
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§2); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 2)
- type: api-contract
- content:
  ```ts
  interface Client { id: string; name: string; archived: boolean;
                     position: number; createdAt: string; updatedAt: string }
  interface Project extends Client { clientId: string }
  ```
  `createdAt`/`updatedAt` ISO 8601; çakışma `updatedAt`'e göre çözülür.
  `Task` iki alan kazanır: `clientId: string | null`, `projectId: string | null`.
  **Değişmez:** `projectId` doluysa `clientId` de dolu. `normalizeTask` bunu
  zorlar — `projectId` dolu ama `clientId` boş gelen ham veride `projectId`
  düşürülür. Bu satır olmadan bozuk kayıt senkronda 23514 alır ve o turdaki
  bütün görev senkronizasyonunu düşürür.

## CON-14: Ad uzunluğu sınırı 80 karakter
- source: docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Global Kısıtlar, Görev 2); docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§1.1)
- type: schema
- content: `CLIENT_NAME_MAX = 80`, `PROJECT_NAME_MAX = 80`; veritabanı
  `char_length(name) <= 80` kısıtıyla aynı. Kategorilerde bu 40'tır; niş modülde
  şirket ve proje adları daha uzun olabildiği için ayrıştı.

## CON-15: Saf yardımcı fonksiyon yüzeyi (`clients.ts`, `projects.ts`)
- source: docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 2)
- type: api-contract
- content:
  ```
  normalizeClient(raw, fallbackPosition): Client | null
  createClient(name, position, now?): Client
  byClientPosition(a, b): number
  nextClientPosition(clients): number
  isClientNameTaken(clients, name, exceptId?): boolean
  normalizeProject(raw, fallbackPosition): Project | null
  createProject(clientId, name, position, now?): Project
  byProjectPosition; nextProjectPosition(projects, clientId)
  isProjectNameTaken(projects, clientId, name, exceptId?): boolean
  projectsByClient(projects, clientId): Project[]
  ```
  Ad karşılaştırması `categoryKey` ile yapılır (Türkçe I/İ çiftini doğru çeviren
  yerel duyarlı biçim). Proje ad çakışması **müşteri kapsamlıdır**: iki farklı
  müşterinin "Websitesi" projesi olması normaldir.

## CON-16: Store alanları ve sürüm 5 göçü
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§3.2); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 3)
- type: api-contract
- content: `src/store/index.ts`'e sekiz alan: `clients`, `projects`,
  `dirtyClientIds`, `clientTombstones`, `dirtyProjectIds`, `projectTombstones`.
  `partialize` hepsini kalıcılaştırır. `prepareForSync` üç dalı da işler
  (aynı hesap: değişiklik yok / misafir: tüm id'ler dirty / başka hesap: hepsi
  boş). `persist` sürümü **5**'e çıkar; göç yolu yeni alanları boş dizilerle
  doldurur ve mevcut görevlere `clientId: null, projectId: null` ekler.
  `applySyncResult` imzası dört yeni id listesi alır (`syncedClientIds`,
  `clearedClientTombstoneIds`, `syncedProjectIds`, `clearedProjectTombstoneIds`)
  artı `clients` ve `projects`.
  Store eylemleri: `addClient`, `renameClient`, `setClientArchived`,
  `deleteClient`, `addProject`, `renameProject`, `setProjectArchived`,
  `deleteProject`.

## CON-17: Store silme davranışı veritabanıyla aynı sonucu üretmek zorundadır
- source: docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 3 Adım 3)
- type: protocol
- content: `deleteClient` müşteriyi, projelerini ve görev bağlarını birlikte
  kaldırır; görevleri **silmez**. Veritabanındaki `clients_clear_tasks` + cascade
  ile aynı sonucu üretmelidir — iki taraf ayrışırsa senkron turunda görev
  bağları geri dirilir. `deleteProject` yalnızca `projectId`'yi boşaltır,
  `clientId` kalır.
  Görevlerin `updatedAt` damgası bilinçli olarak **tazelenmez**: bu bir kullanıcı
  düzenlemesi değil, bağ onarımıdır. Damgayı ilerletmek aynı görevi başka
  cihazda gerçekten düzenleyen kullanıcının değişikliğini haksız yere yenerdi.

## CON-18: Senkron yazma/silme sırası serbest değildir
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§3.3); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 5 Adım 5)
- type: protocol
- content:
  ```
  Yazma:  kategoriler -> müşteriler -> projeler -> görevler
  Silme:  görevler -> projeler -> müşteriler -> kategoriler
  ```
  Proje, müşterisi yazılmadan gönderilirse 23503 alır; görev de projesi
  yazılmadan gönderilirse aynısını. Silmede ters yön aynı sebeple. Müşteri en
  sonda silinir çünkü tetikleyicisi görevlere dokunur.
  Bulut anlık görüntüleri paralel çekilebilir (`Promise.all`).

## CON-19: Birleştirme semantiği
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§3.4); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 4 Adım 1)
- type: protocol
- content: `mergeClients` / `mergeProjects` saf fonksiyondur, ağ çağrısı yoktur.
  Çakışmada `updatedAt` yenisi kazanır; eşitlikte bulut kazanır ve yerel sürüm
  `discardedIds`'e düşer. Aynı adlı kayıtlar `idRemap` ile buluttakine katlanır.
  Dirty olmayan ve bulutta bulunmayan kayıt düşürülür. Dirty kayıt `toPush`
  listesine girer.
  "Aynı kayıt" tanımı varlığa göre değişir: kategoriler ve müşteriler için
  yalnızca ad, projeler için `(müşteri, ad)` çifti.

## CON-20: Zincirleme id yeniden eşleme sırası
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§3.4); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 5 Adım 5)
- type: protocol
- content:
  ```
  1. mergeClients -> clientIdRemap
  2. Yerel projelerin clientId'si clientIdRemap ile yeniden yazılır
  3. mergeProjects -> projectIdRemap
  4. remapTaskLinks(...) — iki bağı yeniden yazar, karşılığı kalmayanları
     boşaltır, projectId boşalırken clientId'nin tutarlı kalmasını sağlar
  ```
  2. adım olmadan tekilleştirilmiş müşteriye bağlı proje push'u 23503 alır.
  `remapTaskCategories` bu dördüncü adımın içine katlanır ya da yanında çalışır;
  ikisi de saf fonksiyon olduğu için birim testiyle kapsanır.
  NOT: `remapTaskLinks` imzası iki kaynakta farklı yazılmıştır — bkz.
  INGEST-CONFLICTS [INFO].

## CON-21: Gönderilen görevler onarılmış sürümlerdir
- source: docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 5 Adım 5)
- type: protocol
- content: `taskPlan.toPush` ham bağları taşır. Onarılmamış hâlini göndermek,
  tekilleştirilmiş bir müşteriye ya da artık var olmayan bir projeye işaret eden
  satır demektir ve 23503 ile o turdaki **bütün** görev senkronizasyonunu
  düşürür. Push edilecek liste `remapTaskLinks` çıktısından id ile eşlenerek
  kurulur.

## CON-22: `pendingCount` dört yeni sayacı içermek ZORUNDADIR
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§3.5); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 5 Adım 4)
- type: protocol
- content: `SyncProvider`'daki `pendingCount`, `dirtyClientIds`,
  `clientTombstones`, `dirtyProjectIds`, `projectTombstones` sayaçlarını
  içermelidir. İçermezse yalnızca müşteri/proje değiştiğinde senkron hiç
  tetiklenmez ve **sessizce başarısız olur** (hata da vermez). Bu tam olarak
  kategorilerde bir kez gerçekten oldu; `e2e/senkron.spec.ts` o vakayı korur ve
  aynısı bu varlıklar için de yazılır.

## CON-23: Repository ve eşleme fonksiyon yüzeyi
- source: docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 5)
- type: api-contract
- content:
  ```
  fetchRemoteClients()            pushRemoteClients(clients, userId)
  deleteRemoteClients(ids)        fetchRemoteProjects()
  pushRemoteProjects(projects, userId)  deleteRemoteProjects(ids)
  clientToRow / rowToClient       projectToRow / rowToProject
  ```
  `category-mapping.ts` kalıbının aynısı; `task-mapping.ts` iki yeni sütun alır.

## CON-24: `/app/clients` yönetim ekranı
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§4.1)
- type: api-contract
- content: `CategoryManager` desenini izler. İki panel: solda müşteri listesi,
  sağda seçili müşterinin projeleri. Ekle / yeniden adlandır / arşivle / sil.
  Arşivlenmiş kayıtlar varsayılan gizli, "Arşivi göster" ile açılır.
  Silme diyalogları etkiyi **sayıyla** söyler (Radix `AlertDialog`, `confirm()`
  değil): "Acme silinecek. 2 projesi de silinecek ve 5 görevin müşteri bağı
  kopacak. Görevler silinmez."

## CON-25: TaskForm iki opsiyonel seçici
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§4.2); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 8)
- type: api-contract
- content: Müşteri seçici (boş bırakılabilir) ve proje seçici. Proje seçici
  müşteriye bağımlıdır: müşteri seçili değilse devre dışı, seçiliyse yalnızca o
  müşterinin **arşivlenmemiş** projelerini listeler.
  Müşteri değiştirilince seçili proje **temizlenir** — aksi halde (3) numaralı
  FK'yı ihlal eden bir gönderim oluşurdu. Müşteri temizlenince proje de
  temizlenir ((1) numaralı `check`).
  Arşivlenmiş bir kayda zaten bağlı olan görev açıldığında o kayıt seçicide
  görünür (yoksa kullanıcı bağı göremeden kaybederdi).

## CON-26: `/app/delivery` teslim görünümü
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§4.3); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 9)
- type: api-contract
- content: Mevcut `tasks` dizisi üzerinde **salt okunur bir yeniden gruplama**;
  yeni sorgu ya da yeni veri yok. Gruplama müşteriye, içinde projeye göre;
  projesiz-müşterili görevler "Genel", müşterisizler "Müşterisiz" grubunda.
  Her grupta görevler teslim tarihine göre sıralı, tarihsizler sonda.
  Mevcut `FilterBar` (`all`/`active`/`completed`) ve arama aynen çalışır; arama
  görev başlığının yanında müşteri ve proje adında da eşleşir. Göreve tıklayınca
  normal `TaskForm` açılır.
  ```ts
  groupForDelivery(tasks, clients, projects): DeliveryGroup[]
  interface DeliveryGroup {
      client: Client | null;
      projects: { project: Project | null; tasks: Task[] }[];
  }
  ```

## CON-27: `nicheModule` özellik bayrağı
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§4.4); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 6)
- type: api-contract
- content: `nicheModule: isEnabled(import.meta.env.VITE_NICHE_MODULE)` —
  `src/config/features.ts`. Ortam değişkeni `VITE_NICHE_MODULE`, `.env.example`
  ve `src/vite-env.d.ts`'e eklenir. `isEnabled` yalnızca `"true"` metnini kabul
  eder (`Boolean("false")` tuzağı).
  Kapalıyken: `/app/clients` ve `/app/delivery` rotaları **hiç kaydedilmez**,
  TaskForm'daki iki seçici render edilmez, gezinmede bağlantılar görünmez,
  `runSync` müşteri/proje adımlarını atlar.
  `import.meta.env` derleme zamanı sabiti olduğu için kapalı dallar üretim
  paketinden elenir — `/app/__crash` rotasında doğrulanan mekanizmanın aynısı.

## CON-28: i18n kuralları
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§5); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Global Kısıtlar, Görev 6)
- type: nfr
- content: Yeni anahtarlar `client.*`, `project.*`, `delivery.*`; `tr.json` ve
  `en.json`'a **aynı commit'te** eklenir. `tr.json` referans alınır,
  `src/i18n/i18n.test.ts` iki dosyanın aynı şekli ve yer tutucuları taşıdığını
  doğrular. Kullanıcıya metin döndüren saf katmanlar hazır metin değil
  `TranslationKey` döndürür.
  **Tohum verisi yok:** müşteri listesi boş başlar. Kategorilerdeki "tohumlanan
  adlar çevrilir, iki cihaz iki dilde tohumlanırsa çakışır" riski burada hiç
  doğmuyor.

## CON-29: Erişilebilirlik ve kod kalitesi kapıları
- source: docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Global Kısıtlar)
- type: nfr
- content: `confirm()` / `alert()` kullanılmaz; onay diyalogları Radix
  `AlertDialog`. İkon-only butonlar ilgili kaydın adını içeren `aria-label`
  taşır. `tsconfig.app.json` katı ayarları korunur (`strict`, `noUnusedLocals`,
  `noUnusedParameters`). İstemci tipleri dile bağımsızdır.

## CON-30: Test kapsamı zorunlulukları
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§6); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 10 Adım 3)
- type: nfr
- content:
  Birim (Vitest): `sync-merge-clients.test.ts`, `sync-merge-projects.test.ts`,
  `remap-task-links.test.ts` (zincirleme yeniden eşleme, karşılıksız id'lerin
  boşaltılması, `projectId` boşalırken `clientId`'nin korunması),
  `clients.test.ts`, `projects.test.ts`, store: `addClient`/`deleteClient`
  görev bağlarını boşaltıyor mu + sürüm 5 göçü.
  Şema güvenliği (`supabase/tests/rls.test.mjs`): B kullanıcısı A'nın
  müşterisini/projesini okuyamaz-yazamaz; başkasının müşterisine görev/proje
  bağlanamaz; tutarsız çift reddedilir; `project_id` dolu / `client_id` boş satır
  reddedilir; müşteri silmek projelerini siler, görevlerini **silmez**, iki bağı
  boşaltır; `anon` iki tabloda da yetkisiz.
  Uçtan uca (`e2e/nis-modul.spec.ts`): müşteri+proje oluştur ve göreve bağla;
  müşteri değişince proje seçicinin temizlenmesi; teslim görünümü gruplaması;
  silme diyaloğunun doğru sayıları göstermesi; çift cihaz senkronu; yalnızca
  müşteri değiştiğinde senkronun tetiklenmesi.
  Bitiş kapısı: `npm test -- --run`, `npx playwright test`, `npm run test:rls`,
  `npm run lint`, `npx tsc -b --noEmit` — hepsi yeşil.

## CON-31: Bayrak kapalıyken üretim çıktısında iz kalmamalıdır
- source: docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Görev 10 Adım 1-2)
- type: nfr
- content: `VITE_NICHE_MODULE=false npm run build` sonrası
  `grep -rl "ClientManager\|DeliveryView\|app/clients" dist/assets` boş dönmeli.
  İz çıkarsa bayrak koşulu çalışma zamanına kalmış demektir; koşul modül
  gövdesinde / rota kaydı seviyesinde olmalı, render içinde değil.
  Bayrak açıkken de derleme başarılı olmalı ve precache boyutu Sentry parçasını
  içermemeli (mevcut davranış korunur).

## CON-32: Kabul edilen borç — senkron motorundaki varlık başına tekrar
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§3.1, §8.4)
- type: nfr
- content: Motor varlık başına elle yazılmış kod taşır ve bu dilim onu ikiye
  katlar. Tam genelleştirme (varlık tanımını veri olarak yazıp motorun üzerinde
  dönmesi) bilinçli olarak **zaman kaydı dilimine ertelenir**: iki örnekten
  doğru soyutlamayı çıkarmak zor, üçten kolay; ayrıca 265 testin dayandığı
  çalışan bir motoru yeni özellik eklerken yeniden yazmak iki riski üst üste
  bindirirdi.
  NOT: SPEC-PLAN bu kısıtın birleştirme fonksiyonlarına bakan bölümünden
  sapıyor — bkz. CON-35a / CON-35b ve INGEST-CONFLICTS [WARNING].

## CON-33: Bu dilimin kapsam sınırı
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (Kapsam); docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Öz Değerlendirme)
- type: nfr
- content:
  **İçinde:** `clients` + `projects` tabloları, senkron desteği, yönetim ekranı,
  TaskForm'da iki seçici, teslim görünümü, özellik bayrağı.
  **Dışında (bilinçli erteleme):**
  - `time_logs` (zaman kaydı) — ayrı spec'e bırakıldı. Müşteri ve proje mevcut
    kategori desenini birebir izler (düzenlenebilir kayıtlar, son-yazan-kazanır).
    Zaman kaydı farklı bir hayvandır: çalışan sayaç ve biriken, düzenlenmeyen
    kayıtlar. Son-yazan-kazanır orada yanlış sonuç verir — iki cihazdaki iki
    kayıt birbirini ezmemeli, toplanmalı.
  - CSV dışa aktarım — asıl anlamını zaman kayıtları gelince kazanır
    (faturalandırma); şimdi yazılırsa yeniden yazılır.
  - Senkron motorunun genelleştirilmesi — bkz. CON-32.

## CON-34: Bilinen riskler
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§8)
- type: nfr
- content:
  1. Zincirleme id yeniden eşleme — en olası hata kaynağı; saf fonksiyon olarak
     yazılıp doğrudan test edilir.
  2. `pendingCount` eksikliği — kategorilerde bir kez oldu; sessizce başarısız
     olur.
  3. Tetikleyicinin sırası — `before delete`'in referans eylemlerinden önce
     çalıştığı varsayımına dayanır; şema testiyle doğrulanır.
  4. Senkron motorundaki tekrar — bilinçli borç.
  5. Görev formunun büyümesi — TaskForm kategori, öncelik, tarih taşıyor; iki
     alan daha mobilde kalabalıklaşabilir. Gerekirse "ayrıntılar" bölümüne
     katlanır.

---

# COMPETING VARIANTS — birleştirme fonksiyonu yapısı

İki SPEC aynı kapsam için farklı yapı dayatıyor ve **eşit precedence**
taşıyorlar (ikisi de SPEC, override yok, locked değil). Precedence kuralları
kazananı seçemez; iki varyant da olduğu gibi korunur. Kullanıcı seçmeden
yönlendirme yapılmamalıdır. Bkz. `.planning/INGEST-CONFLICTS.md` [WARNING].

## CON-35a: Birleştirme fonksiyonu yapısı — VARYANT A (kopyala)
- source: docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md (§3.1)
- type: protocol
- content: "`clients` ve `projects` için `categories`'in senkron kodu
  **çoğaltılır**: store alanları, saf birleştirme fonksiyonu, repository
  fonksiyonları." Genelleştirme zaman kaydı dilimine ertelenir.
  Sonuç: `mergeClients` ve `mergeProjects`, `mergeCategories`'in tam
  kopyalarıdır; dönüş şekli kategori kalıbıyla aynı kalır.

## CON-35b: Birleştirme fonksiyonu yapısı — VARYANT B (`mergeNamed` çekirdeği)
- source: docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md (Spec'ten Sapma; Görev 4)
- type: protocol
- content: `src/lib/sync-merge.ts` içine tek bir jenerik çekirdek çıkarılır ve
  üç varlık da onu kullanır:
  ```ts
  interface NamedRecord { id: string; name: string; updatedAt: string }
  interface NamedMergeInput<T extends NamedRecord> {
      local: readonly T[]; remote: readonly T[];
      dirtyIds: readonly string[]; tombstones: readonly Tombstone[];
  }
  interface NamedMergePlan<T extends NamedRecord> {
      items: T[]; toPush: T[]; toDelete: string[];
      discardedIds: string[]; obsoleteTombstoneIds: string[];
      idRemap: Record<string, string>;
  }
  mergeClients(input): NamedMergePlan<Client>    // plan alanı adı: items
  mergeProjects(input): NamedMergePlan<Project>
  ```
  `keyOf` "aynı kayıt" farkını taşır: kategori/müşteri için ad, proje için
  `(müşteri, ad)` çifti.
  `mergeCategories` imzası ve dönüş şekli **değişmez** (mevcut testler korunur);
  ince bir sarmalayıcıya dönüşür ve o testler refactor'ı korur.
  Gerekçe: spec'in erteleme sebebi "iki örnekten soyutlama zor, üçten kolay"
  idi; bu dilim tek başına üçüncü örneği getiriyor. Ertelenen büyük
  genelleştirme değil, yalnızca birleştirme fonksiyonunun ortaklaştırılması —
  `runSync`, repository ve store hâlâ varlık başına elle yazılıyor.
  **Bu varyant SPEC-PLAN içinde açıkça "onayınıza sunulan" olarak işaretlidir;
  kabul edilmemişse Görev 4 Adım 3 atlanır ve VARYANT A uygulanır.**
