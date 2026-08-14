# Yapılacaklar Listesi

## What This Is

Tek kod tabanı, iki amaç. **(1)** Geliştiricilere satılacak, ticari kalitede bir
SaaS starter kit: auth + ödeme + çok kiracılı veri katmanı hazır, dokümante ve
temiz. **(2)** Aynı kod tabanı üzerinde, serbest çalışanlar ve küçük ajanslara
freemium sunulacak gerçek bir ürün: görevi müşteriye/projeye bağlama, teslim
odaklı görünüm ve basit zaman kaydı.

Tarayıcıda çalışan bir SPA/PWA (React 19 + TypeScript + Vite 8, Tailwind v4,
Zustand, react-i18next). Backend Supabase (Postgres + RLS). Mimari
**local-first**: Supabase yapılandırılmamışsa uygulama tam çalışır, giriş
arayüzü hiç görünmez, giriş isteğe bağlıdır.

## Core Value

Aynı kod tabanı hem jenerik bir starter kit hem gerçek bir niş ürün olabilmeli;
ayrımın kanıtı `VITE_NICHE_MODULE=false` ile niş modülün üretim paketinden
**izsiz** çıkmasıdır (rota yok, seçici yok, senkron adımı yok, `dist/` içinde
iz yok).

## Business Context

- **Customer**: (1) kendi SaaS'ını kuracak geliştiriciler, (2) serbest
  çalışanlar ve küçük ajanslar
- **Revenue model**: starter kit lisans satışı (tek seferlik) + niş üründe
  freemium Pro aboneliği
- **Success metric**: ilk ödeme yapan starter kit alıcısı ve ilk Pro abone
- **Strategy notes**: `CLAUDE.md` (yaşayan proje planı — hedef, mimari
  kararlar, sapma günlüğü)

## Requirements

Tam ve kimliklendirilmiş liste: `.planning/REQUIREMENTS.md`.

### Validated

Gönderilmiş ve kullanımda olan yetenekler (bu roadmap'te yeniden planlanmaz):

- ✓ Temizlik ve altyapı: marka/PWA ikon seti, `@/*` alias, Radix
  dialog/alert-dialog, `confirm()` kaldırıldı — Faz 0
- ✓ `profiles` + `categories` + `tasks` şeması, tam RLS + GRANT — Faz 1
- ✓ E-posta/parola auth, `AuthProvider`, parola sıfırlama akışı, hesap menüsü,
  GitHub OAuth (bayrakla kapalı gelir) — Faz 1
- ✓ Kullanıcı tanımlı kategoriler (ad + renk, ayarlar ekranı, senkron) — Faz 1
- ✓ Test altyapısı: Vitest + Playwright + şema güvenlik testleri (265 test) — Faz 1.5
- ✓ Cihazlar arası senkron: saf birleştirme motoru, repository katmanı,
  `SyncProvider` + durum göstergesi — Faz 2
- ✓ CI: kalite ve entegrasyon olmak üzere iki paralel iş, her push ve PR'da
- ✓ React Router v7, `/app` kabuğu, ayarlar sayfası, SPA geri dönüş yapılandırması
- ✓ i18n: `react-i18next`, tr + en, tipli çeviri anahtarları
- ✓ Hata sınırları (kök + rota bazlı) ve opsiyonel hata izleme (Sentry, varsayılan kapalı)

### Active

v1 kapsamı — beş faz, 32 gereksinim. Özet:

- [ ] **Ürün sağlamlaştırma**: erişilebilirlik linti, HTTP güvenlik başlıkları,
      `runSync` sıra testleri, anlık görüntü sayfalama koruması, elenen
      değişiklik bildirimi (HARD-01…06)
- [ ] **Niş modül 1. dilim**: `clients` + `projects`, yönetim ekranı, TaskForm
      seçicileri, teslim görünümü, `VITE_NICHE_MODULE` bayrağı (NICHE-01…08)
- [ ] **Niş modül 2. dilim**: `time_logs` (biriken senkron semantiği), zaman
      kırılımı, CSV dışa aktarım (TIME-01…06)
- [ ] **Ödeme ve Pro kapılama**: sağlayıcı entegrasyonu, `subscriptions`,
      veritabanı seviyesinde kapılama, webhook imza doğrulaması (PAY-01…06)
- [ ] **Paketleme ve yayın**: demo veri, `docs/`, İngilizce README, dağıtım,
      semver + `CHANGELOG.md` (PKG-01…06)

### Out of Scope

- **Stripe** — kullanıcı Türkiye'de, Stripe hesabı açamıyor. Planın ilk hali
  tamamen Stripe'a göre yazılmıştı; o bölüm geçersiz.
- **Takım / çoklu kiracılık (`workspace_id`)** — v1 kapsamı dışı. Göç yolu
  dokümante edilecek, inşa edilmeyecek.
- **Google OAuth** — Google Cloud Console hesabı gerektiriyor, kullanıcının
  hesabı yok. Kod tarafında engel yok: `features.ts`'e ikinci bayrak +
  `AuthProvider`'a ikinci `signInWithOAuth` çağrısı yeterli.
- **react-query** — Zustand birincil kaldı, hiç kullanılmadı, bağımlılıktan
  çıkarıldı.
- **Gerçek zamanlı senkron (Supabase Realtime)** — 60 sn'lik yoklama basitlik
  için bilinçli seçildi; mevcut ölçekte yeterli.
- **Mobil uygulama** — web/PWA öncelikli.
- **Senkron motorunun tam genelleştirilmesi** — varlık tanımını veri olarak
  yazıp motorun üzerinde dönmesi. İki örnekten doğru soyutlama çıkmaz; zaman
  kaydı dilimine ertelendi (CON-32).

## Context

**Depo:** [CanSrl/New-Era-To-Do-App](https://github.com/CanSrl/New-Era-To-Do-App)
(private), varsayılan dal `main`. Kod haritası: `.planning/codebase/`.

**Mevcut durum:** Üç tablo (`profiles`, `categories`, `tasks`), tam RLS, 265
otomatik test (169 birim, 66 uçtan uca, 30 şema güvenlik), CI yeşil. Niş modül
ve ödeme henüz yok.

**Niş konumlandırma:** Todoist gibi devlerle genel alanda değil, "görevi
müşteriye/projeye bağlama + teslim odaklı görünüm + basit zaman kaydı" ile
farklılaşma. Modül eklenti gibi tasarlanır ki jenerik starter kit değerini
bozmasın.

**Devralınan tasarım girdileri:** Niş modülün 1. dilimi için hazır bir teknik
tasarım (`docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md`)
ve 10 görevlik uygulama planı
(`docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md`) var. Bu iki
dokümandan sentezlenen 36 kısıt `.planning/intel/constraints.md` içinde
(CON-01…CON-35b), çakışma raporu `.planning/INGEST-CONFLICTS.md`.

**Bilinen zayıflıklar** (`.planning/codebase/CONCERNS.md`): tam anlık görüntü
senkronu PostgREST'in 1000 satır sınırıyla çarpışıyor; `src/lib/sync.ts`
sıralamasının birim testi yok; `eslint-plugin-jsx-a11y` kurulu değil; HTTP
güvenlik başlıkları yok; çakışmada elenen yerel değişiklik kullanıcıya sessizce
kayboluyor.

**Ders (sapma günlüğünden):** Plan sohbette yaşarsa özetleme sırasında
kaybolur. Faz isimleri kullanılmaya devam edilirken içerikleri yeniden türetildi
ve bu, olmayan bir devamlılık izlenimi yarattı. Plan `CLAUDE.md` ve bu klasörde
yaşar; bir karar değişirse önce burası güncellenir.

## Constraints

- **Tech stack**: React 19 + TypeScript + Vite 8 + Tailwind v4 + Zustand +
  Supabase + Radix + react-i18next + PWA — mevcut kod tabanı bunun üzerine
  kurulu, değiştirmek yeniden yazmak demek.
- **Mimari**: Local-first, Zustand birincil kaynak; senkron üstte bir katman.
  Supabase olmadan uygulama tam çalışır — bu, starter kit'in demo edilebilirliği
  için de gerekli.
- **Veritabanı**: Postgres 15+ zorunlu — `on delete set null (sütun_listesi)`
  sözdizimi 15 ile geldi (CON-12).
- **Güvenlik**: Her yeni tablo GRANT + RLS politikaları + `supabase/tests/rls.test.mjs`
  içinde iddia gerektirir. **GRANT olmadan RLS politikaları hiç
  değerlendirilmez** — bu bir kez gerçek bir hataya yol açtı.
- **Ödeme**: Stripe kullanılamaz (aşağıda kilitli karar). Sağlayıcı seçilmeden
  `subscriptions` şeması netleşmez.
- **i18n**: Yeni kullanıcı metni `tr.json` ve `en.json`'a **aynı commit'te**
  eklenir; `src/i18n/i18n.test.ts` sapmada düşer. Kullanıcıya metin döndüren saf
  katmanlar hazır metin değil `TranslationKey` döndürür.
- **Erişilebilirlik**: `confirm()`/`alert()` yasak, onaylar Radix `AlertDialog`;
  ikon-only butonlar kaydın adını içeren `aria-label` taşır.
- **Derleme ortamı**: Proje OneDrive yolunda; Vite'ın `emptyOutDir`'ı sessizce
  başarısız oluyor, `scripts/clean-dist.mjs` bunu yapar ve hata durumunda
  derlemeyi durdurur.
- **Çalışma biçimi**: Yapısal değişiklikten önce testler yeşil olmalı; elle
  tarayıcıda tıklamak test sayılmaz.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local-first, Zustand birincil (react-query değil) | Kullanıcı local-first'ü seçti; giriş isteğe bağlı kalsın | ✓ Good |
| Kendi senkron motoru + saf birleştirme fonksiyonu | Çakışma senaryoları ağ olmadan birim testiyle kapsanabiliyor | ✓ Good |
| `ownerId` ile cihaz sahipliği | Olmadan her girişte tüm görevler "bekliyor" sayılıyor, silinen görev diriliyordu | ✓ Good |
| Kategorilerde `unique (user_id, name)` YOK | Çevrimdışı iki cihaz aynı adı üretebilir; 23505 o turdaki **bütün** senkronu düşürürdü | ✓ Good |
| `tasks.category_id` bileşik FK `(category_id, user_id)` | FK kontrolü RLS'i atlar; tek sütunlu referans başkasının kategorisine bağlanmaya izin verirdi | ✓ Good |
| İstemci tipleri dile bağımsız (`low\|medium\|high`) | Bir etiket hem tip hem ekran metni olamaz; i18n'in önkoşuluydu | ✓ Good |
| Özellik bayrakları tek dosyada (`src/config/features.ts`) | Alıcı bir özelliği tek satırda kapatabilsin | ✓ Good |
| Hata izleme opsiyonel, ayrı chunk, precache dışı | Kapalıyken kimse ~150 KB indirmesin | ✓ Good |
| Test + CI'ın öne alınması (Faz 4 → Faz 1.5) | Kullanıcı istedi | ✓ Good |
| Stripe yerine iyzico / LemonSqueezy-Paddle | Türkiye'den Stripe hesabı açılamıyor | — Pending (sağlayıcı seçimi Phase 4'te) |
| Niş modül birleştirmede jenerik `mergeNamed` çekirdeği | Üçüncü örnek bu dilimle geliyor; soyutlama artık çıkarılabilir | — Pending |

### Locked Decisions

Bu kararlar kapalıdır. Değiştirmek için açık bir gerekçe ve bu bloğun
güncellenmesi gerekir.

<decisions>
- id: DEC-PAY-01
  title: Stripe kullanılamaz — ödeme sağlayıcısı iyzico veya LemonSqueezy/Paddle olacak
  status: LOCKED
  scope: Phase 4 (Ödeme ve Pro kapılama)
  rationale: >
    Kullanıcı Türkiye'de ve Stripe hesabı açamıyor. Bu bir tercih değil, bir
    engel. Planın ilk hali tamamen Stripe'a göre yazılmıştı; o bölüm geçersiz.
  options:
    - iyzico — yerli, TL, taksit; şahıs/limited şirket gerekir; webhook/callback
      modeli Stripe'tan farklı
    - LemonSqueezy / Paddle — merchant of record, vergiyi onlar halleder,
      Türkiye'den kayıt olunabilir, komisyon daha yüksek, `subscriptions`
      tablosu daha basit kalır
  consequences: >
    Sağlayıcı seçimi Phase 4'ün ilk işidir ve `subscriptions` şemasını belirler.
    Stripe'a özgü hiçbir SDK, webhook biçimi veya Checkout akışı varsayılmaz.

- id: DEC-PAY-02
  title: Pro kapılama veritabanı seviyesinde de olmak zorundadır
  status: LOCKED
  scope: Phase 4 (Ödeme ve Pro kapılama)
  rationale: >
    Yalnızca arayüzde gizlemek doğrudan bir API çağrısıyla aşılır. Uygulama
    local-first ve anon anahtar istemcide; yani istemci hiçbir zaman güvenlik
    sınırı değildir.
  requires:
    - Postgres fonksiyonu + ilgili politikalarda `WITH CHECK`
    - Arayüz kapılaması ayrıca yapılır ama tek başına yeterli sayılmaz
  consequences: >
    Ücretli her özellik için önce veritabanı kapısı yazılır, sonra arayüz.

- id: DEC-PAY-03
  title: Webhook imzası doğrulanmadan hiçbir olaya güvenilmez
  status: LOCKED
  scope: Phase 4 (Ödeme ve Pro kapılama)
  rationale: >
    İmza doğrulaması eksikse herkes sahte "abonelik aktif" olayı gönderip
    ücretsiz Pro alır. Bu, projenin en yüksek etkili güvenlik riski.
  requires:
    - Webhook uç noktası Supabase Edge Function olarak yaşar
    - `SUPABASE_SERVICE_ROLE_KEY` **asla** `VITE_` önekiyle tanımlanmaz;
      yalnızca Edge Function secrets'ta bulunur
  consequences: >
    İmza doğrulaması olmayan bir webhook yolu asla merge edilmez.

- id: DEC-NICHE-01
  title: Niş modül tek bir ortam değişkeniyle tamamen çıkarılabilir olmalıdır
  status: LOCKED
  scope: Phase 2, Phase 3
  rationale: >
    Bu, niş ürünün jenerik starter kit değerini bozmadığının kanıtı ve
    geliştiriciye dönük başarı ölçütü.
  requires:
    - `nicheModule: isEnabled(import.meta.env.VITE_NICHE_MODULE)` — `src/config/features.ts`
    - Kapalıyken `/app/clients` ve `/app/delivery` rotaları **hiç kaydedilmez**,
      TaskForm seçicileri render edilmez, `runSync` müşteri/proje adımlarını atlar
    - Migration tek dosyada durur (`supabase/migrations/20260814120000_niche_module.sql`)
    - Doğrulama: `VITE_NICHE_MODULE=false npm run build` sonrası
      `grep -rl "ClientManager\|DeliveryView\|app/clients" dist/assets` boş dönmeli
  consequences: >
    Bayrak koşulu modül gövdesinde / rota kaydı seviyesinde olur, render içinde
    değil. Aksi halde koşul çalışma zamanına kalır ve iz üretim paketinde kalır.

- id: DEC-SYNC-01
  title: Birleştirme fonksiyonu yapısı — jenerik `mergeNamed` çekirdeği (CON-35b / VARYANT B)
  status: LOCKED
  scope: Phase 2 (Niş modül 1. dilim)
  decided_by: kullanıcı, ingest çakışma kapısında (2026-08-14)
  rationale: >
    SPEC-DESIGN §3.1 "kodu çoğalt" diyordu, erteleme gerekçesi "iki örnekten
    soyutlama çıkmaz, üçten çıkar" idi. Bu dilim üçüncü örneği (kategoriler +
    müşteriler + projeler) tek başına getiriyor.
  requires:
    - `src/lib/sync-merge.ts` içinde tek jenerik çekirdek; `NamedRecord`,
      `NamedMergeInput<T>`, `NamedMergePlan<T>` (plan alanı adı `items`)
    - `keyOf` "aynı kayıt" farkını taşır: kategori/müşteri için ad, proje için
      `(müşteri, ad)` çifti
    - `mergeCategories` imzası ve dönüş şekli **değişmez**; ince bir
      sarmalayıcıya döner ve mevcut testleri refactor'ı korur
    - `runSync` `clientPlan.items` / `projectPlan.items` okur
  consequences: >
    CON-35a (VARYANT A — mergeCategories'i birebir kopyala) bu dilim için
    REDDEDİLDİ; SPEC-DESIGN §3.1 bir sonraki düzenlemesinde güncellenmeli.
    `CLAUDE.md` sapma günlüğüne ikinci satır eklenir (SPEC-PLAN Görev 10 Adım 4).
    Ertelenen asıl borç (runSync, repository ve store'un varlık başına elle
    yazılması) duruyor — bkz. CON-32.

- id: DEC-SCOPE-01
  title: Takım / çoklu kiracılık v1 kapsamı dışıdır
  status: LOCKED
  scope: tüm v1
  rationale: >
    Tek kullanıcılı veri modeli (`user_id` + RLS) çalışıyor ve test edilmiş
    durumda; `workspace_id`'ye geçmek şemayı, RLS'i ve senkron motorunu birden
    değiştirmek demek.
  consequences: >
    Göç yolu Phase 5'te **dokümante edilir**, inşa edilmez.
</decisions>

---
*Last updated: 2026-08-14 after ingest-driven project initialization*
