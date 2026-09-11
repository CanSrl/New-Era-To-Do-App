# Yapılacaklar listesi — baştan sona

> Projenin tamamının tek sayfalık dökümü. Tik atılmış olan **gönderilmiş ve
> testle korunuyor** demektir; boş kutu henüz yapılmadı.
>
> ⚠️ **İki ayrı faz numaralandırması var, karıştırması kolay.** Bu dosya
> `.planning/ROADMAP.md`'nin numaralandırmasını (Phase 1–5) kullanır.
> `CLAUDE.md` kendi içinde "Faz 0 / 1 / 1.5 / 2 / 5 / 6" der; oradaki
> "Faz 5 — Niş modül", buradaki Phase 2 + Phase 3'ün toplamıdır.
>
> Son güncelleme: 12 Eylül 2026.

---

## Kalan (sen yaparsın)

Ajan işi bitti. Aşağıdakiler hesap / yayın; kod hazır.

- [ ] **LemonSqueezy Görev 0** — mağaza, ürün/varyant, webhook sırrı, API anahtarı.
      Kod (`/app/billing`, Edge Function’lar) duruyor; canlı checkout yok.
      `VITE_BILLING=true` ancak sırlardan sonra. Reddedilirse sağlayıcı
      kararı yeniden açılır (iyzico).
- [ ] **Canlı demo** — Vercel veya Netlify’a dağıt, çalışan URL.
      Adımlar: `docs/deploy.md`. Bulut Supabase URL + anon key (service
      role `VITE_` olmaz). Auth yönlendirme adresleri tam eşleşmeli.
- [ ] **`curl -I` güvenlik başlıkları** — demo URL’sinden sonra.
      Beklenen: CSP `frame-ancestors 'none'`, `nosniff`, `DENY`,
      `strict-origin-when-cross-origin`. Phase 1’den açık iplik.

Bilinçli borç (şimdi yapılmaz): tohum kategorilerin dil çakışması;
`senkron.spec.ts` ilk turu bilinçli beklemiyor; takım/`workspace_id` v1 dışı
(göç yolu `docs/teams.md`); üçüncü dil; Google OAuth.

---

## ✅ Tamamlanan temel (v0) — yeniden planlanmaz

### Temizlik ve altyapı
- [x] Ölü dosyalar silindi
- [x] Marka ikonu ve PWA ikon seti üretildi
- [x] `index.html` meta/OG etiketleri
- [x] `@/*` alias
- [x] Radix dialog + alert-dialog kuruldu
- [x] `confirm()` / `alert()` kod tabanından kaldırıldı

### Supabase + Auth
- [x] `profiles` + `categories` + `tasks` şeması
- [x] Tam RLS (`authenticated` yalnızca kendi satırları, `anon`'a hiçbir yetki)
- [x] E-posta/parola auth + `AuthProvider`
- [x] Giriş / kayıt / parola sıfırlama diyaloğu
- [x] Hesap menüsü
- [x] GitHub OAuth — bayrakla **kapalı** gelir
- [x] `/auth/callback` hata karşılama
- [x] Kullanıcı tanımlı kategoriler (ad + renk, ayarlar sayfası, senkron)
- [ ] ~~Google OAuth~~ — kapsam dışı bırakıldı (Google Cloud Console hesabı
      gerekiyor, yok). Kod tarafında engel yok: `features.ts`'e ikinci bayrak
      + `AuthProvider`'a ikinci `signInWithOAuth` çağrısı yeterli.

### Test altyapısı ve mimari düzeltmeler
- [x] Vitest + Playwright kuruldu
- [x] Ölü `deserialize` kodu düzeltildi (zustand v5'te böyle bir seçenek yok)
- [x] `dueDate` takvim tarihine, `createdAt` ISO damgaya çevrildi
- [x] `Category`'den `'Tümü'` çıkarıldı, `position` eklendi
- [x] TaskForm Radix Dialog'a taşındı

### Veri katmanı — cihazlar arası senkron
- [x] Eşleme katmanı (`task-mapping.ts`)
- [x] Veri erişim katmanı (`task-repository.ts`)
- [x] Saf birleştirme motoru (`sync-merge.ts`) — ağ çağrısı yok, tüm çakışma
      senaryoları birim testiyle kapsanıyor
- [x] `SyncProvider` + durum göstergesi
- [x] `ownerId` cihaz sahipliği
- [ ] ~~react-query'ye taşıma~~ — yapılmadı, Zustand birincil kaldı (bilinçli
      sapma, `CLAUDE.md` → Sapma günlüğü)

### CI
- [x] İki paralel iş: kalite (lint/tsc/birim/build) ve entegrasyon
      (Supabase yığını + RLS + E2E)
- [x] Hata durumunda Playwright raporu artefakt olarak yükleniyor

### Router, pazarlama sayfası, ayarlar
- [x] React Router v7 + rota ağacı
- [x] `/` pazarlama sayfası (21st.dev şablonundan uyarlandı)
- [x] Landing'in global font seçicisi, dış görselleri ve sabit renkleri
      ayıklandı; `e2e/landing.spec.ts` ikisini de sınıyor
- [x] PWA `start_url: '/app'`
- [x] Parola sıfırlama akışı (eskiden çıkmaz sokaktı)
- [x] SPA geri dönüş yapılandırması (`public/_redirects`, `vercel.json`)
- [x] Ayarlar sayfası

### i18n
- [x] `react-i18next`, tr + en
- [x] Tipli çeviri anahtarları (olmayan anahtar = derleme hatası)
- [x] Saf katmanlar `TranslationKey` döndürüyor, hazır metin değil
- [x] Dil seçimi LocalStorage'da, tarayıcı tercihini yeniyor
- [x] Playwright yereli `tr-TR` olarak sabitlendi

### Hata sınırları ve izleme
- [x] İki ayrı hata sınırı (kök + her üst düzey rotada `errorElement`)
- [x] `/app/__crash` yalnızca geliştirmede kayıtlı
- [x] Opsiyonel hata izleme (Sentry dinamik import, precache dışı, varsayılan
      kapalı)

---

## ✅ Phase 1 — Ürün sağlamlaştırma *(6/6)*

- [x] `eslint-plugin-jsx-a11y` kuruldu ve CI'da koşuyor — erişilebilirlik
      ihlali artık konvansiyon değil kapı
- [x] HTTP güvenlik başlıkları yapılandırıldı (`vercel.json` +
      `public/_headers`, `security-headers.test.ts` ikisini eşit tutuyor)
- [ ] ⚠️ **Başlıkların canlıda `curl -I` ile doğrulanması** — yapılandırma
      hazır; kanıt çalışan bir demo URL ister (aşağıda Kalan).
- [x] Çakışmada elenen yerel değişiklik kullanıcıya gösteriliyor
      (`SyncOutcome.discarded` → `SyncProvider` bildirimi)
- [x] Senkron yazma/silme sırası birim testiyle korunuyor (`sync.test.ts`)
- [x] Bin satırın üzerinde veri sayfalanıyor (`fetchAllRows` +
      `SyncTooLargeError`) — sessizce "uzakta silinmiş" sayılmıyor

---

## ✅ Phase 2 — Niş modül: müşteriler ve projeler *(6/6)*

- [x] 1 — `clients` + `projects` şeması, tam RLS, 50/50 şema testi
- [x] 2 — `Client`/`Project` tipleri, saf yardımcılar (`clients.ts`,
      `projects.ts`)
- [x] 3 — Store alanları + 8 eylem, LocalStorage v4 → v5 göçü
- [x] 4 — Senkron motoru: eşleme, birleştirme, repository, sıra, bayrak kapısı
- [x] 5 — Arayüz: müşteri/proje yönetimi, TaskForm'a iki opsiyonel seçici
- [x] 6 — Teslim odaklı görünüm (`/app/delivery`)

---

## ✅ Phase 3 — Niş modül: zaman kaydı ve dışa aktarım *(9/9)*

- [x] 1 — `time_logs` şeması, ücret sütunları, tam RLS (72/72 şema testi)
- [x] 2 — `TimeLog`/`ActiveTimer` tipleri, `time-logs.ts` saf yardımcıları
- [x] 3 — Store: alanlar, tek sayaç kuralı, 6 eylem, v5 → v6 göçü
- [x] 4 — Senkron: `mergeTimeLogs`, eşleme, repository, sıra, `pendingCount`
- [x] 5 — Sayaç arayüzü: görev satırı butonu, kabukta yaşayan aktif sayaç çubuğu
- [x] 6 — `/app/time`: kayıt listesi, elle giriş, müşteri/proje toplamları
- [x] 7 — Ücret ve para birimi alanları, zaman kaydını da sayan silme diyaloğu
- [x] 8 — CSV dışa aktarım (UTF-8 BOM, `;` ayraç, `,` ondalık, RFC 4180)
- [x] 9 — Bayrak izleri, kalan E2E, doküman senkronu
- [x] `npm run verify:niche` iki bağımsız kanıt arıyor: 12 metin izi iki yönlü
      + kapalı derleme en az 20 KB küçük (bugün 57 KB)

**Bu noktada durum (Faz 5 sonrası, ölçülmüş):** 688 otomatik test — 483 birim,
119 E2E (14'ü çift cihaz; 1'i GitHub OAuth kapalı olduğu için atlanır),
86 şema güvenlik testi.

---

## ⏳ Phase 4 — Ödeme ve Pro kapılama *(9/10 ajan; Görev 0 açık)*

Sağlayıcı: **LemonSqueezy**. Ücretsiz sınır: **1 müşteri**.
Plan: `docs/superpowers/plans/2026-09-01-odeme-pro-kapilama.md`
Spec: `docs/superpowers/specs/2026-09-01-odeme-pro-kapilama-design.md`
Dal: `main` (`faz-4-odeme` birleştirildi).

- [x] Sağlayıcı kararı verildi (DEC-PAY-01) ve plan + spec yazıldı
- [ ] **0 — LemonSqueezy hesabı** *(Ahmet yapar, ajan yapamaz)*: mağaza
      aktivasyonu Türkiye adresiyle, abonelik ürünü + varyantı, webhook
      imzalama sırrı, API anahtarı.
      ⚠️ Canlı checkout/portal bu görev olmadan doğrulanamaz.
- [x] 1 — `subscriptions` şeması, `is_pro`, `client_count`, RLS + şema testleri
- [x] 2 — Müşteri kapısı: `clients` INSERT politikasına `WITH CHECK`
      *(yalnızca INSERT, UPDATE'e dokunulmaz)*
- [x] 3 — **Senkron kalıcı reddi atlatır** (`SyncOutcome.blocked`, satır satır
      izolasyon)
- [x] 4 — İstemci tarafı plan katmanı ve ikiz kapı (`src/lib/billing.ts`,
      `canAddClient`)
- [x] 5 — Webhook Edge Function: imza doğrulama, idempotency, sağlayıcı adaptörü
- [x] 6 — Checkout ve portal Edge Function'ları *(canlı LS turu Görev 0'a bağlı)*
- [x] 7 — `/app/billing` sayfası + `RequireAuth` *(yalnızca bu rotayı sarar)*
- [x] 8 — E2E + sır taraması testi
- [x] 9 — Doküman senkronu ve kapanış

**Kriterler:** abone olunabiliyor · sahte webhook reddediliyor · doğrudan API
çağrısı sınırı aşamıyor · sınıra çarpan kullanıcı nedeni ve çıkışı görüyor ·
plan durumu görünüyor ve iptal edilebiliyor · oturumsuz ziyaretçi faturalamaya
giremiyor ama uygulamanın geri kalanı girişsiz çalışıyor.

---

## ⏳ Phase 5 — Paketleme ve yayın *(ajan bitti; canlı yayın sende)*

- [x] `supabase/seed.sql` — demo veri (`demo@example.com` / `demodemo1`)
- [x] `docs/` — kurulum, mimari, özellik bayrakları, dağıtım, **niş modülü
      çıkarma yordamı**, takıma geçiş yolu
- [x] README'nin İngilizce yeniden yazımı + ekran görüntüleri
- [x] Dağıtım adımları yazılı (`docs/deploy.md`) — canlı URL ve `curl -I` sende
- [x] `CHANGELOG.md` + semver `0.1.0`
- [ ] ⚠️ Phase 1'in açık ipliği: güvenlik başlıklarının canlıda `curl -I`
      ile doğrulanması *(demo adresi yok)*

---

## Açık iplikler ve bilinçli borçlar

Bunlar "yapılacak" değil, "biliniyor ve kabul edildi" listesi.

- [ ] Güvenlik başlıklarının canlı doğrulaması — demo URL bekliyor
- [x] ~~Çakışma çözümü kaybeden değişikliği sessizce atıyor~~ — artık atmıyor,
      Phase 1'de kullanıcıya gösterilir hale geldi
- [ ] Tohum kategori adları çevrildiği için, aynı hesabın iki cihazı ilk kez
      farklı dillerde tohumlanırsa iki kategori seti oluşur. Dar senaryo,
      bilinçli kabul edildi.
- [ ] `senkron.spec.ts`, `signUp`/`signIn` sonrası ilk senkron turunu
      beklemiyor (bazı testleri ara durumları bilinçli sınadığı için
      dokunulmadı). Orada kararsızlık görülürse ilk bakılacak yer burasıdır.
- [x] Takım / çoklu kiracılık v1 kapsamında yok. `workspace_id` göç yolu
      yazıldı (`docs/teams.md`), inşa edilmedi.
- [ ] Üçüncü dil eklemek `SUPPORTED_LANGUAGES` + yeni JSON + date-fns yerelliği
      demek; tohum kategori çakışma riskini büyütür.
