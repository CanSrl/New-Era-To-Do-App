---
gsd_state_version: '1.0'  # placeholder; syncStateFrontmatter overwrites on first state.* call
status: executing
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
# NOT: plan/summary sayaçları 0 çünkü Phase 2 işi gsd plan→execute döngüsü
# DIŞINDA yürütüldü (doğrudan commit'lerle). Gerçek ilerleme için aşağıdaki
# "Current Position" ve ROADMAP.md → Progress tablosuna bak, yüzdeye değil.
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-14)

**Core value:** Aynı kod tabanı hem jenerik starter kit hem gerçek niş ürün
olabilmeli; kanıtı `VITE_NICHE_MODULE=false` ile modülün izsiz çıkması.
**Current focus:** Phase 1 kapandı; sıradaki iş Phase 2'nin açık iki kriteri

## Current Position

Phase: 1 ✅ **tamamlandı** (16 Ağu) · Phase 2 **kısmen tamamlandı** (4/6)
Plan: gsd planı yok; Phase 2 işi
      `docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md`
      görev listesine göre yürütüldü (10 görevin 5'i bitti)
Status: Executing
Last activity: 2026-08-16 — Phase 1 (ürün sağlamlaştırma) tamamlandı

Progress: Phase 1 → [██████████] 6/6 gereksinim · Phase 2 → [███████░░░] 4/6 kriter

**Phase 1, teslim edilen:**

| Gereksinim | Ne yapıldı |
|---|---|
| HARD-01 | `eslint-plugin-jsx-a11y` kuruldu (`recommended`); çıkan 3 `no-autofocus` ihlali düzeltildi. Diyaloglarda odak artık Radix'in `onOpenAutoFocus` kancasıyla veriliyor, `ResetPasswordPage`'de sayfa yükü odağı tamamen kaldırıldı |
| HARD-02 | CSP + `frame-ancestors 'none'` + `nosniff` + `Referrer-Policy` + `Permissions-Policy` + HSTS; `vercel.json` ve `public/_headers` ikizi, `security-headers.test.ts` ayrışmayı engelliyor |
| HARD-03 | Zaten karşılanmıştı (`888e6e5`) |
| HARD-04 | `fetchAllRows` ile sayfalama (`order('id')` + `range`), `MAX_ROWS` tavanı ve `SyncTooLargeError`; dört çekme fonksiyonu da kullanıyor |
| HARD-05 | `SyncOutcome.discarded` sayacı → `SyncProvider` bildirimi; son-yazan-kazanır kuralı değişmedi, yalnızca görünür oldu |
| HARD-06 | Zaten karşılanmıştı (`isValidColor`) |

**Yan olarak düzeltilen (Phase 1 kapsamında değildi):** depo `npm install`
ile kurulamıyordu — `@tailwindcss/vite@4.2.1` ve `vite-plugin-pwa@1.2.0`
vite 8'i peer olarak kabul etmiyordu ve CI bunu `--legacy-peer-deps` ile
gizliyordu. İkisi de yükseltildi, bayrak CI'dan kaldırıldı. Starter kit
alıcısı için bu bir teslim engeliydi (PKG-01).

**Phase 2 başarı kriterleri, doğrulanmış durum:**

| # | Kriter | Durum | Kanıt |
|---|--------|-------|-------|
| 1 | Müşteri/proje CRUD + etkiyi sayıyla söyleyen silme diyaloğu | ✅ | `ClientCard.tsx:201-205`, `tr.json` → `client.deleteConfirmProjects/Tasks` (çoğul + count) |
| 2 | Görev müşteri/projeye bağlanır, müşteri değişince proje sıfırlanır | ✅ | `TaskForm.tsx`, commit `5ef4994` |
| 3 | `/app/delivery` teslim görünümü | ❌ | Rota yok — plan görev 6, henüz yapılmadı |
| 4 | İki cihaz aynı müşteriyi oluşturursa tek kayıt kalır | ✅ | `sync-merge-niche.ts` → `idRemap`, `sync-merge-niche.test.ts` |
| 5 | Başkasının müşterisine bağlı görev DB tarafından reddedilir | ✅ | Bileşik FK + RLS; 50 şema testi |
| 6 | `VITE_NICHE_MODULE=false` sonrası `dist/` içinde iz kalmaz | ❌ | **Karşılanmıyor** — bayrak çalışma zamanı kapısı; CLAUDE.md: "aynı boyutta çıkıyor" |

## Deviations from Roadmap

Aşağıdakiler bilerek ya da fiilen roadmap'ten saptı. Roadmap'i değiştirmeden
önce okunmalı.

1. **Phase sırası bozuldu — ama korkulan bedel çıkmadı.** ROADMAP, Phase 1'in
   Phase 2'den önce bitmesini şart koşuyordu; gerekçe "senkron motoru bir
   sonraki fazda ikiye katlanacak, yeni arayüz o kurallar altında yazılmalı"
   idi. Gerçekte Phase 2'nin tamamı önce gönderildi.
   **Sonuç (16 Ağu, ölçüldü):** `eslint-plugin-jsx-a11y` sonradan kurulduğunda
   bütün kod tabanında yalnızca **3 ihlal** çıktı ve üçü de aynı kuraldı
   (`no-autofocus`). Beklenen toplu düzeltme gerçekleşmedi — çünkü
   erişilebilirlik zaten konvansiyon olarak uygulanıyordu (Radix modaller,
   ikon-only butonlarda `aria-label`, `confirm()` yasağı). Yani roadmap'in
   sıralama gerekçesi bu projede pratikte karşılığını bulmadı; kayıt, gelecekte
   benzer bir sıralama tartışmasında veri olsun diye bırakılıyor.
2. **Phase 1 kriter 4 farkında olmadan karşılandı.** "runSync sırasını bozan
   değişiklik birim testinde düşer" — `888e6e5` (14 Ağu 16:10) `runSync`
   orkestrasyon testlerini ekledi; roadmap 13:34'te yazılmıştı, yani bu commit
   roadmap'ten 2,5 saat sonra geldi ve hiç işaretlenmedi.
3. **DEC-NICHE-01 fiilen karşılanmıyor.** Kilitli karar "bayrak koşulu rota
   kaydı seviyesinde olur" diyordu ve bu uygulandı — ama beklenen sonuç
   (üretim paketinden izsiz çıkma) gerçekleşmiyor: `features.nicheModule` bir
   fonksiyon çağrısı, `import.meta.env.DEV` gibi derleme zamanı sabiti değil,
   dolayısıyla Vite kodu eleyemiyor. Ölçüldü: `VITE_NICHE_MODULE=false`
   derlemesi aynı boyutta. Bu, hem Phase 2 kriter 6'yı hem "modül izsiz çıkar"
   satış argümanını açıkta bırakıyor.
4. **DEC-SYNC-01 (CON-35b) uygulanmadı.** Karar "tek jenerik `mergeNamed`
   çekirdeği, `mergeCategories` ince bir sarmalayıcıya döner" idi.
   Kod tabanında `mergeNamed` diye bir şey yok; `sync-merge-niche.ts`
   `mergeClients`/`mergeProjects`'i ayrı ayrı yazıyor ve `mergeCategories`
   `sync-merge.ts` içinde eskisi gibi duruyor. Yani reddedilen CON-35a
   ("kopyala") varyantı fiilen uygulanmış durumda.

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Kilitli kararlar PROJECT.md → Key Decisions → Locked Decisions altında.
Mevcut işi etkileyenler:

- DEC-SYNC-01 (Phase 2): birleştirmede jenerik `mergeNamed` çekirdeği (CON-35b);
  CON-35a "kopyala" varyantı reddedildi
- DEC-NICHE-01 (Phase 2-3): niş modül `VITE_NICHE_MODULE` ile izsiz çıkmalı;
  bayrak koşulu rota kaydı seviyesinde, render içinde değil
- DEC-PAY-01/02/03 (Phase 4): Stripe yok; kapılama veritabanında; webhook imzası
  doğrulanmadan hiçbir olaya güvenilmez
- DEC-SCOPE-01 (v1): takım / çoklu kiracılık kapsam dışı, göç yolu yalnızca
  dokümante edilir

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 2 kriter 6 açık:** `VITE_NICHE_MODULE=false` modülü paketten
  çıkarmıyor (yukarıda sapma 3). Kapatılması için bayrağın derleme zamanı
  sabitine dönmesi gerekir (`import.meta.env.VITE_NICHE_MODULE === 'false'`
  gibi doğrudan bir karşılaştırma, fonksiyon çağrısı değil) — bu, `features.ts`
  sözleşmesini değiştirir, yani karar niteliğinde
- **Phase 2 kriter 3 açık:** `/app/delivery` teslim görünümü yapılmadı; ayrıca
  `AppLayout` içindeki `NAV_SPLIT` mobil gezinmesi bu üçüncü öğe geldiğinde
  simetrik olacak biçimde yazılmış — yani eksiklik arayüzde de duruyor
- **DEC-SYNC-01 borcu:** `mergeNamed` çekirdeği yazılmadı (yukarıda sapma 4).
  Phase 3'te `time_logs` dördüncü varlık olarak gelecek; üçüncü kopya
  yazılmadan önce karar ya uygulanmalı ya da resmen geri alınmalı
- **Phase 4 girdisi eksik:** ödeme sağlayıcısı (iyzico vs LemonSqueezy/Paddle)
  henüz seçilmedi; `subscriptions` şeması seçime bağlı
- **Phase 3 tasarım açığı:** zaman kayıtlarının biriken senkron semantiği
  tasarlanmadı — mevcut son-yazan-kazanır motoru orada yanlış sonuç verir (CON-33)
- **HARD-02'nin canlı doğrulaması açık:** güvenlik başlıkları `vercel.json` ve
  `public/_headers` içinde tanımlı ve `security-headers.test.ts` ikisini eşit
  tutuyor, ama "yayındaki uygulama `curl -I` ile şu başlıkları döndürür"
  ifadesi ancak gerçek bir dağıtımla doğrulanabilir — o da Phase 5'te.
  Yapılandırma hazır, kanıt eksik
- **`npm audit` 8 açık bildiriyor** (1 düşük, 7 yüksek). Phase 1 gereksinimleri
  arasında değildi, incelenmedi. Ürün "sağlamlaştırma" başlığı altında
  bakılması mantıklı olur
- `.planning/config.json` yok — varsayılanlar kullanıldı (granularity: standard,
  sequential phase id)
- **Gözlem (bloklayıcı değil):** `src/lib/sync-merge-niche.ts` proje anahtarı
  ayırıcısı olarak ham NUL baytı kullanıyor (`${clientId}\0${categoryKey(name)}`).
  Çarpışma güvenliği açısından doğru bir seçim, ama git ve grep dosyayı ikili
  sayıyor — `git diff` bu dosya için "Binary files differ" diyor, yani kod
  incelemesi kör kalıyor. U+001F (unit separator) aynı güvenceyi verip
  dosyayı metin bırakır

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-16 (`.planning/` senkronlandı, ardından Phase 1 bitirildi)
Stopped at: Phase 1'in altı gereksinimi de karşılandı. Sırada Phase 2'nin açık
  iki kriteri var: `/app/delivery` teslim görünümü (kriter 3) ve
  `VITE_NICHE_MODULE=false` derlemesinin modülü gerçekten çıkarması (kriter 6)
Resume file: None

**Sonraki adım için not:** Bu senkron `git log` ve kod okunarak elle yapıldı,
gsd plan→execute döngüsüyle değil. Kalan Phase 2 işini gsd artefaktlarıyla
sürdürmek istenirse `/gsd-plan-phase 2` çağrılmalı ve plan, halihazırda
bitmiş 5 görevi tekrar üretmemeli — kaynak
`docs/superpowers/plans/2026-08-14-nis-modul-musteri-proje.md` (görev 6-10).
