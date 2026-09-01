# Ödeme ve Pro kapılama — tasarım kararları

> Faz 4 (`.planning/ROADMAP.md` numaralandırması). Gereksinimler:
> PAY-01 … PAY-06. Uygulama planı:
> `docs/superpowers/plans/2026-09-01-odeme-pro-kapilama.md`.

**Hedef:** Ürün para kazanabilir hâle gelir ve Pro sınırı arayüzden değil
veritabanından uygulanır.

---

## 1. Sağlayıcı: LemonSqueezy (DEC-PAY-01 kapanışı)

Stripe kullanılamıyor (kullanıcı Türkiye'de, hesap açamıyor). Seçim
**LemonSqueezy**: merchant of record, yani KDV/vergi beyanı sağlayıcıda,
Türkiye'den kayıt olunabiliyor, `subscriptions` şeması basit kalıyor.
Karşılığında komisyon iyzico'dan yüksek ve fiyatlandırma USD.

**Bilinen risk — sağlayıcı bağımsız kalmayabilir.** LemonSqueezy Temmuz
2024'te **Stripe tarafından satın alındı**. Eylül 2026 itibarıyla LS hâlâ
bağımsız çalışıyor, yeni kayıt alıyor ve MoR olmaya devam ediyor; ilan
edilmiş bir kapanış tarihi yok. Ancak teknolojisi Stripe'ın kendi MoR ürünü
**Stripe Managed Payments**'a katlanıyor ve LS, Ocak 2026'da mevcut
kullanıcılar için göç yolu hazırladığını duyurdu. Bu, seçimin gerekçesini
ileride geçersiz kılabilir: LS'yi seçme sebebi Stripe hesabı açamamaktı.

Sonuç → **DEC-PAY-11 (sağlayıcı adaptörü)**. Sağlayıcıya özgü her şey tek bir
dosyada toplanır. İki ayrı gerekçeyle: (a) starter kit alıcısı büyük ihtimalle
Stripe kullanacak, (b) bu depo da bir gün SMP'ye geçmek zorunda kalabilir.

**Doğrulanmadı, ilk iş bu:** LS'nin satıcı olarak Türkiye'yi desteklediği
resmî listeden teyit edilemedi (docs sayfası 403 döndü). Mağaza aktivasyonu
denenmeden hiçbir kod yazılmaz — bkz. plan, Görev 0.

---

## 2. Ücretsiz plan sınırı: 1 müşteri (DEC-PAY-04)

Ücretsiz kullanıcı **en fazla 1 müşteri** oluşturabilir; Pro sınırsız.

- Sınır niş modülün merkezindeki varlığa konur, jenerik çekirdeğe değil.
  Görev sayısını kısıtlamak `tasks` tablosunu — senkronun en sıcak yolunu —
  her yazmada `count(*)` ödemeye zorlardı.
- **Arşivli müşteri de sayılır.** Sayım yalnızca aktifleri saysaydı
  "arşivle → yeni ekle → arşivden çıkar" sınırı bedavaya aşardı.
- **Kapı yalnızca `INSERT`'e uygulanır, `UPDATE`'e değil.** Kapı devreye
  girdiğinde zaten 5 müşterisi olan kullanıcı onları düzenlemeye ve
  senkronlamaya devam edebilmeli. `UPDATE`'e de `WITH CHECK` koymak, mevcut
  kullanıcıların verisini geriye dönük olarak salt okunur yapardı — ve daha
  kötüsü, senkron turunu DEC-PAY-06'daki tuzağa sokardı.

---

## 3. Mimari

```
tarayıcı                     Supabase Edge Functions           LemonSqueezy
────────                     ───────────────────────           ────────────
BillingPage
  "Yükselt"  ──────────────► billing-checkout  ──────────────► POST /v1/checkouts
                             (JWT doğrular,                      custom.user_id
                              LS API anahtarı burada)            = JWT'deki id
             ◄────────────── checkout url  ◄──────────────────
  ödeme sayfası ─────────────────────────────────────────────► ödeme
                             lemonsqueezy-webhook ◄──────────── subscription_*
                             (X-Signature doğrular,
                              service role ile yazar)
                                    │
                                    ▼
                             subscriptions tablosu
                                    │
                                    ▼  is_pro(auth.uid())
                             clients INSERT politikası
  "Aboneliği yönet" ───────► billing-portal ──────────────────► GET /v1/subscriptions/:id
             ◄────────────── customer_portal url (24 saat)
```

Üç Edge Function, çünkü üçü de **istemcide bulunamayacak bir sırra** ihtiyaç
duyar (LS API anahtarı, webhook imzalama sırrı, service role anahtarı).
`supabase/functions/` bu depoda ilk kez oluşuyor.

---

## 4. Kilitli kararlar

### DEC-PAY-05 — Kapı iki katmanlıdır ve katmanların işi farklıdır

- **Veritabanı (`WITH CHECK`) asıl kapıdır.** Arayüzü atlayıp doğrudan
  PostgREST'e giden istek de reddedilir. Başarı kriteri 3 tam olarak budur.
- **İstemcideki ikiz kapı savunma değil, senkron korumasıdır.** Store,
  şemanın reddedeceği müşteriyi hiç oluşturmaz. CLAUDE.md'nin mevcut kuralı:
  *"Şemanın reddedeceği kayıt push kuyruğuna hiç girmemeli."* İkiz olmasaydı
  her ücretsiz kullanıcı DEC-PAY-06'daki tuzağa düşerdi.

İki kural iki yerde yaşadığı için ayrışabilirler; `rls.test.mjs` veritabanı
tarafını, birim testi istemci tarafını, E2E ikisinin aynı şeyi söylediğini
doğrular.

### DEC-PAY-06 — Senkron kalıcı reddi atlatabilmeli

Bu fazın en riskli parçası ve **sınırın şeklinden bağımsız** olarak var.

Uygulama local-first: kullanıcı çevrimdışıyken, girişsizken 5 müşteri
oluşturabilir. Sonra giriş yapar. Push reddedilir (`42501`). Bugünkü
`runSync` bunu genel bir hataya çevirir, satır `dirtyIds` içinde kalır ve
**her turda aynı yerde tıkanır** — görevler dahil bütün senkron durur.

Üstelik `pushRemoteClients` **toplu `upsert`**: tek satır reddedilince grup
komple düşer ve PostgREST hangi satırın suçlu olduğunu söylemez.

Gereken davranış:

1. Hatalar **geçici** (ağ, 5xx → tekrar denenir) ve **kalıcı**
   (`42501` RLS, `23514` check → asla kabul edilmeyecek) diye ayrılır.
2. Kalıcı hata alan grup **satır satır** yeniden denenerek suçlu izole edilir.
3. Suçlu satır `dirtyIds`'ten çıkarılır (sonsuz tekrar biter), **yerelde
   silinmez**, `blocked` olarak işaretlenir.
4. Turun geri kalanı normal tamamlanır.
5. Kullanıcı ekranda nedenini görür ve yükseltme yolunu bulur.

Desen yeni değil: Faz 1'de `SyncOutcome.discarded` → `SyncProvider` bildirimi
aynı problemin (sessiz veri kaybı) çözümüydü. `blocked` onun kardeşi.

### DEC-PAY-07 — `custom.user_id` yalnızca sunucudan gelir

Checkout'u `billing-checkout` fonksiyonu oluşturur ve `checkout_data.custom`
içine **doğrulanmış JWT'den okuduğu** kullanıcı id'sini yazar. İstemci bu
alanı gönderemez; gönderebilseydi herkes başkasının hesabına abonelik
iliştirebilirdi.

### DEC-PAY-08 — Sonraki olaylarda eşleme abonelik id'si üzerinden

`custom_data.user_id` yalnızca **ilk** olayda (`subscription_created`)
kullanıcıyı bulmak için okunur. Sonraki bütün olaylar
`provider_subscription_id` ile eşlenir. Aksi halde `custom_data` taşıyan sahte
bir olay, imza doğrulaması geçse bile aboneliği başka hesaba taşıyabilirdi.

**Tekrarlanabilirlik (idempotency):** LS webhook'ları tekrar gönderir ve sıra
garantisi yoktur. Olayın kendi id'sine güvenmek yerine, gelen
`data.attributes.updated_at` saklanandan **eski ya da eşitse olay yok
sayılır**. Bu, senkron motorunun zaten kullandığı "yenisi kazanır" kuralının
aynısı — tek bir çakışma doktrini taşımak, iki tane taşımaktan iyidir.

### DEC-PAY-09 — `subscriptions` kullanıcıya salt okunur

`authenticated` rolüne yalnızca `SELECT` GRANT'i verilir; `INSERT`/`UPDATE`
hiç verilmez. Yazan tek şey webhook fonksiyonudur (service role, RLS'i
atlar). Kullanıcı kendi abonelik satırını yazabilseydi Pro'ya tek istekle
kendini yükseltirdi — kapıyı veritabanına taşımanın anlamı kalmazdı.

⚠️ CLAUDE.md kuralı burada da geçerli: **GRANT verilmezse RLS politikaları
hiç değerlendirilmez.** `SELECT` GRANT'i unutulursa kullanıcı kendi planını
göremez ve arayüz herkesi ücretsiz sanır.

### DEC-PAY-10 — `test_mode` olayları üretimde Pro vermez

LS payload'ı `test_mode: true/false` taşır. Fonksiyon, ortamının beklediği
modla eşleşmeyen olayı yazmadan reddeder. Bu olmadan, üretim webhook adresini
bilen biri LS test mağazasından bedava Pro üretebilirdi.

### DEC-PAY-11 — Sağlayıcı adaptörü

Sağlayıcıya özgü her şey (imza doğrulama, olay adları, durum eşlemesi,
checkout ve portal çağrıları) `supabase/functions/_shared/billing/`
altında bir arayüz ve tek bir `lemonsqueezy.ts` implementasyonunda toplanır.
Fonksiyonların kendisi sağlayıcı adını bilmez.

İstemci tarafında `src/lib/billing.ts` **saf** katmandır: LS durum metnini
(`active`, `on_trial`, `past_due`, `cancelled`, `expired`, `paused`,
`unpaid`) uygulamanın `PlanStatus`'una çevirir ve **çeviri anahtarı**
döndürür, hazır metin değil.

**Pro sayılan durumlar:** `active`, `on_trial`. `cancelled` **Pro'dur** —
LS'de "cancelled" *iptal edildi ama dönem sonuna kadar geçerli* demektir,
erişim `ends_at`'te biter ve o an `expired` olayı gelir. `cancelled`'ı
anında kesmek, parasını ödemiş kullanıcıyı erken kapı dışı bırakırdı.
`past_due` ve `unpaid` Pro değildir ama arayüzde "ödeme başarısız, kartını
güncelle" olarak ayrı gösterilir — sessizce ücretsize düşürmek kullanıcıya
neyin bozulduğunu söylemez.

### DEC-PAY-12 — `VITE_BILLING` bayrağı, varsayılan KAPALI

Bayrak `features` nesnesinin içindedir (bir **davranış** anahtarı, paketleme
anahtarı değil — `NICHE_MODULE` gibi paketten elenmesi gerekmiyor).

Varsayılan **kapalı**, `githubAuth` ile aynı gerekçe: LS kimlik bilgileri
yapılandırılmadan "Yükselt" butonu göstermek kullanıcıyı hataya yollar.

⚠️ **Bayrak ile kapı ayrı yaşar ve bu bir tuzaktır.** Bayrak arayüzü kapatır;
`WITH CHECK` politikası migration'da durur ve bayraktan habersizdir. Kapı
migration'ı **ayrı bir dosyada** tutulur (`..._billing_gate.sql`), böylece
faturalama istemeyen alıcı onu siler. Silinmezse ücretsiz kullanıcı sınıra
takılır ama yükselme yolu göremez.

---

## 5. Şema

```sql
subscriptions
  user_id                  uuid primary key → auth.users on delete cascade
  provider                 text not null default 'lemonsqueezy'
  provider_subscription_id text not null unique
  provider_customer_id     text
  status                   text not null            -- sağlayıcının kendi metni
  variant_id               text
  renews_at                timestamptz
  ends_at                  timestamptz
  trial_ends_at            timestamptz
  test_mode                boolean not null default false
  created_at, updated_at   timestamptz not null
```

`user_id` birincil anahtar: bir hesabın **tek** aboneliği olur. İkinci bir
abonelik satın alınırsa aynı satır üzerine yazılır.

Durum metni sağlayıcıdan geldiği gibi saklanır, uygulamanın enum'una
çevrilmez — sağlayıcı yeni bir durum eklerse veri kaybı olmasın diye.
Çeviri `is_pro` fonksiyonunda ve `src/lib/billing.ts`'te yapılır.

```sql
public.is_pro(uid uuid) returns boolean
  -- stable, search_path sabitlenmiş
  -- true: status in ('active', 'on_trial', 'cancelled')
  --       ve (ends_at is null or ends_at > now())
```

Müşteri kapısı:

```sql
-- clients tablosundaki mevcut INSERT politikası bununla değiştirilir
with check (
    user_id = auth.uid()
    and (public.is_pro(auth.uid()) or public.client_count(auth.uid()) < 1)
)
```

`client_count` ayrı bir `security definer` fonksiyondur. Sayımı doğrudan alt
sorgu olarak yazmak, `clients` tablosunun politikası içinde yine `clients`
okumak demek olurdu; `security definer` bu iç içe geçmeyi ortadan kaldırır ve
sayımın RLS tarafından filtrelenmediğini garanti eder.

⚠️ **Bilinen kabul:** eşzamanlı iki `INSERT` ikisi de `count = 0` görüp
geçebilir, yani sınır bir satır aşılabilir. Kilit almak (advisory lock) bu
ölçekte maliyetine değmez; bir müşterilik taşma ne veri bütünlüğünü bozar ne
gelir kaybettirir.

---

## 6. Oturum koruması (PAY-06)

`/app` **korumasız kalır** — uygulama local-first, giriş isteğe bağlı.
Koruma yalnızca `/app/billing` rotasını sarar (`RequireAuth`).

⚠️ Bileşen "oturum yükleniyor" durumunu ayrı ele almalı: `session === null`
ile "henüz bilinmiyor" ayrılmazsa, sayfa her açılışta bir kare giriş
istemi gösterip sonra içeriğe atlar.

---

## 7. Güvenlik sınırı — ne nerede yaşar

| Sır | Yer | Asla |
| --- | --- | --- |
| `LEMONSQUEEZY_API_KEY` | Edge Function secrets | `VITE_` öneki, istemci paketi |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Edge Function secrets | aynı |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function secrets | aynı — **DEC-PAY-03** |
| `LEMONSQUEEZY_STORE_ID`, `VARIANT_ID` | Edge Function env | (sır değil, yine de sunucuda) |

`lemonsqueezy-webhook` fonksiyonu `verify_jwt = false` ile çalışmak
**zorundadır** — LS bir Supabase JWT'si gönderemez. Bu, uç noktayı herkese
açık yapar; tek savunması imza doğrulamasıdır. Doğrulama gövdenin **ham
metni** üzerinde yapılır: `JSON.parse` edip yeniden `stringify` etmek baytları
değiştirir ve imza hiçbir zaman tutmaz.

Karşılaştırma `timingSafeEqual` ile yapılır; `===` ile karşılaştırmak
zamanlama sızıntısına açık bırakır.

---

## 8. Kapsam dışı

- **Yıllık plan, kupon, deneme süresi uzatma** — LS panelinden yapılandırılır,
  kod tarafında iş yok.
- **Fatura geçmişi ekranı** — LS müşteri portalı zaten sunuyor, kopyalamıyoruz.
- **TL fiyatlandırma** — LS MoR olarak USD üzerinden çalışıyor.
- **Takım/çoklu kiracılık planı** — v1 kapsamında yok (RISK-7).
- **Stripe Managed Payments'a göç** — DEC-PAY-11 yolu açık bırakıyor,
  bu fazda yapılmıyor.
