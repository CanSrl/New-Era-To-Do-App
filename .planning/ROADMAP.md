# Roadmap: Yapılacaklar Listesi

## Overview

Temel hazır: auth, kategoriler, cihazlar arası senkron, i18n, router, hata
sınırları, testler ve CI gönderilmiş durumda. Buradan sonrası ürünü **satılabilir**
hale getirmekle ilgili. Önce kod tabanı yeni yüzey almadan sağlamlaştırılır
(erişilebilirlik linti, güvenlik başlıkları, senkron sırasının doğrudan testi) —
çünkü senkron motoru bir sonraki fazda ikiye katlanacak ve yeni arayüz o
kurallar altında yazılmalı. Sonra niş modül iki dilimde gelir: önce müşteriler
ve projeler, ardından zaman kaydı ve CSV dışa aktarım. İkisi de tek bir
`VITE_NICHE_MODULE` bayrağıyla üretim paketinden izsiz çıkabilir olmalı — bu,
jenerik starter kit değerinin bozulmadığının kanıtı. Ürün yüzeyi tamamlandıktan
sonra ödeme ve Pro kapılama gelir (Stripe kullanılamıyor; kapılama veritabanı
seviyesinde olmak zorunda), en sonda da starter kit'i bir alıcının eline
verilebilir hale getiren paketleme.

<details>
<summary>✅ Tamamlanan temel (v0) — yeniden planlanmaz</summary>

- Faz 0 — Temizlik ve altyapı: ölü dosyalar, marka/PWA ikon seti, `@/*` alias,
  Radix dialog/alert-dialog, `confirm()` kaldırıldı
- Faz 1 — Supabase + Auth: `profiles`/`categories`/`tasks` şeması, tam RLS,
  e-posta/parola auth, parola sıfırlama, GitHub OAuth (bayrakla kapalı),
  kullanıcı tanımlı kategoriler
- Faz 1.5 — Test altyapısı ve mimari düzeltmeler: Vitest + Playwright,
  tarih tipleri, `position` alanı, TaskForm Radix Dialog'a taşındı
- Faz 2 — Veri katmanı: cihazlar arası senkron (eşleme, repository, saf
  birleştirme motoru, `SyncProvider` + durum göstergesi)
- CI — kalite ve entegrasyon olmak üzere iki paralel iş, her push ve PR'da
- Router ve ayarlar sayfası — React Router v7, parola sıfırlama akışı,
  SPA geri dönüş yapılandırması
- i18n (tr + en), hata sınırları, opsiyonel hata izleme (Sentry, kapalı)

Ayrıntı: `CLAUDE.md` → Fazlar, `.planning/PROJECT.md` → Requirements → Validated.

</details>

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Ürün sağlamlaştırma** - Erişilebilirlik linti, HTTP güvenlik başlıkları, senkron sırasının testi ve sessiz veri kaybının görünür kılınması *(6/6 gereksinim; kriter 2'nin canlı doğrulaması dağıtıma bağlı)*
- [x] **Phase 2: Niş modül — müşteriler ve projeler** - Görevi müşteriye/projeye bağlama, yönetim ekranı, teslim görünümü; hepsi tek bayrakla çıkarılabilir *(6/6 kriter ✅)*
- [ ] **Phase 3: Niş modül — zaman kaydı ve dışa aktarım** - Basit zaman kaydı (biriken senkron semantiği) ve müşteri/proje kırılımlı CSV dışa aktarım
- [ ] **Phase 4: Ödeme ve Pro kapılama** - Stripe'sız abonelik akışı, imza doğrulamalı webhook, veritabanı seviyesinde Pro kapısı
- [ ] **Phase 5: Paketleme ve yayın** - Demo veri, İngilizce dokümantasyon ve README, dağıtım, semver + CHANGELOG

## Phase Details

### Phase 1: Ürün sağlamlaştırma
**Goal**: Kod tabanı yeni yüzey almadan önce sağlamlaşır; sessiz başarısızlıklar (kırpılan anlık görüntü, elenen değişiklik, korumasız başlıklar) görünür ya da imkânsız hale gelir
**Depends on**: Nothing (ilk faz — temel v0 zaten gönderilmiş durumda)
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04, HARD-05, HARD-06
**Success Criteria** (what must be TRUE):
  1. ✅ Erişilebilirlik ihlali içeren bir değişiklik CI'da düşer — kural artık konvansiyon değil kapı — `eslint.config.js`, CI'daki `npm run lint`
  2. ⚠️ Yayındaki uygulama `curl -I` ile bakıldığında CSP, `frame-ancestors 'none'`, `nosniff` ve `Referrer-Policy` başlıklarını döndürür; sayfa bir iframe'e gömülemez — **yapılandırma hazır** (`vercel.json` + `public/_headers`, `security-headers.test.ts` ikisini eşit tutuyor) ama canlı doğrulama dağıtım gerektiriyor, o da Phase 5'te
  3. ✅ Kullanıcı, çakışma yüzünden yerel değişikliği elendiğinde bunu ekranda görür — değişiklik artık sessizce kaybolmaz — `SyncOutcome.discarded` → `SyncProvider` bildirimi
  4. ✅ `runSync` yazma/silme sırasını bozan bir değişiklik E2E'ye kalmadan birim testinde düşer — `888e6e5`, `src/lib/sync.test.ts`
  5. ✅ Bin satırın üzerinde veri olan bir hesapta senkron ya doğru çalışır ya da açıkça hata verir; sessizce "uzakta silinmiş" saymaz — `fetchAllRows` sayfalama + `SyncTooLargeError`
**Plans**: TBD

**Notlar:**
- ⚠️ **Bu faz sırası dışında yapıldı** (16 Ağustos, Phase 2'nin büyük kısmı
  gönderildikten sonra). Aşağıdaki sıralama gerekçesi pratikte karşılığını
  bulmadı: `eslint-plugin-jsx-a11y` sonradan kurulduğunda bütün kod tabanında
  yalnızca **3 ihlal** çıktı ve üçü de aynı kuraldı (`no-autofocus`).
  Beklenen toplu düzeltme borcu doğmadı — erişilebilirlik zaten konvansiyon
  olarak uygulanıyordu. Ayrıntı: `.planning/STATE.md` → Deviations.
- Bu faz bilinçli olarak Phase 2'den önce durur: `eslint-plugin-jsx-a11y` yeni
  ekranlar yazılmadan kurulmalı (sonra kurmak toplu düzeltme demek) ve
  `sync.test.ts`, senkron motoru ikiye katlanmadan önce yeşil olmalı —
  `CLAUDE.md` çalışma biçimi: "yapısal değişiklikten önce testlerin yeşil
  olduğundan emin ol".
- Kaynak: `CLAUDE.md` → Kalan işler (jsx-a11y) ve `.planning/codebase/CONCERNS.md`
  (güvenlik başlıkları, sayfalama, `discardedIds`, renk doğrulaması, sync testi).

### Phase 2: Niş modül — müşteriler ve projeler
**Goal**: Serbest çalışan, görevlerini müşteri ve projeye bağlayıp teslim odaklı bakabilir; starter kit alıcısı ise aynı modülü tek satırda çıkarabilir
**Depends on**: Phase 1
**Requirements**: NICHE-01, NICHE-02, NICHE-03, NICHE-04, NICHE-05, NICHE-06, NICHE-07, NICHE-08
**Success Criteria** (what must be TRUE):
  1. ✅ Kullanıcı müşteri ve proje oluşturup yönetebilir; silme diyaloğu etkiyi sayıyla söyler ("2 projesi silinecek, 5 görevin bağı kopacak, görevler silinmez") — `ClientCard.tsx`, `client.deleteConfirm*` (çoğullu, count'lu)
  2. ✅ Kullanıcı bir görevi müşteriye ve o müşterinin projesine bağlayabilir; müşteriyi değiştirdiğinde proje seçimi temizlenir — `TaskForm.tsx` (`5ef4994`)
  3. ✅ Kullanıcı `/app/delivery` ekranında görevlerini müşteri → proje kırılımında, teslim tarihine göre sıralı görür; filtre ve arama çalışır — `groupForDelivery`/`filterForDelivery` (18 birim testi) + `e2e/teslim.spec.ts` (7 test)
  4. ✅ Aynı hesabın iki cihazı çevrimdışıyken aynı müşteriyi oluşturursa senkron sonrası tek kayıt kalır ve görev bağları doğru kayda işaret eder — `idRemap` + `remapTaskLinks`, birim testli
  5. ✅ Başka bir kullanıcının müşterisine ya da tutarsız bir projeye bağlı görev veritabanı tarafından reddedilir — arayüzü atlayan doğrudan çağrıyla bile — bileşik FK üçlüsü + RLS, 50 şema testi
  6. ✅ `VITE_NICHE_MODULE=false npm run build` sonrası `dist/assets` içinde modülden hiçbir iz bulunmaz — 995.40 kB → 973.78 kB; `npm run verify:niche` CI'da iki yönlü ölçüyor
**Plans**: TBD (iş gsd döngüsü dışında, doğrudan commit'lerle yürütüldü — `58526f2` → `d7a7074`)
**UI hint**: yes

**Notlar:**
- **Durum (16 Ağu): faz kapandı.** Plan dokümanındaki görevlerin tamamı
  karşılandı; teslim görünümü (Görev 9) bugün eklendi.
- **DEC-NICHE-01 nihayet gerçek anlamda karşılandı.** Kararın harfi baştan
  uygulanmıştı (bayrak koşulu rota kaydı seviyesinde) ama amacı — paketten
  izsiz çıkma — gerçekleşmiyordu. İki sessiz sebep vardı: bayrak bir nesne
  özelliğiydi (özellik erişimi derleme zamanında katlanmıyor) ve çeviri
  metinleri kod elense bile JSON olarak pakete giriyordu. İkisi de çözüldü;
  `npm run verify:niche` beş izi iki yönlü ölçüyor ve CI'da koşuyor.
- **Bu fazın görev kırılımı zaten yazılmış durumda** — burada tekrarlanmaz:
  `docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md` (10 görev),
  teknik tasarım `docs/superpowers/specs/2026-08-14-nis-modul-musteri-proje-design.md`.
  Planlama bu dokümanları kaynak alır.
- Kısıtlar sentezlenmiş hâlde: `.planning/intel/constraints.md`
  (CON-01…CON-34) — şema ve bileşik yabancı anahtarlar, `clients_clear_tasks`
  tetikleyicisi, GRANT + RLS, senkron sırası, zincirleme id yeniden eşleme,
  `pendingCount`, i18n ve test kapıları.
- **Kilitli karar DEC-SYNC-01 (CON-35b):** tek jenerik `mergeNamed` çekirdeği;
  `mergeCategories` imzası değişmeden ince bir sarmalayıcıya döner. CON-35a
  (kopyala) reddedildi. Gerekçe: `.planning/INGEST-CONFLICTS.md` → RESOLUTION.
- **Kilitli karar DEC-NICHE-01:** bayrak koşulu modül gövdesinde / rota kaydı
  seviyesinde olur, render içinde değil.

### Phase 3: Niş modül — zaman kaydı ve dışa aktarım
**Goal**: Serbest çalışan harcadığı süreyi müşteri/proje bazında ölçebilir ve faturalandırma için dışarı çıkarabilir
**Depends on**: Phase 2
**Requirements**: TIME-01, TIME-02, TIME-03, TIME-04, TIME-05, TIME-06
**Success Criteria** (what must be TRUE):
  1. Kullanıcı bir görev için sayacı başlatıp durdurabilir; sayfayı yenilediğinde sayaç kaybolmaz
  2. Kullanıcı unuttuğu bir çalışmayı elle kayıt olarak girebilir, düzeltebilir ve silebilir
  3. Kullanıcı bir müşteri veya proje için toplam harcanan süreyi görebilir
  4. İki cihazda aynı gün girilen zaman kayıtları senkron sonrası **toplanır**, biri diğerini ezmez
  5. Kullanıcı seçtiği müşteri/proje ve tarih aralığı için CSV dosyası indirebilir
  6. `VITE_NICHE_MODULE=false` ile zaman kaydı da tamamen çıkar; `dist/` içinde iz kalmaz
**Plans**: Tasarım hazır — `docs/superpowers/specs/2026-08-16-nis-modul-zaman-kaydi-design.md` (`745b84d`); uygulama planı yazılıyor
**UI hint**: yes

**Notlar:**
- **Tasarım onaylandı (16 Ağu).** Kilitlenen kararlar `.planning/STATE.md` →
  Current Position tablosunda özet, gerekçeleriyle spec'te.
- ~~Zaman kaydı bilinçli olarak ayrı bir dilim: ... Birleştirme semantiği bu faz
  için ayrıca tasarlanmalı.~~ **CON-33 yeniden okundu ve kapatıldı.** "Biriken,
  düzenlenmeyen kayıt" ve "son-yazan-kazanır burada yanlış sonuç verir" ifadeleri
  bir **modelleme** uyarısıdır, yeni bir birleştirme motoru ihtiyacı değil. Zaman
  `(görev, gün) → toplam süre` biçiminde tek değiştirilebilir satır olarak
  tutulsaydı LWW veri yerdi; her kayıt **kendi UUID'si olan ayrı bir giriş**
  olduğu için iki cihazın kayıtları birleşmede zaten toplanır. Kriter 4 tasarımla
  karşılanıyor; `mergeTimeLogs`, `mergeCategories` ailesinin değil `mergeTasks`'ın
  kalıbını izler (ad yok → `idRemap` yok).
- ~~CON-32'de kayıtlı borç ... bu fazda ele alınabilir~~ — **bu fazın dışında.**
  `mergeNamed` (DEC-SYNC-01) adlı kayıtlar için tasarlandı ve `time_logs` onun
  tüketicisi olmayacak; yani faz üçüncü kopyayı yazmıyor ve kararı zorlamıyor.
  Borç bağımsız refactor olarak açık kalır (v2 → SYNC-03). Gerekçe: CON-32'nin
  kendi mantığı — çalışan bir motoru yeni özellik eklerken yeniden yazmak iki
  riski üst üste bindirir.
- CSV dışa aktarım (`papaparse`) asıl anlamını zaman kayıtlarıyla kazanır;
  bu yüzden Phase 2'ye değil buraya bağlandı. `papaparse`'ın bayrak kapalıyken
  pakete hiç girmemesi bu fazın en somut ölçütü — kod elenip bağımlılık kalsaydı
  bayrak sözünü tutmazdı.
- ⚠️ Niş modül artık **iki** migration dosyası ve `tasks` tablosuna dokunan tek
  bir kısıt (`tasks_id_user_id_key`, bileşik FK'nın hedefi olarak zorunlu).
  Modülü çıkarma yordamı ikisini birden ve `drop constraint`'i söylemeli;
  `CLAUDE.md`'deki "tek migration dosyası" ifadesi bu fazda güncellenir.

### Phase 4: Ödeme ve Pro kapılama
**Goal**: Ürün para kazanabilir hâle gelir ve Pro sınırı arayüzden değil veritabanından uygulanır
**Depends on**: Phase 3
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06
**Success Criteria** (what must be TRUE):
  1. Kullanıcı ücretli plana abone olabilir ve ödemeyi tamamladıktan sonra hesabı Pro'ya geçer
  2. Sahte bir "abonelik aktif" webhook isteği reddedilir — imzası doğrulanmayan hiçbir olay hesabı yükseltemez
  3. Ücretsiz bir kullanıcı, arayüzü atlayıp doğrudan API'ye giderek Pro sınırını aşamaz
  4. Sınıra ulaşan ücretsiz kullanıcı neden engellendiğini ve nasıl yükselteceğini net görür
  5. Kullanıcı hesap sayfasında plan durumunu görür ve aboneliğini iptal edebilir
  6. Oturumsuz bir ziyaretçi faturalama sayfasına giremez; uygulamanın geri kalanı girişsiz çalışmaya devam eder
**Plans**: TBD
**UI hint**: yes

**Notlar:**
- **Kilitli karar DEC-PAY-01:** Stripe kullanılamaz (kullanıcı Türkiye'de,
  hesap açamıyor). Adaylar iyzico ya da LemonSqueezy/Paddle. Sağlayıcı seçimi bu
  fazın ilk işidir ve `subscriptions` şemasını belirler.
- **Kilitli karar DEC-PAY-02:** Pro kapılama Postgres fonksiyonu + `WITH CHECK`
  ile veritabanında da olacak; yalnızca UI'da gizlemek doğrudan API çağrısıyla
  aşılır.
- **Kilitli karar DEC-PAY-03:** webhook imza doğrulaması olmadan hiçbir olaya
  güvenilmez. `SUPABASE_SERVICE_ROLE_KEY` asla `VITE_` önekiyle tanımlanmaz —
  yalnızca Edge Function secrets'ta yaşar.
- PAY-06, bugün var olmayan bir ilkelin (rota koruması) ilk kez gerekmesi
  demek: `/app` bilinçli olarak korumasız, çünkü uygulama local-first. Koruma
  yalnızca hesaba özel sayfaları sarmalı, uygulamanın tamamını değil.

### Phase 5: Paketleme ve yayın
**Goal**: Bir alıcı depoyu klonlayıp kendi SaaS'ını kurabilir; ürünün canlı, gösterilebilir bir hâli vardır
**Depends on**: Phase 4
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, PKG-05, PKG-06
**Success Criteria** (what must be TRUE):
  1. Yeni bir geliştirici depoyu klonlayıp dokümandaki adımlarla, dolu demo veriyle çalışan bir kuruluma ulaşır
  2. `docs/` bir alıcının soracağı soruları yanıtlar: kurulum, mimari, özellik bayrakları, dağıtım, niş modülü çıkarma, takıma geçiş yolu
  3. README İngilizcedir ve ürünün ne olduğunu ekran görüntüleriyle gösterir
  4. Çalışan bir demo adresi vardır ve dağıtım adımları tekrarlanabilir biçimde yazılıdır
  5. Sürüm numarası ve `CHANGELOG.md` kırıcı değişiklikleri alıcıya anlatabilir hâldedir
**Plans**: TBD

**Notlar:**
- Ekran görüntüleri i18n sonrası alınmalı (mevcut) ve niş modül açık/kapalı iki
  hâli de göstermeli — modülün çıkarılabilirliği satış argümanının kendisi.
- PKG-06 yalnızca dokümantasyondur: `workspace_id` göç yolu yazılır, inşa
  edilmez (DEC-SCOPE-01).

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Kriter | Status | Completed |
|-------|--------|--------|-----------|
| 1. Ürün sağlamlaştırma | 5/5 | **Tamamlandı** (kriter 2 canlı doğrulama bekliyor) | 2026-08-16 |
| 2. Niş modül — müşteriler ve projeler | 6/6 | **Tamamlandı** | 2026-08-16 |
| 3. Niş modül — zaman kaydı ve dışa aktarım | 0/6 | **Tasarım onaylandı**, uygulama başlamadı | - |
| 4. Ödeme ve Pro kapılama | 0/6 | Not started | - |
| 5. Paketleme ve yayın | 0/5 | Not started | - |

**Not:** İlerleme plan/summary sayısıyla değil **başarı kriteriyle** ölçülüyor;
Phase 1 ve 2 işi gsd plan→execute döngüsü dışında yürütüldüğü için
`.planning/phases/` altında artefakt yok ve `gsd query progress` %0 gösterir.
Sayaçlara değil bu tabloya bakın. Son senkron: 2026-08-16, `bf5cea1` esas
alınarak.
