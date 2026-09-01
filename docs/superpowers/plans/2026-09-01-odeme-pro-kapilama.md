# Faz 4: Ödeme ve Pro kapılama (LemonSqueezy) — uygulama planı

> **Ajan çalışanlar için:** ZORUNLU ALT SKILL: Bu planı görev görev uygulamak
> için `superpowers:subagent-driven-development` (önerilen) ya da
> `superpowers:executing-plans` kullanın. Adımlar takip için checkbox
> (`- [ ]`) söz dizimi kullanır.

**Hedef:** Ürün para kazanabilir hâle gelir ve Pro sınırı arayüzden değil
veritabanından uygulanır.

**Sağlayıcı:** LemonSqueezy (merchant of record). Stripe kullanılamıyor.
Sağlayıcıya özgü kod tek bir adaptör dosyasında toplanır.

**Ücretsiz sınır:** 1 müşteri. Pro sınırsız.

**Yığın:** Mevcut yığına ek olarak **Supabase Edge Functions (Deno)** — bu
depoda ilk kez sunucu tarafı çalışma zamanı oluşuyor.

**Spec:** `docs/superpowers/specs/2026-09-01-odeme-pro-kapilama-design.md`

**Dal:** `faz-4-odeme`

---

## Global Constraints

Bu bölüm her görevin gereksinimlerine örtük olarak dâhildir.

- **Dil:** Kod içi yorumlar ve commit mesajları Türkçe; dosya/klasör yolları,
  tip ve fonksiyon adları İngilizce.
- **`tsconfig.app.json` katı ayarları korunur** (`strict`, `noUnusedLocals`,
  `erasableSyntaxOnly`).
- **Çeviri anahtarları tiplidir.** Faturalama anahtarları `billing.*` ön
  ekiyle `src/i18n/locales/tr.json` + `en.json` içine (niş dosyalara **değil**
  — faturalama niş modüle ait değil, starter kit'in kendisine ait).
  `src/i18n/i18n.test.ts` iki dosyanın aynı şekli taşıdığını doğrular.
- **Kullanıcıya metin döndüren saf katmanlar `TranslationKey` döndürür.**
- **Saf fonksiyonlar `Date.now()`/`new Date()` çağırmaz**; `now` parametre
  olarak geçer.
- **Hiçbir sır `VITE_` önekiyle tanımlanmaz.** Bu önek değeri istemci
  paketine gömer. Görev 9'da bir tarama testi bunu kalıcı kurala çevirir.
- **Edge Function'lar Deno'da çalışır**, Vite paketine girmez. `node:crypto`
  specifier'ı Supabase Edge Runtime'da desteklenir.
- **Yerel Supabase gerekir** (`npx supabase start`). `.env.local` **yerel**
  yığını göstermeli, bulut projesini değil.
- **Her görev testleri yeşilken kapanır:** `npm test`, `npm run lint`,
  `npx tsc --noEmit`. Şema dokunan görevlerde ayrıca `npm run test:rls`.

---

### Task 0: Sağlayıcı hesabı — **kod yazılmadan önce, kullanıcı yapar**

Bu görev tıkanırsa planın tamamı geçersizdir. Ahmet yapar, ajan yapamaz.

- [ ] LemonSqueezy'de hesap aç ve **mağaza aktivasyonunu Türkiye adresi/banka
      ya da PayPal ile tamamla**. LS'nin desteklenen satıcı ülkeleri listesi
      doğrulanamadı (docs sayfası dışarıdan 403 dönüyor) — teyit ancak
      deneyerek alınır. **Reddedilirse dur ve sağlayıcı kararını yeniden aç
      (iyzico).**
- [ ] Bir abonelik ürünü + varyantı oluştur (aylık, USD). `variant_id`'yi not
      al.
- [ ] Mağaza **test modundayken** bir webhook uç noktası tanımla, imzalama
      sırrını (signing secret) not al. Adres Görev 5'te netleşecek; şimdilik
      yer tutucu.
- [ ] API anahtarı üret.
- [ ] Değerleri `.env.cloud.local` yanına, git'in görmediği bir yere yaz.
      **Hiçbiri `VITE_` önekiyle tanımlanmaz.**

**Verification:** LS panelinde mağaza "active" görünüyor ve test modunda bir
checkout linki açılıyor.

---

### Task 1: `subscriptions` şeması, `is_pro`, RLS

**Files:**
- Create: `supabase/migrations/20260901120000_billing.sql`
- Modify: `supabase/tests/rls.test.mjs`
- Modify: `src/lib/database.types.ts` (üretilir, elle yazılmaz)

**Step 1 — tablo.** Spec §5'teki şema. `user_id` birincil anahtar,
`provider_subscription_id` `unique`. `updated_at` tetikleyicisi mevcut
tabloların desenini izler.

**Step 2 — GRANT ve RLS.** `authenticated` rolüne **yalnızca `SELECT`**;
`INSERT`/`UPDATE`/`DELETE` verilmez. `anon`'a hiçbir şey. Politika:
`using (user_id = auth.uid())`.
⚠️ GRANT verilmezse politikalar hiç değerlendirilmez — bu depoda bir kez
gerçek hataya yol açtı.

**Step 3 — `is_pro(uid uuid)`.** `stable`, `set search_path = public`.
`true`: `status in ('active','on_trial','cancelled')` **ve**
(`ends_at is null` veya `ends_at > now()`). `cancelled`'ın Pro sayılma
gerekçesi spec DEC-PAY-11'de.

**Step 4 — `client_count(uid uuid)`.** `security definer`, `stable`,
`set search_path = public`. Arşivli dahil bütün satırları sayar.

**Step 5 — RLS testleri** (`rls.test.mjs`, mevcut desene ek):
- Kullanıcı kendi abonelik satırını **okuyabilir**
- Başkasınınkini okuyamaz
- Kendi satırını **yazamaz** (`insert` reddedilir) ← Pro'ya kendini yükseltme
- `is_pro` abonelik yokken `false`
- `is_pro`, `active` satırla `true`
- `is_pro`, `ends_at` geçmişte olan `cancelled` satırla `false`

**Verification:** `npm run test:rls` yeşil; `npm run db:types` sonrası
`npx tsc --noEmit` temiz.

---

### Task 2: Müşteri kapısı — `WITH CHECK`

**Files:**
- Create: `supabase/migrations/20260901130000_billing_gate.sql`
- Modify: `supabase/tests/rls.test.mjs`

Ayrı migration dosyası, çünkü faturalama istemeyen starter kit alıcısı
yalnızca bunu silecek (spec DEC-PAY-12).

**Step 1.** `clients` tablosunun mevcut `INSERT` politikasını oku
(`20260814120000_niche_module.sql`) ve spec §5'teki koşulla değiştir.
**Yalnızca `INSERT`** — `UPDATE` politikasına dokunulmaz (spec DEC-PAY-04).

**Step 2 — RLS testleri:**
- Ücretsiz kullanıcı 1. müşteriyi ekleyebilir
- Ücretsiz kullanıcı 2. müşteriyi **ekleyemez** ← başarı kriteri 3
- 1. müşteriyi arşivlemek 2.'yi eklemeye izin **vermez**
- Ücretsiz kullanıcı mevcut müşterisini **güncelleyebilir**
- Aboneliği `active` olan kullanıcı 2., 3. müşteriyi ekleyebilir
- Aboneliği `expired` olan kullanıcı yeni ekleyemez ama mevcutları durur

**Verification:** `npm run test:rls` yeşil. ⚠️ Testler Supabase istemcisiyle
doğrudan API çağırır, arayüzden geçmez — kriter 3'ün kanıtı budur.

---

### Task 3: Senkron kalıcı reddi atlatır (`blocked`)

Fazın en riskli görevi. Spec DEC-PAY-06'yı okumadan başlamayın.

**Files:**
- Modify: `src/lib/sync.ts`, `src/lib/sync.test.ts`
- Modify: `src/lib/task-repository.ts`
- Modify: `src/components/SyncProvider.tsx`
- Modify: `src/i18n/locales/tr.json`, `en.json`

**Step 1 — hata sınıflandırması.** `src/lib/sync-errors.ts` (yeni, saf):
PostgREST hata nesnesinden `retryable` / `terminal` ayrımı. Terminal kodlar:
`42501` (RLS), `23514` (check), `23502` (not null), `23503` (FK).
⚠️ `23503` bugün senkron sırası bozulduğunda da çıkıyor; terminal saymak bir
sıra hatasını sessizce "engellendi" diye göstermemeli — bu yüzden mesaj
anahtarları koda göre ayrılır.

**Step 2 — satır izolasyonu.** `pushRemoteClients` toplu `upsert` yapıyor ve
PostgREST hangi satırın reddedildiğini söylemiyor. Terminal hata alan grup
**satır satır** yeniden denenir; geçenler yazılır, düşen(ler) döner.
Yalnızca hata yolunda çalışır, sıcak yol maliyeti değişmez.

**Step 3 — `SyncOutcome.blocked`.** `discarded` deseninin ikizi. Engellenen
id'ler `dirtyIds`'ten çıkarılır, **yerel kayıt silinmez**, LocalStorage'da
`blockedIds` olarak tutulur (yenilemeden sonra da bilinsin diye).

**Step 4 — bildirim.** `SyncProvider` engellenen kayıt için açıklayıcı bir
bildirim gösterir ve `/app/billing`'e yönlendiren bir eylem sunar.

**Step 5 — testler** (`sync.test.ts`, saf birleştirme deseninde):
- Terminal hata alan satır turu düşürmez, tur tamamlanır
- Geçici hata alan satır dirty **kalır** (tekrar denenir)
- Terminal hata alan satır dirty **kalmaz** (sonsuz döngü yok)
- Toplu push düşünce izolasyon yalnızca suçluyu engeller, kardeşleri yazar
- Engellenen satır yerelde durur

**Verification:** `npm test` yeşil. ⚠️ Bu görev bittiğinde **Görev 2'nin
kapısı zaten yürürlükte** olduğu için gerçek bir uçtan uca deneme mümkün:
ücretsiz hesapla iki müşteri oluştur, giriş yap, senkronun tıkanmadığını
gör. Bu elle deneme testin yerine geçmez, sadece erken sinyal verir.

---

### Task 4: İstemci tarafı plan katmanı ve ikiz kapı

**Files:**
- Create: `src/lib/billing.ts`, `src/lib/billing.test.ts`
- Modify: `src/lib/types.ts` (`Subscription`, `PlanStatus`)
- Modify: `src/store/index.ts`
- Modify: `src/components/ClientsPage`/`ClientCard` çağıran yol
- Modify: `src/i18n/locales/tr.json`, `en.json`

**Step 1 — saf katman.** `planStatusOf(subscription, now)` → `PlanStatus`
(`free | pro | pastDue`). `now` parametre. Sağlayıcı durumlarının eşlemesi
spec DEC-PAY-11'de; `is_pro` SQL fonksiyonunun **ikizidir**, ayrışırsa
kullanıcı arayüzde Pro görünüp veritabanında reddedilir.

**Step 2 — store.** `subscription` alanı (senkronla dolar, salt okunur) ve
`canAddClient(state)` seçicisi. `addClient` sınır aşıldığında **kaydı
oluşturmaz** ve çağırana `false` döner.
⚠️ Sınır **girişsiz kullanıcıya uygulanmaz**: uygulama local-first, giriş
isteğe bağlı. Kapı ancak `ownerId` varken devreye girer — aksi halde giriş
yapmamış kullanıcıyı hiç satmadığımız bir plana hapsederdik.

**Step 3 — arayüz.** Sınıra çarpan kullanıcı **neden** engellendiğini ve
yükseltme yolunu görür (başarı kriteri 4). Genel bir hata tostu değil,
`/app/billing`'e giden açık bir eylem.

**Step 4 — testler:** durum eşlemesinin altı hali, `ends_at` sınırı,
`canAddClient` girişli/girişsiz, `addClient` reddi kayıt oluşturmuyor.

**Verification:** `npm test`, `npx tsc --noEmit`.

---

### Task 5: Webhook Edge Function

**Files:**
- Create: `supabase/functions/_shared/billing/provider.ts` (arayüz)
- Create: `supabase/functions/_shared/billing/lemonsqueezy.ts`
- Create: `supabase/functions/_shared/billing/lemonsqueezy.test.ts`
- Create: `supabase/functions/lemonsqueezy-webhook/index.ts`
- Modify: `supabase/config.toml` (`[functions.lemonsqueezy-webhook]`,
  `verify_jwt = false`)

**Step 1 — adaptör arayüzü.** `verifySignature(rawBody, signature, secret)`,
`parseEvent(payload)` → sağlayıcıdan bağımsız bir `SubscriptionEvent`.

**Step 2 — imza doğrulama.** HMAC-SHA256, `X-Signature` başlığı, hex digest.
⚠️ **Ham gövde üzerinde** — `JSON.parse` + `stringify` baytları değiştirir ve
imza asla tutmaz. Karşılaştırma `timingSafeEqual` ile.

**Step 3 — olay işleme.**
- İmza geçersiz → `401`, **hiçbir şey yazılmaz** (başarı kriteri 2)
- `test_mode` ortamla uyuşmuyor → yok say (DEC-PAY-10)
- `subscription_created` → `meta.custom_data.user_id` ile kullanıcıyı bul
- Diğer olaylar → `provider_subscription_id` ile bul (DEC-PAY-08)
- Gelen `updated_at` saklanandan eski/eşit → yok say (idempotency)
- Yazma: service role istemcisi

**Step 4 — testler** (Deno test, adaptörün saf kısmı):
- Doğru imza kabul, **tek bit değişmiş imza red**
- Boş gövde/boş imza red
- Farklı sırra ait imza red
- Olay ayrıştırma: her LS durumu doğru `SubscriptionEvent`'e çevriliyor

**Verification:** `npx supabase functions serve` ile yerel uç noktaya
elle imzalanmış bir istek `200`, kurcalanmış imza `401` döner.

---

### Task 6: Checkout ve portal Edge Function'ları

**Files:**
- Create: `supabase/functions/billing-checkout/index.ts`
- Create: `supabase/functions/billing-portal/index.ts`
- Modify: `supabase/functions/_shared/billing/lemonsqueezy.ts`
- Modify: `supabase/config.toml`

**Step 1 — checkout.** JWT doğrular (`verify_jwt` varsayılan `true`),
LS `POST /v1/checkouts` çağırır, `checkout_data.custom.user_id` alanına
**JWT'den okunan** id'yi yazar (DEC-PAY-07 — istemciden gelen id asla
kullanılmaz), `data.attributes.url` döner.

**Step 2 — portal.** Kullanıcının `subscriptions` satırından
`provider_subscription_id` okunur, LS'ten taze `urls.customer_portal` alınır
(24 saat geçerli, saklanmaz) ve döndürülür. Aboneliği yoksa `404`.

**Step 3 — testler:** istemcinin gönderdiği `user_id` yok sayılıyor;
oturumsuz istek `401`; aboneliği olmayan kullanıcı portal isteğinde `404`.

**Verification:** Test modunda gerçek bir checkout açılıyor ve ödeme
tamamlandığında Görev 5'in webhook'u `subscriptions` satırını yazıyor.

---

### Task 7: `/app/billing` sayfası ve oturum koruması

**Files:**
- Create: `src/pages/BillingPage.tsx`
- Create: `src/components/RequireAuth.tsx`
- Modify: `src/router.tsx`, `src/components/AccountMenu.tsx`
- Modify: `src/config/features.ts` (`billing` bayrağı)
- Modify: `src/i18n/locales/tr.json`, `en.json`

**Step 1 — `RequireAuth`.** Yalnızca `/app/billing`'i sarar; `/app`'in
geri kalanı korumasız kalır (başarı kriteri 6).
⚠️ "Oturum yükleniyor" ile "oturum yok" **ayrı** durumlardır; ayrılmazsa
sayfa her açılışta bir kare giriş istemi gösterir.

**Step 2 — sayfa.** Plan durumu, yenileme/bitiş tarihi, `pastDue` uyarısı;
ücretsizse "Yükselt" (→ `billing-checkout`), Pro'ysa "Aboneliği yönet"
(→ `billing-portal`) — başarı kriterleri 1 ve 5.

**Step 3 — bayrak.** `features.billing`, varsayılan **kapalı**
(DEC-PAY-12). Kapalıyken rota kaydedilmez ve hesap menüsünde bağlantı
görünmez.

**Verification:** `npm run lint` (jsx-a11y dahil), `npm test`.

---

### Task 8: E2E ve sır taraması

**Files:**
- Create: `e2e/faturalama.spec.ts`
- Modify: `e2e/senkron.spec.ts` (gerekirse)
- Create: `src/config/secret-leak.test.ts`

**Step 1 — E2E:**
- Oturumsuz ziyaretçi `/app/billing`'e giremez; `/app` ve `/app/settings`
  normal çalışır (kriter 6)
- Ücretsiz kullanıcı 2. müşteriyi eklemeye çalışınca nedenini ve yükseltme
  yolunu görür (kriter 4)
- Bayrak kapalıyken `/app/billing` "bulunamadı"ya düşer

**Step 2 — sır taraması testi.** `import.meta.env` içindeki hiçbir
`VITE_` değişkeninin adı `SECRET|KEY|TOKEN|SERVICE_ROLE` içermemeli —
`SUPABASE_SERVICE_ROLE_KEY`'in bir gün yanlışlıkla `VITE_` önekiyle
tanımlanmasını kalıcı olarak imkânsız kılar (RISK-3).

**Verification:** `npm run test:e2e` yeşil.

---

### Task 9: Doküman senkronu ve kapanış

**Files:**
- Modify: `CLAUDE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`,
  `.planning/STATE.md`
- Modify: `README.md`, `.env.example`
- Create: `docs/billing.md`

**Step 1.** CLAUDE.md: yedinci tablo, Edge Function'lar, `features.billing`,
Faz 4 kararları, sır sınırı tablosu, test sayıları **ölçülerek** güncellenir
(sayıyı tahmin etmeyin — geçmişte 116 yazılıp gerçekte 108 çıktı).

**Step 2.** ROADMAP Phase 4 → `[x]`, altı kriter tek tek işaretlenir,
Progress tablosu güncellenir. PAY-01…06 → `Complete`.

**Step 3.** `docs/billing.md`: alıcı için sağlayıcı değiştirme yordamı —
hangi dosyaya dokunulur, hangi migration silinir, hangi sırlar tanımlanır.

**Step 4.** Sapma günlüğüne satır: *Ödeme | Stripe | LemonSqueezy | Türkiye'den
Stripe açılamıyor; LS merchant of record ve MoR ürünü Stripe'a katlanıyor,
bu yüzden adaptör katmanı zorunlu tutuldu.*

**Verification:** Tam yeşil tur — `npm run lint`, `npx tsc --noEmit`,
`npm test`, `npm run test:rls`, `npm run verify:niche`, `npm run test:e2e`.

---

## Görev bağımlılıkları

```
0 (hesap) ──► 1 (şema) ──► 2 (kapı) ──► 3 (senkron)
                 │            │
                 │            └────────► 4 (istemci ikizi)
                 └──► 5 (webhook) ──► 6 (checkout/portal) ──► 7 (arayüz)
                                                                  │
                                              3,4,7 ──► 8 (E2E) ──► 9 (doküman)
```

**Görev 2 ile 3 arasındaki sıra kritik.** Kapı önce gelir ki Görev 3'ün
çözdüğü tıkanma gerçekten üretilebilsin; tersi sırada senkron düzeltmesi
doğrulanamaz bir varsayım olarak kalır.
