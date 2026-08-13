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
Radix + dnd-kit + framer-motion + PWA (vite-plugin-pwa).

**Veritabanı** (`supabase/migrations/`): yalnızca iki tablo var.
```
profiles  id(=auth.users.id), email, display_name, created_at, updated_at
          -- auth.users tetikleyicisiyle otomatik oluşur
tasks     id, user_id, title, description, due_date(date), priority, category,
          completed, completed_at, position(float), created_at, updated_at
```
Enum'lar dile bağımsız: `task_priority`(low|medium|high),
`task_category`(work|personal|shopping|school).
RLS tam: `authenticated` rolü yalnızca kendi satırlarını görür/yazar, `anon`'a
hiçbir yetki verilmez. **GRANT olmadan RLS politikaları hiç değerlendirilmez** —
bu bir kez gerçek bir hataya yol açtı, `supabase/tests/rls.test.mjs` bunu korur.

**Test:** 150 otomatik test — 88 birim (Vitest), 44 uçtan uca (Playwright, 6'sı
gerçek iki tarayıcı bağlamıyla çift cihaz senaryosu), 18 şema güvenlik testi.
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

**Arayüz etiketleri hâlâ Türkçe union.** `Priority`/`Category` istemcide
`'Düşük'|'Orta'|'Yüksek'`, veritabanında `low|medium|high`. Dönüşüm
`src/lib/task-mapping.ts`'te. **i18n'e geçildiğinde istemci tarafı yine de
dile bağımsız hale getirilmeli** — bu iş ertelendi, yok olmadı.

**Özellik bayrakları `src/config/features.ts`'te.** Ortam değişkeninden okunan,
derleme zamanı sabitleri. `isEnabled` yalnızca `"true"` metnini kabul eder —
`Boolean("false")` tuzağı testle korunuyor. Starter kit alıcısı bir özelliği
tek satırda kapatabilsin diye bayraklar koda dağıtılmaz.

**GitHub girişi iki taraflı bir anahtardır.** Supabase'de sağlayıcı kapalıyken
`signInWithOAuth` **hata döndürmez**: tarayıcıyı yönlendirir ve kullanıcı
Supabase'in ham JSON hatasına düşer. Yani yanlış yapılandırma istemcide
yakalanamaz — buton bu yüzden `features.githubAuth` bayrağıyla korunur ve
varsayılan kapalıdır.

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

---

## Fazlar

### ✅ Faz 0 — Temizlik ve altyapı
Ölü dosyalar silindi, marka ikonu ve PWA ikon seti üretildi, `index.html`
meta/OG, `@/*` alias, Radix dialog/alert-dialog, `confirm()` kaldırıldı.

### ⚠️ Faz 1 — Supabase + Auth *(kısmen)*
**Yapıldı:** `profiles`+`tasks` şeması, tam RLS, e-posta/parola auth,
`AuthProvider`, giriş/kayıt/parola sıfırlama diyaloğu, hesap menüsü,
**GitHub OAuth** (bayrakla kapalı gelir), `/auth/callback` hata karşılama.
**Yapılmadı:** `categories` tablosu,
`subscriptions`/`clients`/`projects`/`time_logs` tabloları.
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

**Faz 1 artıkları:** `categories` tablosu (sabit enum yerine kullanıcı tanımlı
kategoriler). Google OAuth kapsam dışı (yukarıya bakın).

**Ürün sağlamlaştırma:** i18n (`react-i18next`, tr+en) — önkoşulu istemci
tiplerinin dile bağımsız hale getirilmesi; Sentry + `ErrorBoundary` (env ile
opsiyonel); `eslint-plugin-jsx-a11y`.

**Faz 5 — Niş modül:** `clients`, `projects`, `time_logs` tabloları ve
`src/features/{clients,projects,timeLogs}/`. `src/config/features.ts` bayrağıyla
tamamen kapatılabilir olmalı — starter kit alıcısı tek satırda çıkarabilsin.
TaskForm'a iki opsiyonel alan (müşteri, projeye bağlı seçici). Teslim odaklı
görünüm ayrı route. CSV export (`papaparse`).

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
6. **i18n ertelendi, yok olmadı** — istemci union'ları hâlâ Türkçe.
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
| `categories` tablosu | Var | Yok, sabit enum | Şema plandan değil mevcut koddan türetildi |
| OAuth | Google + GitHub | Yalnızca GitHub | Google, Cloud Console hesabı istiyor; kullanıcının hesabı yok |
| react-query | Veri katmanı olacaktı | Bağımlılıktan kaldırıldı | Zustand birincil kaldı, hiç kullanılmadı |
| İstemci tipleri | Faz 2'de dile bağımsız | Türkçe kaldı, DB sınırında eşleme | Tasarım kararı, plan görülmeden alındı |
| Test + CI | Faz 4 | Faz 1.5 ve hemen sonrası | Kullanıcı istedi; doğru karar çıktı |
| Ödeme | Stripe | Belirsiz (iyzico / LemonSqueezy) | Türkiye'den Stripe açılamıyor |

**Ders:** Plan sohbette yaşarsa özetleme sırasında kaybolur. Faz isimleri
kullanılmaya devam edilirken içerikleri yeniden türetildi ve bu, olmayan bir
devamlılık izlenimi yarattı. Plan artık bu dosyada; bir karar değişirse önce
burası güncellenir.
