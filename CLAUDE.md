# Yapılacaklar Listesi — Ticari SaaS Starter Kit + Niş Freemium Ürün

> Bu dosya her oturumda otomatik yüklenir. Plan sohbet içinde değil burada
> yaşar; sohbet özetlense bile kaybolmaz. **Gerçeği yansıtması şart** — bir
> karar değişirse önce burası güncellenir.

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

**Veritabanı** (`supabase/migrations/`): beş tablo var.
```
profiles    id(=auth.users.id), email, display_name, created_at, updated_at
            -- auth.users tetikleyicisiyle otomatik oluşur
categories  id, user_id, name, color('#rrggbb'), position(float),
            created_at, updated_at
tasks       id, user_id, title, description, due_date(date), priority,
            category_id(null), client_id(null), project_id(null),
            completed, completed_at, position(float), created_at, updated_at
-- niş modül (tek migration dosyası, silinebilir):
clients     id, user_id, name(<=80), archived, position(float),
            created_at, updated_at
projects    id, user_id, client_id, name(<=80), archived, position(float),
            created_at, updated_at
```
`task_priority`(low|medium|high) dile bağımsız enum olarak kaldı.
RLS tam: `authenticated` rolü yalnızca kendi satırlarını görür/yazar, `anon`'a
hiçbir yetki verilmez. **GRANT olmadan RLS politikaları hiç değerlendirilmez** —
bu bir kez gerçek bir hataya yol açtı, `supabase/tests/rls.test.mjs` bunu korur.

**Test:** 416 otomatik test — 299 birim (Vitest), 67 uçtan uca (Playwright, 9'u
gerçek iki tarayıcı bağlamıyla çift cihaz senaryosu), 50 şema güvenlik testi.
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

**Senkron sırası serbest değil.** Bağımlılık zinciri `tasks` → `projects` →
`clients`, ayrıca `tasks` → `categories`. Yazma bağımsızdan bağımlıya
(müşteri → proje → kategori → görev), silme tam tersi (görev → proje →
müşteri → kategori); ve **bütün yazmalar bütün silmelerden önce biter**, çünkü
aynı turda hem yeni bir projeye bağlanan hem eski projesi silinen bir görev
olabilir. Sıra bozulursa 23503 alınır ve o turdaki bütün senkron düşer.
`sync.test.ts` bu düzeni doğrudan sınar.

`SyncProvider`'daki `pendingCount` **her** kayıt türünün sayaçlarını içermek
zorunda; içermezse o tür değiştiğinde senkron hiç tetiklenmez ve değişiklik
bir sonraki yoklamaya (dakikada bir) kadar bekler. Bu kategorilerde bir kez
gerçekten oldu; `senkron.spec.ts` bunu korur.

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
dosyası da silinebilir. Bayrak iki yerde okunuyor ve ikisi de şart:
- `sync.ts` — kapalıyken `clients`/`projects` **hiç sorgulanmaz**. Sorgulansaydı
  migration'ı silmiş kurulum her turda "relation does not exist" alır ve
  GÖREV senkronu da beraberinde düşerdi. Yereldeki müşteri/proje verisi
  silinmez, yalnızca senkronlanmaz — bayrak yeniden açılırsa yerinde bulunur.
- `task-mapping.ts` — kapalıyken `client_id`/`project_id` sütunları
  gönderilmez. Bu sütunlar niş migration'ıyla geliyor; göndermek her görev
  yazmasını "column does not exist" ile düşürür, yani bayrak sözünü tutmazdı.

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
Faz 5'te geldi, `time_logs` hâlâ bekliyor.
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
React Router v7. Rotalar: `/` (→ `/app`), `/app` (kabuk), `/app` index
(görevler), `/app/settings`, `/reset-password`, `/auth/callback`, `*`
(bulunamadı). Yollar İngilizce: uygulama Türkçe olsa da starter kit
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

**Ürün sağlamlaştırma:** `eslint-plugin-jsx-a11y`.

**Faz 5 — Niş modül** *(sürüyor)*

| # | İş | Durum |
| --- | --- | --- |
| 1 | `clients` + `projects` şeması, tam RLS, 50/50 şema testi | ✅ |
| 2 | `Client`/`Project` tipleri, saf yardımcılar (`clients.ts`, `projects.ts`) | ✅ |
| 3 | Store alanları + 8 eylem, LocalStorage v4 → v5 göçü | ✅ |
| 4 | Senkron motoru: eşleme, birleştirme, repository, sıra, bayrak kapısı | ✅ |
| 5 | Arayüz: müşteri/proje yönetimi, TaskForm'a iki opsiyonel seçici | ⏳ |
| 6 | Teslim odaklı görünüm (ayrı route), CSV export (`papaparse`) | ⏳ |
| 7 | `time_logs` tablosu ve basit zaman kaydı | ⏳ |

Görev 3'te store `deleteClient`, veritabanındaki tetikleyici + cascade ile aynı
sonucu üretecek biçimde yazıldı: bağlı projeler **mezar taşı bırakmadan** silinir
(sunucu zaten cascade ile siliyor), bağlı görevlerin iki bağı da boşalır ve
görevler dirty işaretlenmez.

**Ödeme — en sona bırakıldı.** ⚠️ **Stripe kullanılamıyor: kullanıcı
Türkiye'de, Stripe hesabı açamıyor.** Planın ilk hali tamamen Stripe'a göre
yazılmıştı, o bölüm geçersiz. Adaylar:
- **iyzico** — yerli, TL, taksit; şahıs/limited şirket gerekir; webhook/callback
  modeli Stripe'tan farklı
- **LemonSqueezy / Paddle** — merchant of record, vergiyi onlar halleder,
  Türkiye'den kayıt olunabilir, komisyon daha yüksek; `subscriptions` tablosu
  daha basit kalır
Hangisi seçilirse seçilsin: **Pro kapılama hem arayüzde hem veritabanında**
olmalı (Postgres fonksiyonu + `WITH CHECK`), yalnızca UI'da gizlemek doğrudan
API çağrısıyla aşılır. Webhook imza doğrulaması yapılmadan hiçbir olaya
güvenilmez.

**Faz 6 — Paketleme:** `supabase/seed.sql` demo veri, `docs/` (kurulum,
mimari, özellik bayrakları, gelecek genişletmeler), README'nin İngilizce
yeniden yazımı, ekran görüntüleri (i18n'den sonra), Vercel/Netlify deploy,
`CHANGELOG.md` + semver.

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
| Ödeme | Stripe | Belirsiz (iyzico / LemonSqueezy) | Türkiye'den Stripe açılamıyor |

**Ders:** Plan sohbette yaşarsa özetleme sırasında kaybolur. Faz isimleri
kullanılmaya devam edilirken içerikleri yeniden türetildi ve bu, olmayan bir
devamlılık izlenimi yarattı. Plan artık bu dosyada; bir karar değişirse önce
burası güncellenir.
