# Requirements: Yapılacaklar Listesi

**Defined:** 2026-08-14
**Core Value:** Aynı kod tabanı hem jenerik bir starter kit hem gerçek bir niş
ürün olabilmeli; ayrımın kanıtı `VITE_NICHE_MODULE=false` ile niş modülün
üretim paketinden izsiz çıkmasıdır.

> **Kapsam notu:** Bu dosya **kalan** işi tanımlar. Faz 0, 1, 1.5, 2, CI ve
> router/ayarlar işleri gönderilmiş durumda; onlar aşağıdaki "Shipped (v0)"
> bölümünde kayıtlıdır ve kapsama sayımına dâhil değildir. Ayrıntı:
> `.planning/PROJECT.md` → Requirements → Validated.

## Shipped (v0)

Gönderilmiş yetenekler — faz eşlemesi yok, yeniden planlanmaz.

- ✓ Temizlik, marka/PWA ikon seti, `@/*` alias, Radix dialog/alert-dialog — Faz 0
- ✓ `profiles` + `categories` + `tasks` şeması, tam RLS + GRANT — Faz 1
- ✓ E-posta/parola auth, parola sıfırlama, hesap menüsü, GitHub OAuth (bayrakla kapalı) — Faz 1
- ✓ Kullanıcı tanımlı kategoriler (ad + renk, yönetim ekranı, senkron) — Faz 1
- ✓ Vitest + Playwright + şema güvenlik testleri (265 test) — Faz 1.5
- ✓ Cihazlar arası senkron: birleştirme motoru, repository, `SyncProvider` — Faz 2
- ✓ CI (kalite + entegrasyon), React Router v7, ayarlar sayfası, i18n (tr/en),
  hata sınırları, opsiyonel Sentry

## v1 Requirements

Kalan sürüm kapsamı. Her gereksinim tam olarak bir faza eşlenir.

### Hardening (Ürün sağlamlaştırma)

- [x] **HARD-01**: `eslint-plugin-jsx-a11y` kurulu ve CI'da çalışıyor; erişilebilirlik ihlali derlemeyi düşürür
- [x] **HARD-02**: Üretim dağıtımı CSP, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` ve `Referrer-Policy` başlıklarıyla servis edilir
- [x] **HARD-03**: `runSync` yazma/silme sırası ve `inFlight` kilidi doğrudan birim testiyle korunur (`src/lib/sync.test.ts`)
- [x] **HARD-04**: Bulut anlık görüntüsü PostgREST'in 1000 satır sınırında sessizce kırpılmaz — açık sayfalama ya da kırpılmada hata
- [x] **HARD-05**: Senkronda elenen yerel değişiklik kullanıcıya görünür bir bildirimle söylenir (`plan.discardedIds`)
- [x] **HARD-06**: Yerelde oluşturulan/geri yüklenen kategori rengi `#rrggbb` doğrulamasından geçer — istemci değişmezi veritabanı kısıtıyla aynı

### Niche Module — Slice 1 (Müşteriler ve projeler)

- [x] **NICHE-01**: Kullanıcı `/app/clients` ekranında müşteri oluşturabilir, yeniden adlandırabilir, arşivleyebilir ve silebilir
- [x] **NICHE-02**: Kullanıcı bir müşteriye bağlı proje oluşturabilir, yeniden adlandırabilir, arşivleyebilir ve silebilir
- [x] **NICHE-03**: Kullanıcı bir görevi opsiyonel olarak bir müşteriye ve o müşterinin bir projesine bağlayabilir; müşteri değişince proje seçimi temizlenir
- [x] **NICHE-04**: `/app/delivery` teslim görünümü görevleri müşteri ve proje kırılımında gruplar, her grupta teslim tarihine göre sıralar; mevcut filtre ve arama çalışmaya devam eder
- [x] **NICHE-05**: Müşteri ve proje verisi cihazlar arasında senkronlanır — aynı adlı kayıtlar tekilleştirilir, görev bağları zincirleme yeniden eşlenir, yalnızca müşteri/proje değişince de senkron tetiklenir
- [x] **NICHE-06**: Müşteri silmek projelerini siler, görevlerini **silmez**, görevlerin iki bağını da boşaltır — istemci ve veritabanı aynı sonucu üretir
- [x] **NICHE-07**: Tutarsız bağ veritabanı seviyesinde reddedilir: başkasının müşterisine/projesine bağlanma, projesi başka müşteriye ait görev, `project_id` dolu / `client_id` boş satır
- [x] **NICHE-08**: `VITE_NICHE_MODULE=false` ile modül tamamen çıkar — rota kaydedilmez, seçiciler render edilmez, `runSync` adımları atlanır ve `dist/` içinde iz kalmaz

### Niche Module — Slice 2 (Zaman kaydı ve dışa aktarım)

- [ ] **TIME-01**: Kullanıcı bir görev için zaman sayacı başlatıp durdurabilir; sayaç sayfa yenilemesinden sağ çıkar
- [ ] **TIME-02**: Kullanıcı elle zaman kaydı ekleyebilir, düzeltebilir ve silebilir
- [ ] **TIME-03**: Kullanıcı harcanan süreyi müşteri ve proje kırılımında toplam olarak görebilir
- [ ] **TIME-04**: Zaman kayıtları cihazlar arasında **birikerek** senkronlanır — iki cihazdaki kayıtlar birbirini ezmez (son-yazan-kazanır burada geçerli değildir)
- [ ] **TIME-05**: Kullanıcı müşteri, proje ve tarih aralığına göre CSV dışa aktarım alabilir
- [ ] **TIME-06**: Zaman kaydı ve CSV dışa aktarım aynı `VITE_NICHE_MODULE` bayrağıyla çıkar; kapalıyken `dist/` içinde iz kalmaz

### Payment (Ödeme ve Pro kapılama)

- [ ] **PAY-01**: Kullanıcı ücretli plana abone olabilir ve ödeme akışını seçilen sağlayıcı üzerinden tamamlayabilir
- [ ] **PAY-02**: Abonelik durumu webhook ile `subscriptions` tablosuna yazılır; **imzası doğrulanmamış hiçbir olaya güvenilmez**
- [ ] **PAY-03**: Pro özellikleri veritabanı seviyesinde kapılanır (Postgres fonksiyonu + `WITH CHECK`) ve doğrudan API çağrısıyla aşılamaz
- [ ] **PAY-04**: Ücretsiz plan sınırı tanımlıdır; sınıra ulaşan kullanıcı neden engellendiğini ve yükseltme yolunu net görür
- [ ] **PAY-05**: Kullanıcı hesap sayfasında plan durumunu görür ve aboneliğini yönetebilir (iptal / faturalama portalı)
- [ ] **PAY-06**: Hesaba özel sayfalar (faturalama) oturum koruması arkasındadır; oturumsuz kullanıcı erişemez ve uygulamanın geri kalanı local-first kalmaya devam eder

### Packaging (Paketleme ve yayın)

- [ ] **PKG-01**: `supabase/seed.sql` demo verisiyle yeni bir kurulum ilk açılışta dolu ve gezilebilir gelir
- [ ] **PKG-02**: `docs/` kurulum, mimari, özellik bayrakları, dağıtım, niş modülü çıkarma ve gelecek genişletmeleri İngilizce olarak anlatır
- [ ] **PKG-03**: README İngilizce olarak yeniden yazılır ve ekran görüntüleri içerir
- [ ] **PKG-04**: Uygulama belgelenmiş adımlarla Vercel/Netlify'a dağıtılır ve çalışan bir demo adresi vardır
- [ ] **PKG-05**: `CHANGELOG.md` + semver sürümleme kurulur; `package.json` sürümü `0.0.0` olmaktan çıkar
- [ ] **PKG-06**: `workspace_id` (takım / çoklu kiracılık) göç yolu dokümante edilir — inşa edilmez

## v2 Requirements

Kabul edilmiş ama ertelenmiş. Mevcut roadmap'te yer almaz.

### Teams

- **TEAM-01**: `workspace_id` ile takım çalışma alanları ve paylaşılan görevler
- **TEAM-02**: Çalışma alanına davet ve rol yönetimi

### Auth

- **AUTH-05**: Google OAuth (Cloud Console hesabı gerektiği için ertelendi)

### Sync

- **SYNC-01**: Sunucu tarafı mezar taşı tablosu + `updated_at` imleciyle artımlı çekme
- **SYNC-02**: Supabase Realtime ile anlık güncelleme (yoklamanın yerine)
- **SYNC-03**: Senkron motorunun varlık tanımı üzerinden tam genelleştirilmesi (CON-32 borcu)

### Quality

- **QUAL-01**: React bileşenleri için `@testing-library/react` birim testleri
- **QUAL-02**: Kapsam ölçümü ve eşiği (`test:coverage` + `vitest.config.ts` eşiği)
- **QUAL-03**: LocalStorage kota aşımı ve bozuk JSON rehydration yollarının testi

## Out of Scope

| Feature | Reason |
|---------|--------|
| Stripe entegrasyonu | Kullanıcı Türkiye'de, Stripe hesabı açamıyor — kilitli karar DEC-PAY-01 |
| Takım / çoklu kiracılık (v1'de) | Şemayı, RLS'i ve senkron motorunu birden değiştirirdi; göç yolu PKG-06 ile dokümante edilir |
| Google OAuth | Google Cloud Console hesabı gerekiyor, kullanıcının hesabı yok |
| react-query veri katmanı | Zustand birincil kaldı; bağımlılık kaldırıldı |
| Gerçek zamanlı senkron | 60 sn yoklama bilinçli sadelik tercihi; mevcut ölçekte yeterli |
| Mobil uygulama | Web/PWA öncelikli |
| Müşteri kaydında renk sütunu | Görev satırında zaten kategori renk rozeti var; ikinci rozet gürültü olur (CON-02) |
| Müşteri/proje adında benzersizlik kısıtı | Çevrimdışı iki cihazın çakışması 23505 ile o turdaki bütün senkronu düşürürdü (CON-04) |
| Niş modülde tohum (seed) verisi | Müşteri listesi boş başlar; kategorilerdeki "iki dilde tohumlanma" çakışma riski burada hiç doğmasın (CON-28) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HARD-01 | Phase 1 | ✅ Done — `eslint.config.js` → jsxA11y.flatConfigs.recommended; CI npm run lint ile kapı |
| HARD-02 | Phase 1 | ✅ Done — `vercel.json` + `public/_headers`; security-headers.test.ts ikisini eşitler |
| HARD-03 | Phase 1 | ✅ Done — sync.test.ts → sıra, inFlight kilidi, hata sonrası kilit bırakma |
| HARD-04 | Phase 1 | ✅ Done — fetchAllRows sayfalama + SyncTooLargeError; task-repository.test.ts |
| HARD-05 | Phase 1 | ✅ Done — SyncOutcome.discarded → SyncProvider bildirimi; sync.test.ts sayımı sınar |
| HARD-06 | Phase 1 | ✅ Done — isValidColor DB kısıtının aynısı; categories.test.ts |
| NICHE-01 | Phase 2 | ✅ Done |
| NICHE-02 | Phase 2 | ✅ Done |
| NICHE-03 | Phase 2 | ✅ Done |
| NICHE-04 | Phase 2 | ✅ Done |
| NICHE-05 | Phase 2 | ✅ Done |
| NICHE-06 | Phase 2 | ✅ Done |
| NICHE-07 | Phase 2 | ✅ Done |
| NICHE-08 | Phase 2 | ✅ Done |
| TIME-01 | Phase 3 | Pending |
| TIME-02 | Phase 3 | Pending |
| TIME-03 | Phase 3 | Pending |
| TIME-04 | Phase 3 | Pending |
| TIME-05 | Phase 3 | Pending |
| TIME-06 | Phase 3 | Pending |
| PAY-01 | Phase 4 | Pending |
| PAY-02 | Phase 4 | Pending |
| PAY-03 | Phase 4 | Pending |
| PAY-04 | Phase 4 | Pending |
| PAY-05 | Phase 4 | Pending |
| PAY-06 | Phase 4 | Pending |
| PKG-01 | Phase 5 | Pending |
| PKG-02 | Phase 5 | Pending |
| PKG-03 | Phase 5 | Pending |
| PKG-04 | Phase 5 | Pending |
| PKG-05 | Phase 5 | Pending |
| PKG-06 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-14*
*Last updated: 2026-08-14 after initial definition (ingest + codebase map derived)*
