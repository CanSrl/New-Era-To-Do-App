# Niş modül, 1. dilim: müşteriler ve projeler

**Tarih:** 2026-08-14
**Durum:** Onaylandı, uygulanmayı bekliyor
**Faz:** CLAUDE.md → Faz 5 (niş modül), birinci dilim

## Amaç

Serbest çalışanlar ve küçük ajanslar için görevi müşteriye ve projeye
bağlamak. CLAUDE.md'deki farklılaşma vaadinin ilk yarısı: "görevi
müşteriye/projeye bağlama + teslim odaklı görünüm".

## Kapsam

**Bu dilimde var:** `clients` ve `projects` tabloları, senkron desteği,
yönetim ekranı, TaskForm'da iki seçici, teslim görünümü, özellik bayrağı.

**Bu dilimde yok — bilinçli olarak ertelendi:**

- **`time_logs` (zaman kaydı).** Ayrı bir spec'e bırakıldı. Gerekçe: müşteri
  ve proje mevcut kategori desenini birebir izler (düzenlenebilir kayıtlar,
  son-yazan-kazanır çakışma çözümü). Zaman kaydı farklı bir hayvandır —
  çalışan bir sayaç ve biriken, düzenlenmeyen kayıtlar. Son-yazan-kazanır
  orada yanlış sonuç verir: iki cihazda tutulan iki ayrı kayıt birbirini
  ezmemeli, toplanmalı. Bu kendi tasarım kararlarını hak ediyor ve aynı
  anda hem yeni varlık hem yeni senkron semantiği değiştirmek iki riski
  üst üste bindirirdi.
- **CSV dışa aktarım.** Asıl anlamını zaman kayıtları gelince kazanır
  (faturalandırma); şimdi yazılırsa yeniden yazılır.
- **Senkron motorunun genelleştirilmesi.** Aşağıda "Kabul edilen borç".

---

## 1. Şema

Yeni migration: `supabase/migrations/20260814120000_niche_module.sql`.

### 1.1 `clients`

```
id          uuid pk
user_id     uuid not null -> auth.users(id) on delete cascade
name        text not null, boş değil, <= 80 karakter
archived    boolean not null default false
position    double precision not null default 0
created_at  timestamptz not null default now()
updated_at  timestamptz not null default now()  -- set_updated_at tetikleyicisi
```

Ek kısıt: `unique (id, user_id)` — hem `projects` hem `tasks` buraya bileşik
yabancı anahtarla bağlanacak, bu benzersizlik olmadan kurulamaz.

**Renk alanı yok.** Görev satırında zaten kategori renk rozeti var; ikinci
renkli rozet gürültü olur. Teslim görünümü müşterileri başlıkla ayırır.

**`archived` var.** Serbest çalışan iki yılda onlarca müşteri biriktirir.
Silme tek seçenek olsaydı geçmiş görevlerin bağı kopardı; arşiv seçiciden
gizler ama geçmişi korur.

**Benzersizlik kısıtı yok** — `categories` ile aynı gerekçe: iki cihaz
çevrimdışıyken aynı adla müşteri oluşturabilir; `unique (user_id, name)`
olsaydı ikinci cihazın push'u 23505 ile düşer ve o turdaki bütün senkronu
beraberinde götürürdü. Tekilleştirme istemcideki birleştirme motorunda,
tekrar engelleme arayüzde.

### 1.2 `projects`

`clients` ile aynı alanlar, artı:

```
client_id   uuid not null
```

Yabancı anahtar bileşiktir:

```sql
foreign key (client_id, user_id) references public.clients (id, user_id)
  on delete cascade
```

`user_id`'nin referansa katılması `categories`/`tasks` ilişkisindeki
gerekçenin aynısıdır: **FK kontrolü RLS'i atlar.** Tek sütunlu referans
olsaydı kullanıcı başkasının müşteri id'sini bilirse projesini ona
bağlayabilirdi. Veri sızmazdı ama proje yabancı bir müşteriye asılı kalırdı.

Ek kısıt: `unique (id, client_id, user_id)`.

> Bu üçlü benzersizlik `(id, user_id)` değildir. `tasks`, projeye
> `(project_id, client_id, user_id)` üçlüsüyle bağlanacak ve bir yabancı
> anahtar ancak **tam olarak** referans verdiği sütun listesi üzerinde bir
> benzersizlik kısıtı varsa kurulabilir.

`client_id` nullable **değildir**: proje her zaman bir müşteriye aittir.
Müşteri silinince projeleri de gider (`on delete cascade`).

### 1.3 `tasks`'a eklenen sütunlar

```sql
alter table public.tasks add column client_id  uuid;
alter table public.tasks add column project_id uuid;
```

İkisi de nullable: görev müşterisiz olabilir, müşterili ama projesiz de
olabilir ("Acme için telefon görüşmesi"). Üç kısıt birlikte tutarlılığı
sağlar:

**(1) Proje varsa müşteri de olmalı**

```sql
check (project_id is null or client_id is not null)
```

**(2) Müşteri bağı geçerli olmalı**

```sql
foreign key (client_id, user_id) references public.clients (id, user_id)
```

Referans eylemi yok (`no action`) — müşteri silmeyi aşağıdaki tetikleyici
üstlenir.

**(3) Projenin müşterisi görevin müşterisiyle aynı olmalı**

```sql
foreign key (project_id, client_id, user_id)
  references public.projects (id, client_id, user_id)
  on delete set null (project_id)
  on update cascade
```

Bu, tasarımın kilit noktası. `client_id`'yi referansa katmak, "görev A
müşterisine bağlı ama projesi B müşterisinin" durumunu **şemada imkânsız**
kılar. Uygulama katmanında kontrol etmek yeterli olmazdı: doğrudan API
çağrısıyla aşılırdı.

**Neden (1) numaralı `check` şart:** bileşik yabancı anahtarlar varsayılan
`MATCH SIMPLE` ile çalışır ve sütunlardan **herhangi biri** `NULL` ise kısıt
hiç değerlendirilmez. O `check` olmasaydı `project_id` dolu / `client_id`
boş bir satır (3)'ü sessizce atlardı ve müşterisiz bir projeye asılı görev
oluşurdu.

**`on delete set null (project_id)`:** tek bir proje silinince görev
silinmez, yalnızca proje bağı kopar; `client_id` yerinde kalır, dolayısıyla
(1) bozulmaz. Sütun listeli biçim Postgres 15+ ile geliyor — `categories`
migration'ında aynı gerekçeyle kullanıldı.

**`on update cascade`:** kullanıcı bir projeyi başka müşteriye taşırsa
(`projects.client_id` güncellenir) bağlı görevlerin `client_id`'si de
otomatik taşınır. Bu olmasaydı güncelleme FK hatasıyla düşerdi.

### 1.4 Müşteri silme tetikleyicisi

Burada `clients` üzerinde bir `before delete` tetikleyicisi gerekiyor:

```sql
create function public.clear_tasks_for_deleted_client() returns trigger as $$
begin
  update public.tasks
     set client_id = null, project_id = null
   where client_id = old.id;
  return old;
end;
$$ language plpgsql;

create trigger clients_clear_tasks
  before delete on public.clients
  for each row execute function public.clear_tasks_for_deleted_client();
```

**Neden gerekli.** Müşteri silinince iki şeyin aynı anda olması lazım:
projeleri cascade ile gitmeli **ve** görevlerin iki alanı birden boşalmalı.
Bunu yalnızca referans eylemleriyle ifade etmek mümkün değil: (2) numaralı
FK'ya `on delete set null` verilseydi sadece `client_id` boşalır, `project_id`
dolu kalır ve (1) numaralı `check` patlardı. `set null`'un sütun listesi
yalnızca **o kısıtın kendi** referans sütunlarını kabul eder, `project_id`
oraya yazılamaz.

**Tek `where` yetiyor.** Projesi üzerinden bağlı her görevin `client_id`'si
zaten aynı müşteriyi gösterir — (3) numaralı FK bunu garanti ediyor.
Dolayısıyla `where client_id = old.id` her iki bağı da kapsar.

**Sıra garantili.** Satır bazlı `before delete` tetikleyicisi, yabancı
anahtarların referans eylemlerinden (bunlar dahili `after` tetikleyicileridir)
önce çalışır. Görevler temizlendikten sonra cascade projeleri siler ve
ortada onlara işaret eden görev kalmaz.

**`security definer` kullanılmıyor.** Tetikleyici çağıran kullanıcının
yetkisiyle çalışır; güncellediği satırlar zaten o kullanıcının kendi
görevleridir ve `tasks` üzerindeki RLS update politikası buna izin verir.
`security definer` gereksiz bir yetki yükseltmesi olurdu.

### 1.5 GRANT ve RLS

`categories` ile birebir aynı kalıp — `authenticated` rolüne dört yetki,
`anon`'a hiçbir şey, dört politika (`select`/`insert`/`update`/`delete`),
hepsi `(select auth.uid()) = user_id` üzerinden.

> **GRANT olmadan RLS politikaları hiç değerlendirilmez.** Bu bir kez gerçek
> bir hataya yol açtı; `supabase/tests/rls.test.mjs` bunu koruyor.

---

## 2. İstemci tipleri

`src/lib/types.ts`:

```ts
export interface Client {
    id: string;
    name: string;
    archived: boolean;
    position: number;
    createdAt: string;   // ISO 8601
    updatedAt: string;   // ISO 8601 — çakışma bu alana göre çözülür
}

export interface Project extends Client {
    /** Her proje bir müşteriye aittir; şemada da `not null`. */
    clientId: string;
}
```

`Task` iki alan kazanır:

```ts
clientId: string | null;
projectId: string | null;
```

Değişmez: `projectId` doluysa `clientId` de dolu (şemadaki (1) numaralı
`check`'in istemci karşılığı). `normalizeTask` bunu zorlar — `projectId`
dolu ama `clientId` boş gelen ham veride `projectId` düşürülür.

---

## 3. Senkron

### 3.1 Yaklaşım: mevcut deseni kopyala

`clients` ve `projects` için `categories`'in senkron kodu çoğaltılır:
store alanları, saf birleştirme fonksiyonu, repository fonksiyonları.

**Kabul edilen borç.** Motor varlık başına elle yazılmış kod taşıyor ve bu
dilim onu ikiye katlıyor. Genelleştirme (varlık tanımını veri olarak yazıp
motorun üzerinde dönmesi) bilinçli olarak **zaman kaydı dilimine
erteleniyor**: iki örnekten doğru soyutlamayı çıkarmak zor, üç örnekten
kolay. Ayrıca 265 testin dayandığı çalışan bir motoru yeni özellik eklerken
yeniden yazmak iki riski üst üste bindirirdi.

### 3.2 Store alanları

`src/store/index.ts`'e sekiz alan:

```
clients, projects                                  (veri)
dirtyClientIds,  clientTombstones                  (müşteri senkron meta)
dirtyProjectIds, projectTombstones                 (proje senkron meta)
```

`partialize` bunların hepsini kalıcılaştırır. `prepareForSync` üç durumunda
da (aynı hesap / misafir / başka hesap) yeni alanları da işler. `persist`
sürümü **5**'e çıkar; göç yolu yeni alanları boş dizilerle doldurur ve
mevcut görevlere `clientId: null, projectId: null` ekler.

`applySyncResult` imzası sekiz parametre daha alır (`clients`, `projects`,
`syncedClientIds`, `clearedClientTombstoneIds`, `syncedProjectIds`,
`clearedProjectTombstoneIds`).

### 3.3 Senkron sırası

Yabancı anahtarlar sırayı serbest bırakmıyor. `runSync` şu düzene geçer:

**Yazma:** kategoriler → müşteriler → projeler → görevler
**Silme:** görevler → projeler → müşteriler → kategoriler

Proje, müşterisi yazılmadan gönderilirse 23503 alır; görev de projesi
yazılmadan gönderilirse aynısını alır. Silmede ters yön aynı sebeple.

### 3.4 Birleştirme ve id yeniden eşleme

`mergeClients` ve `mergeProjects`, `mergeCategories`'in kopyasıdır: saf
fonksiyon, ağ çağrısı yok, `updatedAt` yenisi kazanır, eşitlikte bulut
kazanır. Aynı adlı müşteriler `idRemap` ile buluttakine katlanır.

Zincirleme yeniden eşleme burada yeni bir iş çıkarıyor. Bir müşteri
tekilleştirilirse yalnızca görevlerin `clientId`'si değil, **projelerin
`clientId`'si de** yeniden yazılmalı — ve projeler tekilleştirilince
görevlerin `projectId`'si. Sıra:

1. `mergeClients` → `clientIdRemap`
2. Yerel projelerin `clientId`'si `clientIdRemap` ile yeniden yazılır
3. `mergeProjects` → `projectIdRemap`
4. `remapTaskLinks(tasks, clientIdRemap, projectIdRemap, geçerliIdKümeleri)`
   — hem iki bağı yeniden yazar hem karşılığı kalmayanları boşaltır, hem de
   `projectId` boşalırken `clientId`'nin tutarlı kalmasını sağlar

`remapTaskCategories` bu dördüncü adımın içine katlanır ya da yanında
çalışır; ikisi de saf fonksiyon olduğu için birim testiyle kapsanır.

### 3.5 `pendingCount` tuzağı

`SyncProvider`'daki `pendingCount`, yeni dört sayacı (`dirtyClientIds`,
`clientTombstones`, `dirtyProjectIds`, `projectTombstones`) **içermek
zorunda**. İçermezse yalnızca müşteri/proje değiştiğinde senkron hiç
tetiklenmez. Bu tam olarak kategorilerde bir kez gerçekten oldu;
`e2e/senkron.spec.ts` o vakayı koruyor, aynısı bu varlıklar için de yazılır.

---

## 4. Arayüz

### 4.1 `/app/clients` — müşteri ve proje yönetimi

`CategoryManager` desenini izler. İki panel: solda müşteri listesi, sağda
seçili müşterinin projeleri. Ekle / yeniden adlandır / arşivle / sil.

Arşivlenmiş kayıtlar varsayılan olarak gizli, "Arşivi göster" ile açılır.

**Silme diyalogları etkiyi sayıyla söyler** (Radix `AlertDialog`,
`confirm()` değil):

> "Acme silinecek. 2 projesi de silinecek ve 5 görevin müşteri bağı
> kopacak. Görevler silinmez."

### 4.2 TaskForm — iki opsiyonel seçici

Müşteri seçici (boş bırakılabilir) ve proje seçici. Proje seçici müşteriye
bağımlıdır: müşteri seçili değilse devre dışı, seçiliyse yalnızca o
müşterinin arşivlenmemiş projelerini listeler.

Müşteri değiştirilince seçili proje temizlenir — aksi halde şemadaki (3)
numaralı FK'yı ihlal eden bir gönderim oluşurdu. Müşteri temizlenince proje
de temizlenir ((1) numaralı `check`).

Arşivlenmiş bir kayda zaten bağlı olan görev açıldığında o kayıt seçicide
görünür (yoksa kullanıcı bağı göremeden kaybederdi).

### 4.3 `/app/delivery` — teslim görünümü

Mevcut `tasks` dizisi üzerinde **salt okunur bir yeniden gruplama**; yeni
sorgu ya da yeni veri yok.

```
Acme
  Websitesi
    [ ] Logo taslağı        15 Ağu
    [ ] Deploy              20 Ağu
  Genel                      (projesiz, müşteriye bağlı görevler)
    [ ] Telefon görüşmesi   16 Ağu
Müşterisiz
    [ ] Fatura kes          14 Ağu
```

Gruplama müşteriye, içinde projeye göre; her grupta görevler teslim
tarihine göre sıralı, tarihsizler sonda. Mevcut `FilterBar`
(`all`/`active`/`completed`) ve arama aynen çalışır; arama görev başlığının
yanında müşteri ve proje adında da eşleşir.

Göreve tıklayınca normal `TaskForm` açılır.

### 4.4 Özellik bayrağı

`src/config/features.ts`:

```ts
nicheModule: isEnabled(import.meta.env.VITE_NICHE_MODULE),
```

Kapalıyken: `/app/clients` ve `/app/delivery` rotaları hiç kaydedilmez,
TaskForm'daki iki seçici render edilmez, gezinmede bağlantılar görünmez,
`runSync` müşteri/proje adımlarını atlar.

`import.meta.env` derleme zamanı sabiti olduğu için kapalı dallar üretim
paketinden elenir — `/app/__crash` rotasında doğrulanan mekanizmanın aynısı.

Migration ayrı bir dosyada durur, böylece starter kit alıcısı modülü
istemezse dosyayı silebilir.

---

## 5. i18n

Yeni anahtarlar `tr.json` ve `en.json`'a birlikte eklenir: `client.*`,
`project.*`, `delivery.*`. `src/i18n/i18n.test.ts` iki dosyanın aynı şekli
taşıdığını ve yer tutucuların eşleştiğini zaten doğruluyor.

Kullanıcıya metin döndüren saf katmanlar hazır metin değil
`TranslationKey` döndürür — mevcut kural.

Tohum verisi **yok**: müşteri listesi boş başlar. Kategorilerdeki
"tohumlanan adlar çevrilir, iki cihaz iki dilde tohumlanırsa çakışır"
riski burada hiç doğmuyor.

---

## 6. Test

**Birim (Vitest):**
- `sync-merge-clients.test.ts` — `mergeCategories` testlerinin karşılığı
- `sync-merge-projects.test.ts` — aynısı, artı `clientId` yeniden eşleme
- `remapTaskLinks` — zincirleme yeniden eşleme, karşılıksız id'lerin
  boşaltılması, `projectId` boşalırken `clientId`'nin korunması
- Store: `addClient`/`deleteClient` görevleri boşaltıyor mu, sürüm 5 göçü

**Şema güvenliği (`supabase/tests/rls.test.mjs`):**
- B kullanıcısı A'nın müşterisini/projesini okuyamaz, yazamaz
- Görevi başkasının müşterisine bağlama denemesi FK ile reddedilir
- Tutarsız çift (görev müşterisi A, projesi B'nin) reddedilir
- `project_id` dolu / `client_id` boş satır `check` ile reddedilir
- Müşteri silmek projelerini siler, görevlerini **silmez**, iki bağı boşaltır
- `anon` rolünün iki tabloda da hiçbir yetkisi yok

**Uçtan uca (Playwright, `e2e/nis-modul.spec.ts`):**
- Müşteri ve proje oluştur, göreve bağla, rozetleri gör
- Müşteri değişince proje seçicinin temizlenmesi
- Teslim görünümünün gruplaması
- Müşteri silme diyaloğunun doğru sayıları göstermesi
- Çift cihaz: bir cihazda oluşturulan müşteri diğerine geçiyor mu
- Yalnızca müşteri değiştiğinde senkron tetikleniyor mu (`pendingCount`)

---

## 7. Uygulama sırası

Her adım kendi içinde yeşil bırakılır.

1. **Şema** — migration, `db:types`, RLS ve bütünlük testleri. Kod henüz
   bu tabloları kullanmaz.
2. **Tipler ve store** — `Client`/`Project`, store alanları, sürüm 5 göçü,
   birim testleri.
3. **Senkron** — repository fonksiyonları, `mergeClients`/`mergeProjects`,
   `remapTaskLinks`, `runSync` sırası, `pendingCount`.
4. **Yönetim ekranı** — `/app/clients`, i18n anahtarları.
5. **TaskForm ve teslim görünümü** — iki seçici, `/app/delivery`, e2e.
6. **Özellik bayrağı** — koşullu rotalar, gizlenen seçiciler, atlanan
   senkron adımları; bayrak kapalıyken derleme çıktısında iz kalmadığının
   doğrulanması.

---

## 8. Riskler

1. **Zincirleme id yeniden eşleme.** Müşteri tekilleştirmesi projelere,
   proje tekilleştirmesi görevlere yayılıyor. En olası hata kaynağı; bu
   yüzden saf fonksiyon olarak yazılıp doğrudan test ediliyor.
2. **`pendingCount` eksikliği.** Kategorilerde bir kez oldu; sessizce
   başarısız olur (senkron hiç tetiklenmez, hata da vermez).
3. **Tetikleyicinin sırası.** `before delete`'in referans eylemlerinden
   önce çalıştığı varsayımına dayanıyor. Doğru, ama varsayım olarak
   kalmasın diye şema testiyle doğrulanıyor.
4. **Senkron motorundaki tekrar.** Bilinçli borç; zaman kaydı dilimine
   kadar taşınacak ve orada üç örnekle birlikte genelleştirilecek.
5. **Görev formunun büyümesi.** TaskForm şimdiden kategori, öncelik, tarih
   taşıyor; iki alan daha eklenince mobilde kalabalıklaşabilir. Gerekirse
   "ayrıntılar" bölümüne katlanır.
