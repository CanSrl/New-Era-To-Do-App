# Niş modül, 2. dilim: zaman kaydı ve dışa aktarım

**Tarih:** 2026-08-16
**Faz:** ROADMAP Phase 3 — TIME-01…TIME-06
**Önceki dilim:** `2026-08-14-nis-modul-musteri-proje-design.md` (müşteriler ve projeler)

## Amaç

Serbest çalışan, harcadığı süreyi müşteri ve proje bazında ölçebilsin ve
faturalandırma için dışarı çıkarabilsin. Starter kit alıcısı ise aynı modülü
`VITE_NICHE_MODULE=false` ile izsiz çıkarabilsin.

Zaman kaydı **faturalanabilir saat** olarak tasarlanır: kayıtlar saatlik ücretle
ilişkilenir, müşteri/proje bazında tutar hesaplanır ve CSV tutar sütunu taşır.
"Sadece süre ölçümü" seçeneği elendi — CSV'nin varlık sebebi fatura.

## Kapsam

**İçinde:** `time_logs` tablosu, `clients`/`projects` üzerine ücret sütunları,
cihaza özel tek sayaç, `/app/time` yönetim ekranı, görev satırında başlat/durdur,
kabukta aktif sayaç çubuğu, müşteri/proje kırılımında toplamlar, CSV dışa
aktarım, senkron desteği, özellik bayrağı.

**Dışında (bilinçli):**

- **`mergeNamed` çekirdeği (DEC-SYNC-01 borcu).** `.planning/STATE.md` bu borcu
  "Phase 3'te `time_logs` dördüncü varlık olarak gelecek, üçüncü kopya yazılmadan
  önce karar uygulanmalı ya da geri alınmalı" diye bloklayıcı sayıyordu. Bu
  değerlendirme yanlış: `mergeNamed` **adlı, düzenlenebilir, son-yazan-kazanır**
  kayıtlar için tasarlandı (`NamedRecord { id, name, updatedAt }`), `time_logs`'un
  adı yok ve ada göre tekilleştirmeye ihtiyacı yok. Bu dilim üçüncü kopyayı
  yazmıyor, dolayısıyla borcu zorlamıyor. Karar bağımsız bir refactor olarak açık
  kalır; STATE.md'deki bloklayıcı kaydı buna göre düzeltilmeli.
- **Ücret snapshot'ı** (`time_logs.hourly_rate`) — bkz. §1.2 ve §8/2.
- **Para birimi dönüşümü** — `currency` sütunu taşınır, hiçbir kur hesabı
  yapılmaz. Toplamlar müşteri/proje başına alınır, para birimleri arası toplam
  hiç üretilmez.
- **Çoklu eşzamanlı sayaç** — tek sayaç, bkz. §3.1.
- **Sayacın cihazlar arası senkronu** — bkz. §3.1.

## 1. Şema

Yeni migration: `supabase/migrations/20260816120000_niche_time_logs.sql`.

⚠️ Niş modül artık **iki** migration dosyasıdır. Modülü çıkarmak ikisini birden
silmek demektir ve sıra önemlidir (`time_logs` `clients`/`projects`'e bağlı).
`CLAUDE.md` içindeki "niş modül (tek migration dosyası, silinebilir)" ifadesi bu
fazda güncellenir.

### 1.1 `clients` ve `projects` üzerine ücret sütunları

```sql
alter table public.clients
  add column hourly_rate numeric(10,2) not null default 0
    check (hourly_rate >= 0),
  add column currency text not null default 'TRY'
    check (char_length(currency) = 3);

alter table public.projects
  add column hourly_rate numeric(10,2)
    check (hourly_rate is null or hourly_rate >= 0);
```

**Miras kuralı:** projenin `hourly_rate`'i `null` ise müşterininki geçerlidir.
`0` ile `null` farklıdır — `0` "bu proje ücretsiz" demektir ve mirası ezer.
Ayrım `null`/`0` üzerinden taşındığı için istemci tarafında `??` kullanılır,
`||` **kullanılmaz** (`0 || rate` mirası yanlışlıkla geri getirirdi).

`currency` yalnızca müşteride: serbest çalışan aynı müşterinin iki projesini
farklı para biriminde faturalamaz, ama TL ve USD müşterileri bir arada tutar.

`numeric(10,2)`: `double precision` değil, çünkü para. `position` alanları
double kalır, orada kesirli sıra kastediliyor.

### 1.2 `time_logs`

```sql
create table public.time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Görev opsiyonel: "Acme ile 40 dk telefon görüşmesi" için görev açmak
  -- zorunda olmamalı. Görev silinince kayıt DURUR, yalnızca bağı kopar.
  task_id uuid,

  -- Müşteri zorunlu: ücretsiz saat faturalanamaz, faturalanamayan kayıt bu
  -- modülün konusu değil. Proje opsiyonel, tasks'taki ile aynı gerekçe.
  client_id uuid not null,
  project_id uuid,

  started_at timestamptz not null,
  -- Süre dakika cinsinden tam sayı. 1440 tavanı: 24 saatten uzun tek kayıt
  -- neredeyse kesinlikle unutulmuş bir sayaçtır, veri değil.
  duration_minutes integer not null
    check (duration_minutes > 0 and duration_minutes <= 1440),
  note text check (note is null or char_length(note) <= 200),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**`ended_at` saklanmaz, türetilir.** Sayaç durunca süre hesaplanır; elle giriş de
aynı iki alanı doldurur — tek kod yolu, iki alan arasında tutarsızlık ihtimali
yok.

**Tutar saklanmaz, hesaplanır** (`duration_minutes / 60 × etkin ücret`). Bilinçli
bedeli: müşterinin ücretini değiştirmek geçmiş kayıtların tutarını da değiştirir.
"Her kayıtta ücreti dondur" seçeneği elendi — kullanıcı her kayıtta ücreti
görmek/onaylamak zorunda kalırdı. İleride gerekirse `time_logs.hourly_rate`
nullable snapshot sütunu olarak geriye dönük eklenebilir (`null` = "o günkü
kuralı uygula"), yani karar tek yönlü kapanmıyor.

### 1.3 Referans bütünlüğü

Faz 2'nin mimarisi birebir tekrarlanır. Gerekçeler orada yazılı; burada yalnızca
`time_logs`'a özgü olanlar not edilir.

⚠️ **`tasks` üzerinde `(id, user_id)` benzersizliği yok** — `categories`,
`clients` ve `projects` bunu taşıyor ama `tasks` hiç referans hedefi olmamıştı.
Bileşik FK ancak tam olarak referans verdiği sütun listesinin üzerindeki bir
benzersizliğe bağlanabildiği için migration önce onu eklemek zorunda:

```sql
alter table public.tasks add constraint tasks_id_user_id_key unique (id, user_id);
```

Bu, niş modülün **jenerik `tasks` tablosuna dokunan tek değişikliğidir**. Zararsız
(salt ek bir benzersizlik, `id` zaten birincil anahtar) ama modül çıkarılırken
`drop constraint` gerektirir; çıkarma yordamı bunu söylemeli.

**Faz 2'deki `tasks_project_requires_client` check burada YOK.** O kısıt,
bileşik FK'ların MATCH SIMPLE boşluğunu (sütunlardan biri null ise kısıt hiç
değerlendirilmez) kapatmak için gerekliydi çünkü `tasks.client_id`
NULLABLE'dır. `time_logs.client_id` ise `not null` — `project_id` dolu /
`client_id` boş bir satır zaten NOT NULL kısıtına takılır, üçlü FK boşluğuna
hiç ulaşılamaz. İlk yazımda bu check Faz 2 deseninden birebir kopyalanmıştı;
gözden geçirmede ölü kod olduğu (hiçbir girdi onu tetikleyemiyor)
belirlenip kaldırıldı. `client_id` ileride nullable yapılırsa check GERİ
EKLENMELİDİR.

```sql
-- Görev bağı. Sütun listesi ŞART: listesiz `on delete set null` referansın
-- bütün sütunlarını (user_id dahil) boşaltmaya çalışır ve not null ile patlar.
alter table public.time_logs
  add constraint time_logs_task_id_user_id_fkey
  foreign key (task_id, user_id) references public.tasks (id, user_id)
  on delete set null (task_id);

alter table public.time_logs
  add constraint time_logs_client_id_user_id_fkey
  foreign key (client_id, user_id) references public.clients (id, user_id)
  on delete cascade;

alter table public.time_logs
  add constraint time_logs_project_id_client_id_user_id_fkey
  foreign key (project_id, client_id, user_id)
    references public.projects (id, client_id, user_id)
  on delete set null (project_id)
  on update cascade;
```

Üç referans davranışı ve gerekçeleri:

| Silinen | `time_logs`'a etkisi | Neden |
| --- | --- | --- |
| Görev | `task_id` boşalır, kayıt durur | Fatura kaydı, ürettiği görevden uzun yaşamalı |
| Proje | `project_id` boşalır, kayıt durur | `client_id` yerinde kaldığı için NOT NULL bozulmaz |
| Müşteri | **Kayıt silinir** (cascade) | `client_id` zorunlu, boşaltılamaz |

**Müşteri silmek zaman kayıtlarını da siler.** `client_id` `not null` olduğu için
üçüncü bir seçenek yok: ya kayıt gider ya müşteri silinemez. Geçmişi korumanın
yolu zaten **arşivlemek** — bu, arşiv özelliğinin baştan beri gerekçesi.
Silme diyaloğu etkiyi sayıyla söyler (§4.4).

⚠️ `clear_tasks_for_deleted_client` tetikleyicisiyle etkileşim: tetikleyici
`before delete` çalışıp `tasks`'ın iki bağını boşaltır, sonra referans eylemleri
`time_logs`'u cascade ile siler. Tetikleyici `time_logs`'a **dokunmaz** ve
dokunmamalıdır; `tasks` güncellemesi `time_logs.task_id`'yi etkilemez çünkü görev
satırı silinmiyor, yalnızca güncelleniyor.

İndeksler:

```sql
create index time_logs_user_id_started_at_idx on public.time_logs (user_id, started_at desc);
create index time_logs_client_id_idx on public.time_logs (client_id);
create index time_logs_project_id_idx on public.time_logs (project_id) where project_id is not null;
create index time_logs_task_id_idx on public.time_logs (task_id) where task_id is not null;
```

### 1.4 GRANT ve RLS

`categories`/`clients`/`projects` ile birebir aynı: `set_updated_at`
tetikleyicisi, dört politika (`select`/`insert`/`update`/`delete`) hepsi
`(select auth.uid()) = user_id`, `anon` rolüne **hiçbir yetki verilmez**.

```sql
grant select, insert, update, delete on public.time_logs to authenticated;
```

GRANT olmadan RLS politikaları hiç değerlendirilmez — bu depoda bir kez gerçek
bir hataya yol açtı, `supabase/tests/rls.test.mjs` bunu koruyor.

## 2. İstemci tipleri

```ts
export interface TimeLog {
    id: string;
    taskId: string | null;
    clientId: string;
    projectId: string | null;
    startedAt: string;        // ISO damga
    durationMinutes: number;
    note: string | null;
    createdAt: string;
    updatedAt: string;
}

/** Cihaza özel, senkronlanmayan çalışan sayaç. */
export interface ActiveTimer {
    taskId: string | null;
    clientId: string;
    projectId: string | null;
    startedAt: string;        // ISO damga
    note: string | null;
}
```

`Client` ve `Project` tiplerine `hourlyRate: number` / `hourlyRate: number | null`
ve `Client`'a `currency: string` eklenir.

Saf yardımcılar `src/lib/time-logs.ts`:

- `effectiveRate(client, project): number` — miras kuralı (`project?.hourlyRate ?? client.hourlyRate`)
- `amountFor(log, client, project): number` — `durationMinutes / 60 × effectiveRate`
- `elapsedMinutes(timer, now): number` — sayaç süresi
- `formatDuration(minutes): string` — `"2s 15dk"` (i18n anahtarlarıyla)

Hepsi saf; hiçbiri `Date.now()` çağırmaz, `now` parametre olarak geçer — testte
sahte saat kurmak gerekmesin.

## 3. Senkron

### 3.1 Sayaç senkronlanmaz

Çalışan sayaç **cihaza özeldir ve tek**: yeni sayaç başlatmak öncekini durdurup
kaydeder. Sayaç LocalStorage'da yaşar (store'un kalıcı durumunda), buluta hiç
yazılmaz.

Gerekçe: senkronlu sayaç, "iki cihaz çevrimdışıyken ayrı sayaç başlattı"
durumunda hangisinin kazandığına dair yepyeni bir çakışma kuralı gerektirirdi ve
kazanan hangisi olursa olsun kullanıcı gerçekten çalıştığı süreyi kaybederdi.
Yalnızca **durdurulmuş kayıt** buluta gider; o kayıtların çakışması ise
imkânsızdır (§3.3).

Sayaç `startedAt` damgasından türetilir. Ekrandaki `setInterval` bir sayaç
**değil**, yalnızca yeniden render tetikleyicisidir — sekme uykuya dalsa, cihaz
kilitlense de süre doğru kalır. TIME-01'in "sayfa yenilemesinden sağ çıkar"
şartı bununla karşılanır.

### 3.2 Store alanları ve göç

`timeLogs: TimeLog[]`, `activeTimer: ActiveTimer | null`, ve kirli/mezar taşı
sayaçları için mevcut desen. Persist sürümü **v5 → v6**; göç yalnızca iki alanı
boş değerle ekler (`timeLogs: []`, `activeTimer: null`), var olan veriye
dokunmaz.

Eylemler: `startTimer`, `stopTimer`, `discardTimer`, `addTimeLog`,
`updateTimeLog`, `deleteTimeLog`.

`startTimer` çalışan bir sayaç varsa **önce onu durdurup kaydeder** — tek sayaç
kuralı burada uygulanır, arayüzde değil.

### 3.3 Birleştirme: `mergeTasks` kalıbı, `mergeCategories` değil

`time_logs` motorun dördüncü varlığıdır ama **adı yoktur**, dolayısıyla ada göre
tekilleştirme ve `idRemap` zinciri **yoktur**. `mergeTimeLogs`, `mergeTasks`
kalıbını izler: id'ye göre birleşim, `dirtyIds`, mezar taşları, çakışmada
`updatedAt` yenisi kazanır (eşitlikte bulut).

CON-33 "son-yazan-kazanır burada yanlış sonuç verir" diyordu; bu bir **modelleme**
uyarısıdır, yeni bir birleştirme motoru ihtiyacı değil. Zamanı
`(görev, gün) → toplam süre` biçiminde tek değiştirilebilir satır olarak
tutsaydık LWW gerçekten veri yerdi. Her kaydı **kendi UUID'si olan ayrı bir
giriş** olarak tuttuğumuz için iki cihazın kayıtları birleşmede zaten toplanır.
**TIME-04 tasarımla karşılanır, yeni bir kuralla değil.** Bu, spec'in en kritik
tek cümlesidir; modelleme değişirse gereksinim düşer.

### 3.4 Senkron sırası

Bağımlılık zinciri uzuyor: `time_logs` → `tasks` → `projects` → `clients`.

- **Yazma** (bağımsızdan bağımlıya): `clients` → `projects` → `categories` → `tasks` → `timeLogs`
- **Silme** (tam tersi): `timeLogs` → `tasks` → `projects` → `clients` → `categories`
- **Bütün yazmalar bütün silmelerden önce biter** — mevcut kural korunur.

Sıra bozulursa 23503 alınır ve o turdaki bütün senkron düşer.
`src/lib/sync.test.ts` bu düzeni doğrudan sınar; yeni varlık oraya eklenir.

### 3.5 `pendingCount` tuzağı

`SyncProvider`'daki `pendingCount` `timeLogs`'un kirli/silinmiş sayaçlarını da
içermek zorunda. İçermezse yalnızca zaman kaydı değiştiğinde senkron hiç
tetiklenmez ve değişiklik bir sonraki yoklamaya (dakikada bir) kadar bekler.
Bu kategorilerde bir kez gerçekten oldu (CON-34/2). `e2e/senkron.spec.ts`
korumayı taşır.

## 4. Arayüz

### 4.1 Görev satırında başlat/durdur

`TaskItem`'da ikon butonu; `aria-label` görev başlığını içerir (mevcut
konvansiyon). Çalışan görev satırı görsel olarak işaretlenir. Görevin `clientId`
boşsa sayaç başlatılamaz — buton devre dışı ve sebebi `title`/`aria-describedby`
ile söylenir ("müşteri bağı gerekli"), çünkü `time_logs.client_id` zorunlu.

### 4.2 Aktif sayaç çubuğu

Kabukta, gezinmenin üstünde ince bir çubuk: görev adı (ya da "görevsiz kayıt"),
akan süre, durdur butonu. Sayaç çalışırken **her sayfada** görünür.

Gerekçe: "unutulmuş açık sayaç" bu ürün kategorisinin klasik veri hatasıdır ve
tek gerçek savunması görünürlüktür. Çubuk yalnızca sayaç çalışırken render edilir,
yer kaplamaz.

### 4.3 `/app/time` — yönetim ekranı

`nicheRoutes` dizisine eklenir (bayrak kapılı, rota kaydı seviyesinde —
DEC-NICHE-01). İçeriği:

- Kayıt listesi, `startedAt`'e göre azalan
- Elle ekleme: tarih/saat + süre + müşteri + (opsiyonel) proje + (opsiyonel) görev + not
- Satır içi düzeltme ve silme (TIME-02)
- Müşteri → proje kırılımında toplam süre ve tutar (TIME-03)
- Tarih aralığı filtresi
- CSV butonu (§5)

Elle giriş sayaçla **aynı** `addTimeLog` eylemine düşer; iki ayrı kod yolu olmaz.

⚠️ **Gezinme beşinci öğeyi alıyor.** Bugün dört öğe var (Görevler, Teslim,
Müşteriler, Ayarlar); Zaman beşinci olur ve `NAV_SPLIT` mobilde 3/2'ye bölünür —
merkez buton bir öğe genişliği kadar kayar. 360px ekranda beş öğe sığıyor
(öğe başına ~56px). Alternatif, toplamları `/app/delivery` içine koyup rotayı
gezinmeden çıkarmaktı; reddedildi, çünkü teslim görünümü iki iş birden yapmaya
başlardı. Asimetri kabul edilen bedeldir.

### 4.4 Ücret alanları ve silme diyaloğu

`/app/clients` ekranında: müşteri kartında `hourly_rate` + para birimi, proje
satırında opsiyonel override. Override boşken yer tutucu mirası gösterir
("müşteriden: 1.500 ₺"). `InlineName` deseni izlenir — alan her zaman gerçek bir
`input`, kenarlık hover/odakta belirir.

Müşteri silme diyaloğu **veritabanı davranışını birebir söyler** ve artık üçüncü
bir sonucu var:

> "3 projesi silinecek, 5 görevin bağı kopacak (görevler silinmez),
> **41 saat 20 dakikalık 12 zaman kaydı silinecek**."

Bu metin, `sync-merge-niche.ts`'in taklit ettiği kuralların kullanıcıya görünen
yüzüdür; şema, istemci onarımı ve metin birlikte değişmek zorundadır.

### 4.5 Özellik bayrağı

`NICHE_MODULE` kapalıyken:

- `/app/time` rotası kaydedilmez, gezinme öğesi eklenmez
- `TaskItem`'daki sayaç butonu ve kabuktaki çubuk render edilmez
- `runSync` `time_logs`'u **hiç sorgulamaz** — migration'ı silmiş kurulum aksi
  halde her turda "relation does not exist" alır ve görev senkronu da düşer
- `task-mapping.ts` değişmez: bu dilim `tasks` tablosuna sütun eklemiyor

Çeviriler `src/i18n/locales/*.niche.json` dosyalarına girer ve `withNiche` çağrı
yerindeki koşul korunur (argüman olarak referans edilen JSON pakete girer —
Faz 2'de öğrenildi).

## 5. CSV dışa aktarım

`papaparse` bağımlılık olarak eklenir. Üretim **saf bir fonksiyondur**
(`src/lib/time-csv.ts`); indirme ayrı bir çağrı yerindedir. Biçim böylece
doğrudan birim testiyle sınanır, tarayıcı gerekmez.

Biçim: her zaman kaydı bir satır, dosyanın sonunda proje ve müşteri bazında özet
satırları.

```
Tarih;Müşteri;Proje;Görev;Süre (saat);Ücret;Tutar;Para birimi;Not
```

İki somut karar:

- **UTF-8 BOM** ile başlar. Aksi halde Excel'in Türkçe kurulumu dosyayı
  ANSI sanar ve karakterler bozulur.
- **Ayraç `;`** — Excel TR'de liste ayracı noktalı virgüldür; virgül kullanılsa
  her satır tek hücreye sıkışır. Ayraç tek bir sabittir, değiştirmek tek satır.

Süre ondalık saat olarak yazılır (`2,25`) — ondalık ayracı da virgül, çünkü aynı
Excel yerelliği. Filtre `/app/time` ekranındaki müşteri/proje ve tarih aralığı
seçimini birebir izler: ekranda ne görünüyorsa o dışa aktarılır (TIME-05).

Dosya adı: `zaman-<müşteri-slug>-<başlangıç>-<bitiş>.csv`.

## 6. i18n

Yeni anahtarlar `tr.niche.json` / `en.niche.json` altına, `time.*` ön ekiyle.
Süre biçimi (`"2s 15dk"` / `"2h 15m"`) çeviri anahtarıdır, koda gömülmez.
Para ve tarih biçimlemesi `Intl` ile, aktif dile göre.

`src/i18n/i18n.test.ts` iki dosyanın aynı şekli taşıdığını ve yer
tutucu/çoğul eşleşmesini zaten doğruluyor; yeni anahtarlar otomatik kapsanır.

## 7. Test

**Birim (Vitest):**

- `time-logs.test.ts` — `effectiveRate` miras kuralı (özellikle `0` vs `null`),
  `amountFor`, `elapsedMinutes`, `formatDuration`
- `time-grouping.test.ts` — müşteri/proje kırılımında toplamlar, para birimi
  ayrımı, projesiz ve görevsiz kayıtların yeri
- `time-csv.test.ts` — BOM, ayraç, ondalık ayracı, özet satırları, boş sonuç
- `sync-merge-time.test.ts` — iki cihazın kayıtları **toplanır**, mezar taşı,
  dirty, `updatedAt` çakışması
- `sync.test.ts` — genişletilmiş yazma/silme sırası
- store testleri — v5 → v6 göçü, `startTimer` çalışan sayacı durdurup kaydeder,
  `deleteClient` zaman kayıtlarını da siler (veritabanı cascade'iyle aynı sonuç)
- `SyncProvider` — `pendingCount` `timeLogs`'u sayar

**Şema güvenliği (`supabase/tests/rls.test.mjs`):**

- B kullanıcısı A'nın zaman kaydını okuyamaz/yazamaz
- Başkasının müşterisine zaman kaydı yazılamaz
- Tutarsız `(project_id, client_id)` çifti reddedilir
- `project_id` dolu / `client_id` boş satır reddedilir
- `duration_minutes` sınırları (0, negatif, 1441) reddedilir
- Görev silinince kayıt **durur**, `task_id` boşalır
- Proje silinince kayıt **durur**, `project_id` boşalır
- Müşteri silinince kayıt **silinir**

**E2E (Playwright):**

- Sayaç başlat → sayfayı yenile → süre duruyor
- Durdur → kayıt oluştu, süre doğru
- İkinci sayacı başlatmak birinciyi kaydediyor
- Elle kayıt ekle / düzelt / sil
- Müşteri ve proje toplamları doğru
- CSV indiriliyor (`download` olayı) ve başlık satırı doğru

**Bayrak (`scripts/verify-niche-stripping.mjs`):**

`MARKERS` listesine üç iz eklenir: `app/time`, `TimeTracker`, `papaparse`.
`papaparse`'ın kapalı derlemede pakete hiç girmemesi bu fazın en somut
ölçütüdür — kod elenmiş ama bağımlılık kalmış olsaydı bayrak sözünü tutmazdı.
Ölçüm iki yönlüdür: kapalıyken yok, **açıkken var**.

## 8. Riskler

1. **`pendingCount` eksikliği** — sessizce başarısız olur, kategorilerde bir kez
   oldu. Test kapısı §7'de.
2. **Ücret değişimi geçmişi değiştirir** — kabul edilen bedel (§1.2).
   Kullanıcı ücreti yükselttiğinde geçen ayın CSV'si farklı çıkar. Geriye dönük
   `hourly_rate` snapshot sütunu yolu açık bırakıldı.
3. **Müşteri silmek fatura geçmişini siler** — diyalog metni bunu sayıyla
   söylemezse kullanıcı veri kaybeder. Metin ve şema birlikte değişmeli (§4.4).
4. **Unutulmuş sayaç** — 1440 dakika tavanı ve aktif sayaç çubuğu iki savunma
   hattıdır; ikisi de gerekli. Tavan aşılırsa kayıt reddedilir, kullanıcı elle
   düzeltir.
5. **Zaman dilimi.** `started_at` `timestamptz`, gruplama **yerel güne** göre
   yapılır. Kullanıcı zaman dilimi değiştirirse geçmiş kayıtlar başka güne
   kayabilir. Tek kullanıcılı, tek cihazlı kullanımda görünmez; dokümante edilir,
   çözülmez.
6. **Gezinme kalabalığı** — beşinci öğe, mobilde asimetri (§4.3).
7. **Senkron motorundaki tekrar** — CON-32 borcu dördüncü varlıkla büyüyor.
   `time_logs` `mergeTasks` kalıbını izlediği için kopya *`mergeCategories`
   ailesine* eklenmiyor; yine de motor varlık başına elle yazılmış kod taşımaya
   devam ediyor. Bilinçli borç, SYNC-03 olarak v2'de kayıtlı.

## 9. Uygulama sırası

1. Migration + RLS + şema testleri (§1)
2. Tipler ve saf yardımcılar (§2)
3. Store alanları, eylemler, v5 → v6 göçü (§3.2)
4. Senkron: eşleme, `mergeTimeLogs`, repository, sıra, `pendingCount`, bayrak
   kapısı (§3)
5. Arayüz: sayaç butonu, aktif sayaç çubuğu, `/app/time` (§4.1–4.3)
6. Ücret alanları ve silme diyaloğu (§4.4)
7. CSV (§5)
8. Bayrak izleri ve `verify:niche` (§4.5, §7)
9. i18n, E2E, dokümantasyon senkronu (`CLAUDE.md`, `.planning/*`)

Her adım kendi testiyle birlikte kapanır; tek seferde her şey test edilmez.
