# Yapılacaklar Listesi — Ticari SaaS Starter Kit + Niş Freemium Ürün

> Bu dosya her oturumda otomatik yüklenir. Plan sohbet içinde değil burada
> yaşar; sohbet özetlense bile kaybolmaz. **Gerçeği yansıtması şart** — bir
> karar değişirse önce burası güncellenir.

📋 **Tek sayfalık ilerleme dökümü:** `.planning/TODO.md` — baştan sona bütün
işler, yapılanlar tikli. "Nerede kaldık?" sorusunun en hızlı cevabı orası.

## Hedef

1. **Öncelik:** Geliştiricilere satılabilecek, ticari kalitede bir SaaS starter
   kit (auth + ödeme + çok kiracılı veri katmanı hazır, dokümante, temiz).
2. **İkincil, aynı kod tabanı üzerinde:** Belirli bir kitleye freemium sunulacak
   gerçek bir ürün.

**Niş:** Serbest çalışanlar ve küçük ajanslar için müşteri/proje bağlantılı
görev takibi. Todoist gibi devlerle genel alanda değil, "görevi müşteriye/projeye
bağlama + teslim odaklı görünüm + basit zaman kaydı" ile farklılaşma. Eklenti
modülü olarak tasarlanır ki jenerik starter kit değerini bozmasın.

---

## Mevcut durum

Depo: [CanSrl/New-Era-To-Do-App](https://github.com/CanSrl/New-Era-To-Do-App) (private), varsayılan dal `main`.

**Yığın:** React 19 + TypeScript + Vite 8 + Tailwind v4 + Zustand + Supabase +
Radix + dnd-kit + framer-motion + react-i18next + PWA (vite-plugin-pwa).

**Veritabanı** (`supabase/migrations/`): yedi tablo var.
```
profiles    id(=auth.users.id), email, display_name, created_at, updated_at
            -- auth.users tetikleyicisiyle otomatik oluşur
categories  id, user_id, name, color('#rrggbb'), position(float),
            created_at, updated_at
tasks       id, user_id, title, description, due_date(date), priority,
            category_id(null), client_id(null), project_id(null),
            completed, completed_at, position(float), created_at, updated_at
-- faturalama (ayrı migration; kapı dosyası ayrı silinebilir):
subscriptions  user_id PK, provider, provider_subscription_id unique,
               status, variant_id, renews_at, ends_at, trial_ends_at,
               test_mode, created_at, updated_at
               -- authenticated yalnızca SELECT; yazan webhook (service role)
-- niş modül (İKİ migration dosyası, birlikte silinebilir; sıra önemli):
clients     id, user_id, name(<=80), archived, position(float),
            hourly_rate(numeric(10,2), >=0), currency(3 harf, 'TRY'),
            created_at, updated_at
projects    id, user_id, client_id, name(<=80), archived, position(float),
            hourly_rate(numeric(10,2) null = müşteriden miras),
            created_at, updated_at
time_logs   id, user_id, task_id(null), client_id(NOT NULL), project_id(null),
            started_at, duration_minutes(1..1440), note(<=200),
            created_at, updated_at
```
Zaman kaydı migration'ı jenerik `tasks` tablosuna da bir kısıt ekler
(`tasks_id_user_id_key`); niş modülü çıkarma yordamı onu da düşürmeli.
`task_priority`(low|medium|high) dile bağımsız enum olarak kaldı.
RLS tam: `authenticated` rolü yalnızca kendi satırlarını görür/yazar, `anon`'a
hiçbir yetki verilmez. **GRANT olmadan RLS politikaları hiç değerlendirilmez** —
bu bir kez gerçek bir hataya yol açtı, `supabase/tests/rls.test.mjs` bunu korur.

**Test:** 688 otomatik test — 483 birim (Vitest), 119 uçtan uca (Playwright,
14'ü gerçek iki tarayıcı bağlamıyla çift cihaz senaryosu; 1'i GitHub OAuth
bayrağı kapalı olduğu için atlanır), 86 şema güvenlik testi.
CI her push ve PR'da çalışır (`.github/workflows/ci.yml`), iki paralel iş.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (5173) |
| `npm run build` | Üretim derlemesi (öncesinde `dist/` temizlenir) |
| `npm run lint` | ESLint |
| `npm test` | Birim testleri |
| `npm run test:e2e` | Playwright (dev sunucusunu kendi başlatır) |
| `npm run test:rls` | Şema güvenlik testleri (yerel Supabase gerekir) |
| `npm run db:types` | `src/lib/database.types.ts` yeniden üret |

Yerel Supabase: `npx supabase start`. `db reset` sonrası API 502 dönerse ağ
geçidi eski adresi önbelleklemiştir: `docker restart supabase_kong_yapilacaklar-listesi`.

---

## Mimari kararlar

Bunlar bilinçli seçimlerdir; değiştirmeden önce gerekçeyi okuyun.

**Local-first, senkron üstte bir katman.** Cihazdaki Zustand store birincil
kaynaktır. Supabase yapılandırılmamışsa uygulama tam çalışır, giriş arayüzü hiç
görünmez. Giriş isteğe bağlıdır. *(Bu, planın ilk halindeki "react-query veri
katmanı + kademeli düşüş + tek cihaz odaklı" yaklaşımının yerini aldı — bkz.
Sapma günlüğü.)*

**Senkron:** `src/lib/sync-merge.ts` birleştirme kararını **saf fonksiyon**
olarak verir (ağ çağrısı yok), bu yüzden tüm çakışma senaryoları birim testiyle
kapsanır. Değişiklikler `dirtyIds`, silmeler mezar taşı olarak LocalStorage'da
tutulur. Çakışmada `updatedAt` yenisi kazanır; eşitlikte bulut kazanır (tüm
cihazlar aynı sonuca varsın diye). Bulut her turda **tam anlık görüntü** olarak
çekilir — birkaç bin göreve kadar uygun.

**Cihaz sahipliği:** `ownerId` cihazdaki verinin hangi hesaba ait olduğunu tutar.
Bu olmadan her girişte tüm görevler "gönderilmeyi bekliyor" sayılıyor ve başka
cihazda silinen görev diriliyordu. Değiştirmeyin.

**İstemci tipleri dile bağımsız.** `Priority` = `low|medium|high`,
`FilterStatus` = `all|active|completed`, iki tarafta da aynı. Görünen
karşılıkları çeviri dosyalarında (`priority.*`, `filter.*`). Bu, i18n'in
önkoşuluydu: bir etiket hem tipin kendisi hem ekrandaki metin olamaz.
`task-mapping.ts` artık yalnızca alan adı çeviriyor.

**i18n: `react-i18next`, tr + en.** Dil tarayıcıdan algılanır, yedek `tr`;
kullanıcı seçimi LocalStorage'da (`yapilacaklar-language`) saklanır ve
tarayıcı tercihini yener.

- **Çeviri anahtarları tiplidir.** `src/i18n/i18next.d.ts` Türkçe dosyayı
  referans alır, yani `t('yanls.anahtar')` derleme hatası verir. İki dosyanın
  aynı şekli taşıdığını tip sistemi göremez — `src/i18n/i18n.test.ts` bunu ve
  yer tutucu/çoğul eşleşmesini doğrular.
- **Kullanıcıya metin döndüren saf katmanlar anahtar döndürür**, hazır metin
  değil (`TranslationKey`). Auth hataları, senkron hataları, callback
  hataları böyle. Aksi halde dil değişince ekranda duran hata eski dilde
  kalırdı.
- **Modül sırası tuzağı:** store, başlangıç durumunda `seedCategories()`
  çağırıyor ve bu modül gövdesi çalışırken oluyor. `categories.ts` bu yüzden
  i18n'i doğrudan import eder — aksi halde tohumlar ad yerine çeviri anahtarı
  taşırdı.
- **Playwright yereli `tr-TR` olarak sabitlenmiştir.** Chromium varsayılanı
  en-US; sabitlenmezse Türkçe metinle seçim yapan bütün testler kırılır.
- Birim testlerinde dil `src/test-setup.ts` ile `tr`ye sabitlenir (jsdom da
  en-US bildiriyor).

**Tohum kategori adları çevrilir, ama bu bir çakışma riski taşır.** Aynı
hesabın iki cihazı ilk kez farklı dillerde tohumlanırsa ("İş" ve "Work") ada
göre tekilleştirme tutmaz ve kullanıcı iki kategori seti görür. Dar bir
senaryo; bilinçli kabul edildi. LocalStorage göçü çevrilmiş ada değil sabit
`legacyName`'e bakar, çünkü o dönemki bütün veri Türkçeydi.

**Kategorilerde benzersizlik kısıtı bilinçli olarak YOKTUR.** İki cihaz
çevrimdışıyken aynı adla kategori oluşturabilir. `unique (user_id, name)`
olsaydı ikinci cihazın push'u 23505 ile düşer ve **aynı turdaki bütün görev
senkronizasyonunu** da beraberinde götürürdü. Bunun yerine `mergeCategories`
aynı adlı kategorileri buluttakine katlar (`idRemap`) ve `remapTaskCategories`
görevlerin bağını yeniden yazar. Tekrarı yalnızca arayüz engeller.

**`tasks.category_id` bileşik yabancı anahtardır: `(category_id, user_id)`.**
Tek sütunlu referans yetmez — FK kontrolü RLS'i atlar, yani kullanıcı
başkasının kategori id'sini bilirse görevini ona bağlayabilirdi. `on delete
set null (category_id)` (Postgres 15+ sütun listesi) kategori silinince görevi
silmez, yalnızca bağı koparır.

**Senkron sırası serbest değil.** Bağımlılık zinciri `time_logs` → `tasks` →
`projects` → `clients`, ayrıca `tasks` → `categories`. Yazma bağımsızdan
bağımlıya (müşteri → proje → kategori → görev → zaman kaydı), silme tam tersi
(zaman kaydı → görev → proje → müşteri → kategori); ve **bütün yazmalar bütün
silmelerden önce biter**, çünkü
aynı turda hem yeni bir projeye bağlanan hem eski projesi silinen bir görev
olabilir. Sıra bozulursa 23503 alınır ve o turdaki bütün senkron düşer.
`sync.test.ts` bu düzeni doğrudan sınar.

`SyncProvider`'daki `pendingCount` **her** kayıt türünün sayaçlarını içermek
zorunda; içermezse o tür değiştiğinde senkron hiç tetiklenmez ve değişiklik
bir sonraki yoklamaya (dakikada bir) kadar bekler. Bu kategorilerde bir kez
gerçekten oldu. Toplam artık elle yazılmıyor: `store/index.ts`'teki
`PENDING_FIELDS` + `pendingChangeCount` tek kaynak, `index.test.ts` de listeyi
**store'un kendi alanlarıyla** karşılaştırıyor — yani yeni bir kayıt türü
eklenip listeye yazılmazsa test düşer. (E2E bu boşluğu göremiyor: sayfa
yenilendiğinde senkron başka bir tetikleyiciyle zaten çalışıyor, ölçüldü.)

**Niş modül bağ onarımı veritabanını birebir aynalamak zorundadır.**
`sync-merge-niche.ts` içindeki `remapTaskLinks`, üç referans eylemini istemci
tarafında tekrarlar:
- proje başka müşteriye taşınırsa görev **projeyi izler** (`on update cascade`),
- proje silinirse yalnızca `projectId` boşalır (`on delete set null`),
- müşteri silinirse **iki bağ birden** boşalır (`clear_tasks_for_deleted_client`
  tetikleyicisi; yalnızca `clientId` boşaltılsaydı `tasks_project_requires_client`
  check'i patlardı).

İki taraf ayrışırsa görev bağları senkron turunda geri dirilir ya da şemada
imkânsız bir satır gönderilip bütün tur düşer. RLS testlerinin üç maddesi tam
da bu davranışları doğruluyor — istemci kuralları değişirse önce oraya bakın.

Zaman kaydının kendi onarımı var (`remapTimeLogLinks`) ve **bir noktada
görevinkinden ayrılır**: görevde müşteri bağı boşaltılabilir
(`tasks.client_id` nullable), zaman kaydında boşaltılamaz —
`time_logs.client_id` `not null` ve referans `on delete cascade`. Bu yüzden
müşterisi kalmayan **kayıt düşürülür**, bağı boşaltılmaz (`remapProjectClients`
ile aynı gerekçe). Diğer üç kural aynıdır: görev/proje silinince yalnızca o bağ
kopar, proje taşınınca kayıt projeyi izler.

⚠️ İnce nokta: müşterisi silinmiş **ama projesi duran** görev, bağlarını
korur ve projenin müşterisine taşınır. Bu durum şemada imkânsızdır, yani ancak
"proje önce taşındı, sonra eski müşteri silindi" sırasıyla oluşur — o sırada
tetikleyicinin `where client_id = old.id` koşulu artık tutmaz. Bağları körü
körüne boşaltmak, hâlâ duran bir projeye ait görevi sessizce müşterisiz yapardı.

**Müşteri/proje de ada göre tekilleştirilir** (`idRemap`), kategorilerdeki
gerekçeyle: misafirken "Acme" oluşturup zaten "Acme"si olan hesaba giriş
yapmak iki kayıt bırakırdı. Projelerde kapsam **müşteri + ad**'dır — iki farklı
müşterinin "Websitesi" projesi olması normaldir. Sıra önemli: projeler ancak
müşteri `idRemap`'i uygulandıktan **sonra** birleştirilebilir, yoksa
tekilleştirme anahtarı yanlış müşteriyi görür.

**Özellik bayrakları `src/config/features.ts`'te.** Ortam değişkeninden okunan,
derleme zamanı sabitleri. `isEnabled` yalnızca `"true"` metnini kabul eder —
`Boolean("false")` tuzağı testle korunuyor. Starter kit alıcısı bir özelliği
tek satırda kapatabilsin diye bayraklar koda dağıtılmaz.

Varsayılanı **açık** olan bayraklar için ayna fonksiyon var:
`isEnabledByDefault` yalnızca açık `"false"` metnini kapatır. Belirsiz girdide
güvenli taraf ikisinde terstir ve bu bilinçlidir — `isEnabled`'da kapalı bir
sağlayıcıya yönlendirmek kullanıcıyı hata sayfasına düşürür; orada ise
yanlışlıkla kapatmak kullanıcının mevcut verisini arayüzden yok ederdi.

**`features.nicheModule` varsayılan AÇIKTIR** (bu depo aynı zamanda freemium
ürünün kendisi). Kapatmak `VITE_NICHE_MODULE=false`; o zaman niş migration
dosyaları da silinebilir. Bayrak yedi dosyada okunuyor (`sync.ts`,
`task-mapping.ts`, `router.tsx`, `i18n/index.ts`, `AppLayout`, `TaskForm`,
`TaskItem`); veri katmanındaki ilk ikisi olmazsa olmaz:
- `sync.ts` — kapalıyken `clients`/`projects`/`time_logs` **hiç
  sorgulanmaz**. Sorgulansaydı
  migration'ı silmiş kurulum her turda "relation does not exist" alır ve
  GÖREV senkronu da beraberinde düşerdi. Yereldeki müşteri/proje verisi
  silinmez, yalnızca senkronlanmaz — bayrak yeniden açılırsa yerinde bulunur.
- `task-mapping.ts` — kapalıyken `client_id`/`project_id` sütunları
  gönderilmez. Bu sütunlar niş migration'ıyla geliyor; göndermek her görev
  yazmasını "column does not exist" ile düşürür, yani bayrak sözünü tutmazdı.

**Niş modül eleme doğrulaması** (`npm run verify:niche`) iki yönlü çalışır ve
**iki ayrı kanıt** arar: 12 metin izi bayrak kapalıyken bulunmamalı, açıkken
bulunmalı; ayrıca kapalı derleme en az 20 KB küçük olmalı (bugün 57 KB). Boyut
eşiği süs değil — bir iz, kod paketten çıkmadan da kaybolabilir (yalnızca
çeviri dosyası elenmişse), üstelik Faz 2'de bayrak nesne özelliği olduğu için
iki derleme **birebir aynı boyutta** çıkıyordu ve kimse ölçmediği için aylarca
fark edilmedi.

**GitHub girişi iki taraflı bir anahtardır.** Supabase'de sağlayıcı kapalıyken
`signInWithOAuth` **hata döndürmez**: tarayıcıyı yönlendirir ve kullanıcı
Supabase'in ham JSON hatasına düşer. Yani yanlış yapılandırma istemcide
yakalanamaz — buton bu yüzden `features.githubAuth` bayrağıyla korunur ve
varsayılan kapalıdır.

**Hata izleme opsiyonel ve varsayılan kapalı.** `VITE_SENTRY_DSN` yoksa
hiçbir ağ isteği yapılmaz **ve Sentry paketi indirilmez**: `src/lib/monitoring.ts`
Sentry'yi `import()` ile yükler, dolayısıyla Vite onu ayrı bir parçaya böler.
O parça `vite.config.ts` içinde `globIgnores` ile **precache dışında**
tutulur — aksi halde service worker, izleme kapalı olsa bile her kullanıcıya
~150 KB (gzip) indirtirdi. Uygulama kodu Sentry'yi doğrudan import etmez;
sağlayıcı tek dosyada değiştirilebilir.

**İki ayrı hata sınırı var, çünkü tek başına biri yetmiyor.** React Router bir
rotanın render'ında oluşan hatayı kendisi yakalar ve kökteki sınıra hiç
ulaştırmaz; bu yüzden her üst düzey rotada `errorElement` tanımlı. Kökteki
`ErrorBoundary` ise sağlayıcıların (tema, auth, senkron) ve router'ın kendisinin
çökmesi için — orada bir hata olursa kullanıcı bomboş sayfa görürdü. Sınır
sağlayıcıların **dışında** durur.

**`/app/__crash` yalnızca geliştirmede kayıtlıdır.** Hata sınırının çalıştığı
ancak gerçek bir çökmeyle doğrulanabiliyor; bu rota `e2e/hata-siniri.spec.ts`
için tetikleyici. `import.meta.env.DEV` derleme zamanı sabiti olduğu için
üretim paketinde rota tamamen elenir (doğrulandı).

**Erişilebilirlik:** Tüm modaller Radix (`role="dialog"`, odak tuzağı, Escape).
İkon-only butonlarda görev başlığını içeren `aria-label`. `confirm()`/`alert()`
kullanılmaz. Öncelik rozetlerinde renk + metin birlikte.

**Auth yönlendirme adresleri:** Supabase, izin listesinde **tam eşleşme**
bulamadığı yönlendirme adresini sessizce `site_url`'e düşürür — hata vermez,
sadece yanlış yere gider. Yerelde `supabase/config.toml` içindeki
`additional_redirect_urls` bunu kapsar; bulut projesinde aynı adresler
**Authentication → URL Configuration** altında tanımlanmalıdır.

**Derleme:** `dist/` Vite tarafından temizlenmiyor (OneDrive yolunda
`emptyOutDir` sessizce başarısız oluyor). `scripts/clean-dist.mjs` bunu yapar ve
başarısız olursa derlemeyi durdurur — eski bundle'lar service worker tarafından
precache ediliyordu (2602 KiB → 774 KiB).

**⚠️ `.env.local` yerel yığını göstermeli, bulut projesini değil.** E2E paketi
her turda gerçek hesap açıyor. Bulut adresi yazılıysa testler bulut projesine
kayıt olmaya çalışır, onun hız sınırına takılır ("Çok fazla deneme yapıldı")
ve auth'a dayanan 11 test düşer. Hata mesajı bir kod regresyonu gibi görünür;
teşhisi zor çünkü *yerel* Supabase sapasağlam ayaktadır — ayırt etmenin en
hızlı yolu `docker logs supabase_kong_...` içinde tarayıcıdan gelen isteği
aramaktır, hiç yoksa istekler başka bir yere gidiyordur. Ayrıca yerel şema
değişiklikleri tarayıcı testlerinde hiç sınanmamış olur. Bulut değerleri
`.env.cloud.local` içinde saklanır (git tarafından yok sayılır).

**Çift cihaz E2E'sinde girişten sonra ilk senkron turu beklenmelidir.**
Girişin ardından `prepareForSync` cihaz sahipliğini ayarlıyor ve ilk tur bulut
anlık görüntüsünü uyguluyor; arada eklenen kayıt o turun altında kalabiliyor.
Belirti aldatıcı: "Ekle"ye basılıyor, kayıt bir an görünüyor ve kayboluyor —
test "müşteri eklenemedi" diye düşüyor, sanki arayüzde kusur varmış gibi. Yükte
ölçüldü: `zaman-senkron.spec.ts` üç kez üst üste koşturulduğunda 15 testin
6'sı düşüyordu, `signUp`/`signIn` yardımcılarına `waitForSynced` eklenince
15/15 oldu. `waitForSynced` burada yeterli çünkü `lastSyncedAt` girişten
hemen sonra `null`. Aynı desen `senkron.spec.ts`'te de var ama o dosya
bilinçli olarak bazı ara durumları sınadığı için dokunulmadı — orada
kararsızlık görülürse ilk bakılacak yer burasıdır.

**`waitForSynced` "yeni bir tur koştu" demek DEĞİLDİR**, yalnızca "bekleyen
değişiklik yok" der. Sayfa yenilendikten sonra `lastSyncedAt` zaten dolu ve
dirty listeleri boş olduğu için **anında** döner; karşı cihazın değişikliğini
indirecek tur ise henüz koşmamış olabilir. Karşı cihazın verisi bekleniyorsa
`waitForFreshSync` (damganın değişmesini bekler) ve depo okumalarında
`expect.poll` kullanılır.

`supabase/config.toml` içindeki `sign_in_sign_ups` yerelde 200'e çıkarıldı:
varsayılan 30'du ve senkron testleri tek başına 19 kayıt/giriş yapıyor.

---

## Fazlar

### ✅ Faz 0 — Temizlik ve altyapı
Ölü dosyalar silindi, marka ikonu ve PWA ikon seti üretildi, `index.html`
meta/OG, `@/*` alias, Radix dialog/alert-dialog, `confirm()` kaldırıldı.

### ✅ Faz 1 — Supabase + Auth
**Yapıldı:** `profiles`+`categories`+`tasks` şeması, tam RLS, e-posta/parola
auth, `AuthProvider`, giriş/kayıt/parola sıfırlama diyaloğu, hesap menüsü,
**GitHub OAuth** (bayrakla kapalı gelir), `/auth/callback` hata karşılama,
**kullanıcı tanımlı kategoriler** (ad + renk, ayarlar sayfasında yönetim,
cihazlar arası senkron).
**Sonraki fazlara bırakıldı:** `subscriptions` (ödeme); `clients`/`projects`
Faz 5'te geldi, `time_logs` Faz 5 / görev 7'de geldi (şema hazır, senkron ve
arayüz sürüyor).
**Kapsam dışı bırakıldı:** Google OAuth — Google Cloud Console hesabı
gerektiriyor, kullanıcının hesabı yok. Kod tarafında engel yok: `features.ts`'e
ikinci bayrak, `AuthProvider`'a ikinci `signInWithOAuth` çağrısı yeterli.

### ✅ Faz 1.5 — Test altyapısı ve mimari düzeltmeler *(planda yoktu, araya eklendi)*
Vitest + Playwright kuruldu. Ölü `deserialize` kodu düzeltildi (zustand v5'te
böyle bir seçenek yok; tarihler yenilemeden sonra `string` oluyordu). `dueDate`
takvim tarihine, `createdAt` ISO damgaya çevrildi. `Category`'den `'Tümü'`
çıkarıldı, `position` eklendi. TaskForm Radix Dialog'a taşındı.

### ⚠️ Faz 2 — Veri katmanı *(plandan farklı yapıldı)*
Cihazlar arası senkron: eşleme katmanı, veri erişim katmanı, saf birleştirme
motoru, `SyncProvider` + durum göstergesi. Zustand birincil kaldı.
**Plandaki react-query'ye taşıma yapılmadı.**

### ✅ CI *(planda Faz 4'teydi, öne alındı)*
İki iş: kalite (lint/tsc/birim/build) ve entegrasyon (Supabase yığını + RLS +
E2E). Hata durumunda Playwright raporu artefakt olarak yüklenir.

### ✅ Router ve ayarlar sayfası
React Router v7. Rotalar: `/` (pazarlama sayfası), `/app` (kabuk), `/app` index
(görevler), `/app/clients` (niş modül, bayrak kapılı), `/app/settings`,
`/reset-password`, `/auth/callback`, `*` (bulunamadı).

**`/` artık `/app`'e yönlendirmiyor**, pazarlama sayfasını gösteriyor
(`src/components/ui/saas-template.tsx`). ⚠️ Bunun görünmeyen bir yan etkisi
vardı: PWA manifest'inde `start_url` tanımlı değildi, yani varsayılan `/` idi
ve kurulu uygulama görevler yerine tanıtım sayfasını açardı. `vite.config.ts`
içine `start_url: '/app'` eklendi — biri değişirse diğeri de değişmeli.

Landing 21st.dev'deki bir şablondan uyarlandı ve üç şeyi bilinçli olarak
atıyor: bileşene gömülü **global `* { font-family }` seçicisi ve Google Fonts
`@import`'u** (mount olduğu anda bütün uygulamanın yazı tipini değiştiriyor ve
her açılışta dış istek yapıyordu), **dış görseller** (`i.postimg.cc`; PWA
çevrimdışı çalışıyor — parıltı CSS gradyanına, ekran görüntüsü kendi
token'larımızla çizilen bir makete dönüştü) ve **sabit siyah/gri renkler**
(hepsi token; sayfa açık/koyu temada da doğru). `e2e/landing.spec.ts` son iki
maddeyi doğrudan sınıyor: yazı tipi `/` ile `/app` arasında aynı kalmalı ve
sayfa `localhost` dışına **hiç** istek yapmamalı. Yollar İngilizce: uygulama Türkçe olsa da starter kit
uluslararası satılacak ve i18n planlanıyor.

`/app` altında **oturum koruması yoktur** — uygulama local-first, giriş
isteğe bağlı. Koruma ancak hesaba özel sayfalar (faturalama) geldiğinde
gerekecek.

Görev formu ve `n`/`Escape` kısayolları **kabukta** yaşar: yüzen ekleme
butonu ve mobil alt gezinmenin merkez butonu her sayfada görünür, dolayısıyla
form da her sayfada açılabilmeli.

Ayrıca tamamlananlar: parola sıfırlama akışı (eskiden çıkmaz sokaktı — bağlantı
oturumu açıyor ama yeni parola ekranı yoktu), SPA geri dönüş yapılandırması
(`public/_redirects`, `vercel.json`).

### ⏳ Kalan işler

**Ürün sağlamlaştırma:** ✅ bitti — `eslint-plugin-jsx-a11y`
(`flatConfigs.recommended`) `eslint.config.js` içinde kurulu ve CI'da koşuyor.

**Faz 5 — Niş modül** *(bitti)*

| # | İş | Durum |
| --- | --- | --- |
| 1 | `clients` + `projects` şeması, tam RLS, 50/50 şema testi | ✅ |
| 2 | `Client`/`Project` tipleri, saf yardımcılar (`clients.ts`, `projects.ts`) | ✅ |
| 3 | Store alanları + 8 eylem, LocalStorage v4 → v5 göçü | ✅ |
| 4 | Senkron motoru: eşleme, birleştirme, repository, sıra, bayrak kapısı | ✅ |
| 5 | Arayüz: müşteri/proje yönetimi, TaskForm'a iki opsiyonel seçici | ✅ |
| 6 | Teslim odaklı görünüm (`/app/delivery`, müşteri/projeye göre gruplama) | ✅ |
| 7 | Zaman kaydı ve CSV dışa aktarım — **kendi 9 görevlik planı var** (aşağı) | ✅ |

**Görev 7 (zaman kaydı + dışa aktarım)** ayrı bir plan/spec çiftinde yaşıyor ve
o dokümanlarda **"Faz 3"** diye anılıyor (bu dosyadaki faz numaralandırmasıyla
aynı şey değil — orası niş modülün 2. dilimi):
`docs/superpowers/plans/2026-08-16-nis-modul-zaman-kaydi.md` +
`docs/superpowers/specs/2026-08-16-nis-modul-zaman-kaydi-design.md`.
Dal: `faz-3-zaman-kaydi`.

| # | İş | Durum |
| --- | --- | --- |
| 1 | `time_logs` şeması, ücret sütunları, tam RLS (72/72 şema testi) | ✅ |
| 2 | `TimeLog`/`ActiveTimer` tipleri, `time-logs.ts` saf yardımcıları | ✅ |
| 3 | Store: alanlar, tek sayaç kuralı, 6 eylem, v5 → v6 göçü | ✅ |
| 4 | Senkron: `mergeTimeLogs`, eşleme, repository, sıra, `pendingCount` | ✅ |
| 5 | Sayaç arayüzü: görev satırı butonu, aktif sayaç çubuğu | ✅ |
| 6 | `/app/time`: kayıt listesi, elle giriş, toplamlar | ✅ |
| 7 | Ücret alanları arayüzü ve silme diyaloğu | ✅ |
| 8 | CSV dışa aktarım | ✅ |
| 9 | Bayrak izleri, kalan E2E, doküman senkronu | ✅ |

Zaman kaydında yerleşen kurallar:

- **Çalışan sayaç cihaza özeldir ve senkronlanmaz**; yalnızca durdurulmuş kayıt
  buluta gider. Tek sayaç kuralı **store'da** uygulanır (arayüzde değil): yeni
  sayacı başlatmak öncekini durdurup kaydeder.
- **`activeTimer` `partialize`'da olmak zorunda** — "sayaç sayfa yenilemesinden
  sağ çıkar" gereksinimi tamamen buna dayanır.
- **`projects.hourly_rate` null = müşteriden miras, 0 = proje ücretsiz.**
  Çözerken `??` kullanılır; `||` yazmak ücretsiz projeyi sessizce faturalandırır.
- **Şemanın reddedeceği kayıt push kuyruğuna hiç girmemeli.** Store eylemleri
  (`startTimer`, `addTimeLog`, `updateTimeLog`) müşterisiz/geçersiz süreli
  girdiyi reddeder: geçersiz satır push'ta 23514/23502 alır, o turdaki bütün
  senkron onunla düşer ve kayıt dirty kaldığı için **her turda aynı yerde
  tıkanır**. `isValidDuration` şemadaki `1..1440` kısıtının ikizidir.
- **Görev/proje/müşteri silmenin ÜÇ yolu da referans eylemini aynalamak
  zorunda:** `deleteTask`, `deleteProject`, `deleteClient` ve **`clearCompleted`**
  (toplu silme unutulmuştu). Müşteri silinince kayıt gider (cascade, mezar taşı
  bırakılmaz) ve çalışan sayaç atılır; proje/görev silinince kayıt durur,
  yalnızca ilgili bağ boşalır ve kayıt dirty işaretlenmez.
- **Sayaç çubuğu kabukta yaşar, sayfada değil** (`ActiveTimerBar`, `AppLayout`
  içinde). "Unutulmuş açık sayaç" bu ürün kategorisinin klasik veri hatası ve
  tek gerçek savunması görünürlük; çubuk yalnızca başlatıldığı ekranda
  görünseydi kullanıcı başka sayfaya geçip unuturdu. Aynı gerekçeyle görev
  satırındaki **durdur** butonu, düzenle/sil'in aksine hover'a bağlı değil.
- **Ücret alanları müşteri kartının açılan panelinde.** Başlık satırı zaten ad
  ve üç eylem taşıyor; dar ekranda taşardı. Para birimi yalnızca **müşteride**
  vardır — `projects` tablosunda karşılığı yok (`niche-mapping.ts` okurken
  `'TRY'` sabitler), proje yalnızca ücreti ezebilir. Alanlar `InlineName`
  sözleşmesini paylaşır (`InlineRate`, sayı ikizi): taslak yerel, commit
  odak kaybında/Enter'da, Escape iptal, kenarlık hover/odakta.
- **Aralık denetimi `InlineRate`'te değil store'da.** Bileşen yalnızca sayıya
  çevrilemeyen taslağı geri alır; negatif ücreti şemanın ikizi olan store
  reddeder (`isValidRate`) ve çağıran tek bir hata mesajı gösterir. Kural iki
  yere yazılsaydı biri değişince diğeri sessizce ayrışırdı.
- **Para birimi büyük harfe normalize edilir** (`normalizeCurrency`). Şemadaki
  kısıt yalnızca üç karakter ister, ama aynı birim iki farklı yazımla
  saklanırsa `sumByCurrency` genel toplamı ikiye böler; harf olmayan kod ise
  `Intl.NumberFormat`'i patlatırdı.
- **Durdurmak ile atmak ayrı butonlar.** Durdurmak kaydeder, atmak kaydetmez;
  ikisi geri alınamaz biçimde farklı. Tek butonda birleştirmek, yanlışlıkla
  başlatılmış sayacı faturaya yazardı.
- **`useElapsed` saati `useSyncExternalStore` ile okur.** Üslup değil kural:
  `Date.now()` render içinde çağrılamaz (`react-hooks/purity`), efekt
  gövdesinden `setState` çağrılamaz (`react-hooks/set-state-in-effect`) ve
  efektle kurulan state, yenilemeden sonra bir kare `0:00:00` gösterip gerçek
  süreye sıçrardı. ⚠️ Plan dokümanındaki taslak kanca bu üç kuralın ilk
  ikisine takılıyor — kopyalamayın.
- **Tutar saklanmaz, her okumada hesaplanır** (`amountFor`, `groupTotals`).
  Ücret değişince geçmiş kayıtların tutarı da güncel ücretten türesin diye.
- **Kur dönüşümü yok ve olmayacak.** Genel toplam para birimi **başına**
  verilir (`sumByCurrency`); 1000 TL ile 100 USD'yi toplayan tek bir sayı,
  hangi kurdan çevrildiği belirsiz olduğu için faturaya esas alınamaz. Para
  birimi bilinmeyen (müşterisi çözülemeyen) kayıt hiçbir toplama girmez.
- **Filtre `filterLogs` ile tek yerde.** Ekran ve CSV aynı fonksiyonu
  kullanır — dahası CSV, ekranın hesapladığı **aynı `visible` dizisini** alır:
  kullanıcı ekranda ne görüyorsa onu dışa aktarır. Tarih aralığı
  **yerel takvim gününe** göre ve **her iki ucu da kapsar** — damgayı
  `slice(0,10)` ile kesmek UTC gününü verir ve UTC+3'te gece yarısından sonraki
  kayıt bir önceki güne düşerdi.
- **CSV Excel'in Türkçe yerelliğine göre yazılır:** UTF-8 BOM (yoksa dosya ANSI
  sanılır ve başlıklar bozulur), ayraç `;` (TR listelerde ayraç budur; virgül
  kullanılsa her satır tek hücreye sıkışır), ondalık ayraç `,`. Üçü tek bir
  yerellik kararının parçası, ayrı ayrı değiştirilemez. Süre **ondalık saat**
  yazılır (90 dk → `1,5`): "1 sa 30 dk" metni hücrede toplanamaz.
- **`papaparse` denendi ve çıkarıldı.** Yan etkili bir modül olduğu için
  tree-shaking atamıyor: `VITE_NICHE_MODULE=false` derlemesinde bile pakette
  kalıyordu (ölçüldü: `BAD_DELIMITERS`, `RECORD_SEP`) ve **dinamik import da
  kurtarmadı** — parça yine üretiliyordu. Yerine RFC 4180 alıntılaması
  (`escapeCell`) yazıldı; `NEEDS_QUOTES` ayraçtan türer, yani ayraç değişirse
  kaçış da değişir. "Niş modül izsiz çıkar" sözü tek satırlık bir kuraldan
  daha değerli.
- **Dosya adı dile bağlı değil** (`time-logs-<müşteri>-<from>-<to>.csv`).
  Türkçe harfler ASCII'ye indirgenir; ad işletim sistemleri ve indirme
  başlıkları arasında dolaşıyor. Filtre ada yansır, yoksa art arda yapılan
  dışa aktarımlar "(1)", "(2)" ekleriyle birbirine karışırdı.
- **`numeric` PostgREST'ten sayı olarak gelir** (ölçüldü: `{"hourly_rate":1500.00}`).
  Ancak `normalizeClient`/`normalizeProject` sayı olmayan ücreti sessizce
  varsayılana düşürür — bu beklenti bozulursa hata gürültü çıkarmaz, ücret
  verisi sıfırlanır. Görev 7-8'in kapama testi (`zaman-senkron.spec.ts`) tam
  bu yüzden ondalıklı bir ücreti gerçek turdan geçirip diğer cihazda okur ve
  projede **0 ile null'ın ayrı kaldığını** doğrular.
- **Çift cihaz testlerinde depo okuması `expect.poll` ile yapılır.**
  `waitForSynced` yalnızca "yerelde bekleyen yok ve en az bir tur koştu" der;
  sayfa yenilendikten sonra `lastSyncedAt` zaten dolu olduğu için **anında**
  döner, karşı cihazın verisini çeken tur ise hâlâ uçuyor olabilir. Tek
  seferlik `expect(await readTimeLogs(...))` bu yarışı kaybettiğinde test
  gerçek bir senkron hatası varmış gibi düşer — üç test bu yüzden kararsızdı.

Görev 5'te gelen arayüz kararları:

- **Rota bayrağın arkasında, gezinmeden gizlemek yetmez.** `/app/clients`
  `router.tsx` içinde koşullu bir dizidir; `features.nicheModule` kapalıyken
  rota hiç kaydedilmez ve adres "bulunamadı"ya düşer. Bu **çalışma zamanı**
  kapısıdır — `devOnlyRoutes`'un aksine kod pakette kalır, çünkü bayrak
  `import.meta.env.DEV` gibi derleme zamanı sabiti değil bir fonksiyon
  çağrısının sonucudur (`VITE_NICHE_MODULE=false` derlemesi aynı boyutta
  çıkıyor). Yalnızca kenar çubuğundaki bağlantı kaldırılsaydı adresi bilen
  kullanıcı bayrağın kapattığı özelliği yine açabilirdi. Aynı bayrak
  `TaskForm`'daki seçici bloğunu ve `TaskItem`'daki rozeti de kapatır — ikincisi
  şart, çünkü `task-mapping.ts` o durumda `client_id`/`project_id` sütunlarını
  hiç göndermiyor; seçici gösterilseydi kullanıcı hiçbir yere yazılmayan bir bağ
  kurardı.
- **Arşivli kayıt seçicide görünmez — tek istisna görevin mevcut bağı.**
  `TaskForm`'daki `selectable()` bunu yapar. İstisna olmasaydı arşivli müşteriye
  bağlı bir görevi düzenlemeye açmak, `select` eşleşen seçeneği bulamadığı için
  değeri sessizce boşaltır ve kullanıcı yalnızca forma girip çıkarak bağı
  koparmış olurdu.
- **Müşteri değişince proje sıfırlanır.** Şemadaki
  `tasks_project_id_client_id_user_id_fkey` üçlüsü projenin müşterisiyle görevin
  müşterisinin aynı olmasını zorunlu tutuyor; eski proje seçili bırakılsaydı
  gönderim 23503 ile düşer ve o turdaki bütün senkron onunla giderdi.
- **Silme onay metinleri veritabanı davranışını birebir söyler** (müşteri →
  projeler cascade ile gider + görevlerin İKİ bağı boşalır + zaman kayıtları
  `on delete cascade` ile **silinir**, süresiyle birlikte sayılır; proje →
  yalnızca proje bağı, zaman kayıtları durur). Bu metinler `sync-merge-niche.ts`'in taklit ettiği kuralların
  kullanıcıya görünen yüzü; biri değişirse üçü birden değişmeli.
- **Ad alanı her zaman gerçek bir `input`'tur** (`InlineName`), kenarlığı
  yalnızca hover/odakta belirir. "Tıklayınca girdiye dönüşen metin" deseni
  klavye kullanıcısını dışarıda bırakırdı. Kart başlığındaki genişletme de ayrı
  bir `button`; satırın tamamına `onClick` vermek hem içindeki girdiyle iç içe
  geçer hem klavyeyle hiç açılmazdı.
- **Mobil alt gezinme artık `grid-cols-3` değil.** Öğeler ikiye bölünüp
  ortadaki yüzen buton aralarına konur (`NAV_SPLIT`), yoksa üçüncü gezinme
  öğesi merkezi kaydırırdı. Görev 6'nın teslim görünümü eklenince simetrik olur.

Görev 3'te store `deleteClient`, veritabanındaki tetikleyici + cascade ile aynı
sonucu üretecek biçimde yazıldı: bağlı projeler **mezar taşı bırakmadan** silinir
(sunucu zaten cascade ile siliyor), bağlı görevlerin iki bağı da boşalır ve
görevler dirty işaretlenmez.

**Ödeme (Faz 4) — ajan işi bitti; canlı mağaza Görev 0'a bağlı.** Stripe
kullanılamıyor (Türkiye). Kod LemonSqueezy adaptörü + `subscriptions` +
`is_pro` kapısı + `SyncOutcome.blocked` olarak duruyor. `VITE_BILLING`
varsayılan kapalı. Ayrıntı: `docs/billing.md`.

**Sağlayıcı seçildi: LemonSqueezy** (merchant of record — vergi onlarda,
Türkiye'den kayıt olunabiliyor, `subscriptions` şeması basit kalıyor;
karşılığında komisyon iyzico'dan yüksek ve fiyatlandırma USD).
⚠️ LemonSqueezy Temmuz 2024'te **Stripe tarafından satın alındı** ve
teknolojisi Stripe Managed Payments'a katlanıyor. Bugün bağımsız çalışıyor,
yeni kayıt alıyor, kapanış tarihi yok — ama seçimin gerekçesi tam da Stripe
hesabı açamamak olduğu için bu ileride geçersiz kalabilir. Bu yüzden
sağlayıcıya özgü kod **tek bir adaptör dosyasında** toplandı
(`supabase/functions/_shared/billing/`); starter kit alıcısı büyük ihtimalle
Stripe kullanacak.
⚠️ LS'nin satıcı olarak Türkiye'yi desteklediği **doğrulanmadı** (resmî docs
sayfası dışarıdan 403 dönüyor). Mağaza aktivasyonu fazın ilk işi; reddedilirse
sağlayıcı kararı yeniden açılır (iyzico).

**Ücretsiz plan sınırı: 1 müşteri** (arşivli dahil sayılır). Kapı yalnızca
`INSERT`'e uygulanır — `UPDATE`'e de konsaydı kapı devreye girdiğinde zaten
birden fazla müşterisi olan kullanıcıların verisi geriye dönük salt okunur
olurdu.

**Pro kapılama hem arayüzde hem veritabanında** olacak (Postgres fonksiyonu +
`WITH CHECK`), yalnızca UI'da gizlemek doğrudan API çağrısıyla aşılır. Webhook
imza doğrulaması yapılmadan hiçbir olaya güvenilmez.

⚠️ **Fazın en riskli parçası ödeme değil, senkron.** Uygulama local-first
olduğu için ücretsiz kullanıcı çevrimdışıyken sınırın üstünde müşteri
oluşturabilir; giriş yaptığında push'u `42501` ile reddedilir, satır dirty
kalır ve **görevler dahil bütün senkron her turda aynı yerde tıkanır** —
depoda zaten yazılı olan kural. Üstelik `pushRemoteClients` toplu `upsert`
yapıyor, yani PostgREST hangi satırın suçlu olduğunu söylemiyor. Tuzak
sınırın şeklinden bağımsız: `SyncOutcome.blocked` + satır satır izolasyon
uygulandı. Desen Faz 1'deki `SyncOutcome.discarded` ailesinin ikizi.

Plan ve tasarım: `docs/superpowers/plans/2026-09-01-odeme-pro-kapilama.md` +
`docs/superpowers/specs/2026-09-01-odeme-pro-kapilama-design.md`.

**Faz 6 / Phase 5 — Paketleme:** seed, İngilizce `docs/`, README, semver
`0.1.0`, CHANGELOG yazıldı. Canlı Vercel/Netlify adresi ve `curl -I` hâlâ
yayınlayan kişiye bağlı.

---

## Riskler

1. **RLS hataları normal tarayıcı testinde görünmez** — kendi oturumunuzdan
   bakıyorsunuz. İki hesapla doğrulayın. `npm run test:rls` bunu yapar.
2. **Ödeme webhook imza doğrulaması** — eksikse herkes sahte "abonelik aktif"
   olayı gönderip ücretsiz Pro alır.
3. **`SUPABASE_SERVICE_ROLE_KEY` asla `VITE_` önekiyle olmaz** — istemci
   paketine sızar. Yalnızca Edge Function secrets'ta yaşar.
4. **Pro kapılama veritabanı seviyesinde de olmalı**, yalnızca UI'da değil.
5. **Çakışma çözümü kaybeden değişikliği sessizce atar** (son yazan kazanır).
   Görev listesi için makul, ama bilinçli bir karar — dokümante edilmeli.
6. **Üçüncü bir dil eklemek** `SUPPORTED_LANGUAGES` + yeni JSON + date-fns
   yerelliği demek; `i18n.test.ts` eksik anahtarı yakalar. Ancak tohum
   kategori adları o dilde de çevrileceği için yukarıdaki çakışma riski
   büyür.
7. **Takım/çoklu kiracılık v1 kapsamında yok.** `workspace_id` migrasyon yolu
   dokümante edilecek ama inşa edilmeyecek.

## Çalışma biçimi

- Her faz kendi içinde doğrulanır; tek seferde her şey test edilmez.
- **Yapısal değişiklikten önce testlerin yeşil olduğundan emin ol**, sonra
  değiştir, sonra tekrar koştur. 122 test bunun için var.
- Elle tarayıcıda tıklamak "test" değildir; regresyon yakalamaz. Gerçek
  doğrulama otomatik testtir.
- `tsconfig.app.json` katı ayarları (`strict`, `noUnusedLocals` vb.) korunur.
- Gizli değer taraması yapmadan push yapılmaz.

## Sapma günlüğü

Plandan neden ayrıldığımızın kaydı — gelecekte "burada ne olmuş?" sorusunu
önlemek için.

| Konu | Planda | Gerçekte | Sebep |
| --- | --- | --- | --- |
| Veri katmanı | react-query, kademeli düşüş, tek cihaz | Zustand birincil + kendi senkron motoru, çoklu cihaz | Kullanıcı local-first'ü seçti. Ancak seçim yapılırken planın aksini söylediği kendisine iletilmedi |
| Router | Faz 1'de React Router v7 | Yok | Plan metni elde değildi, kapsam koddan türetildi |
| `categories` tablosu | Faz 1'de var | Faz 1'in en sonunda geldi | Şema önce mevcut koddan türetilmişti; enum'dan tabloya geçiş sonradan yapıldı |
| OAuth | Google + GitHub | Yalnızca GitHub | Google, Cloud Console hesabı istiyor; kullanıcının hesabı yok |
| react-query | Veri katmanı olacaktı | Bağımlılıktan kaldırıldı | Zustand birincil kaldı, hiç kullanılmadı |
| İstemci tipleri | Faz 2'de dile bağımsız | Faz 1 sonrası, i18n ile birlikte | Tasarım kararı önce Türkçe union'dan yanaydı; i18n bunu sürdürülemez kıldı |
| Test + CI | Faz 4 | Faz 1.5 ve hemen sonrası | Kullanıcı istedi; doğru karar çıktı |
| Ödeme | Stripe | LemonSqueezy | Türkiye'den Stripe açılamıyor; LS merchant of record ve MoR ürünü Stripe'a katlanıyor, bu yüzden adaptör katmanı zorunlu tutuldu |

**Ders:** Plan sohbette yaşarsa özetleme sırasında kaybolur. Faz isimleri
kullanılmaya devam edilirken içerikleri yeniden türetildi ve bu, olmayan bir
devamlılık izlenimi yarattı. Plan artık bu dosyada; bir karar değişirse önce
burası güncellenir.
