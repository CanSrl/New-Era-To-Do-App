# Yapılacaklar Listesi

[![CI](https://github.com/CanSrl/New-Era-To-Do-App/actions/workflows/ci.yml/badge.svg)](https://github.com/CanSrl/New-Era-To-Do-App/actions/workflows/ci.yml)

Modern, hızlı ve PWA destekli bir görev yöneticisi. React, TypeScript, Vite,
Tailwind CSS v4, Zustand ve Supabase ile geliştirilmiştir.

Uygulama **local-first** çalışır: Supabase yapılandırılmadan da her özellik
tam olarak çalışır, veriler tarayıcıda saklanır. Giriş yapmak isteğe bağlıdır
ve verileri cihazlar arasında eşitlemeyi mümkün kılar.

## Özellikler

- 🚀 **Modern UI:** Tailwind CSS ile tasarlanmış, glassmorphism estetiği.
- 🌍 **İki Dil:** Türkçe ve İngilizce. Tarayıcı diline göre açılır, ayarlardan
  değiştirilebilir.
- 🌙 **Karanlık Mod:** Sistem tercihine uygun otomatik veya manuel Light/Dark mod.
- 📱 **PWA ve Mobil Uyumlu:** Masaüstünde kenar çubuğu, mobilde alt gezinme menüsü.
- 💾 **Çevrimdışı Çalışma:** Zustand persist ile LocalStorage'a kaydetme.
- 🏷️ **Kendi Kategorileriniz:** Ad ve renk verip istediğiniz kadar kategori
  tanımlayın. Bir kategoriyi silmek görevlerini silmez.
- 🔐 **İsteğe Bağlı Hesap:** E-posta/parola veya GitHub ile giriş (Supabase Auth).
- ☁️ **Cihazlar Arası Eşitleme:** Giriş yapınca görevler buluta eşitlenir;
  çevrimdışıyken yapılan değişiklikler bağlantı gelince gönderilir.
- ↕️ **Sürükle & Bırak:** dnd-kit ile görevlerinizi kolayca sıralayın.
- 🎉 **Confetti:** Tüm görevler bittiğinde kutlama efekti!
- 📤 **Dışa/İçe Aktar:** Görevlerinizi JSON olarak yedekleyin.
- ⌨️ **Klavye Kısayolları:** Hızlıca "n" veya "Esc" tuşlarıyla kullanım.

## Kurulum ve Çalıştırma

Gereksinimler: Node.js v18+

1. Bağımlılıkları yükleyin:

   ```bash
   npm install --legacy-peer-deps
   ```

2. Geliştirme sunucusunu başlatın:

   ```bash
   npm run dev
   ```

   Tarayıcınızda `http://localhost:5173` adresini açın.

Bu haliyle uygulama yerel modda çalışır. Hesap ve senkronizasyon özellikleri
için aşağıdaki Supabase adımlarını izleyin.

## Supabase Kurulumu

Ortam değişkenleri `.env.local` dosyasından okunur; şablon için `.env.example`
dosyasına bakın. Değişkenler tanımlı değilse giriş arayüzü hiç görünmez ve
uygulama yerel modda çalışmaya devam eder.

### Seçenek A — Yerel geliştirme (Docker gerekir)

```bash
npx supabase start
```

Komutun çıktısındaki `API URL` ve `anon key` değerlerini `.env.local` içine
yazın. Migration'lar otomatik uygulanır.

Şemayı değiştirdikten sonra veritabanını sıfırlamak için:

```bash
npx supabase db reset
```

> `db reset` sonrası API 502 dönerse, ağ geçidi eski konteyner adresini
> önbellekte tutuyor demektir: `docker restart supabase_kong_yapilacaklar-listesi`

### Seçenek B — Bulut projesi

1. [supabase.com](https://supabase.com) üzerinde yeni bir proje oluşturun.
2. **Project Settings → API** bölümünden `Project URL` ve `anon public` anahtarını
   kopyalayıp `.env.local` dosyasına yazın.
3. Şemayı uygulayın — ya CLI ile:

   ```bash
   npx supabase link --project-ref <proje-ref>
   npx supabase db push
   ```

   ya da `supabase/migrations/` altındaki SQL dosyasının içeriğini panoya alıp
   **SQL Editor** üzerinden çalıştırın.
4. **Authentication → URL Configuration** altında `Site URL` değerini
   uygulamanızın adresi olarak ayarlayın.

> Bulut projelerinde e-posta doğrulaması varsayılan olarak açıktır: kayıt olan
> kullanıcı, gelen kutusundaki bağlantıya tıklayana kadar oturum açmaz.
> Uygulama bu durumu algılayıp "E-postanı kontrol et" ekranını gösterir.

## GitHub ile Giriş

Varsayılan olarak **kapalıdır**. Açmak için hem sunucu hem istemci tarafını
yapılandırmak gerekir; yalnızca birini açmak işe yaramaz:

| Taraf | Ayar | Kapalıyken ne olur |
| --- | --- | --- |
| Sunucu | Supabase'de GitHub sağlayıcısı | Buton kullanıcıyı ham bir JSON hata sayfasına düşürür |
| İstemci | `VITE_AUTH_GITHUB=true` | Buton hiç görünmez (güvenli varsayılan) |

**1. GitHub OAuth App oluşturun** —
[Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
→ *New OAuth App*. Authorization callback URL:

- Yerel: `http://127.0.0.1:54321/auth/v1/callback`
- Bulut: `https://<proje-ref>.supabase.co/auth/v1/callback`

**2. Supabase tarafını açın.**

Yerelde `supabase/config.toml` içinde `[auth.external.github]` altındaki
`enabled = true` yapın ve kimlik bilgilerini **ortam değişkeni olarak** verin
(git'e yazmayın), sonra yığını yeniden başlatın:

```bash
export SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=...
export SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=...
npx supabase stop && npx supabase start
```

Bulut projesinde bunun karşılığı **Authentication → Sign In / Providers →
GitHub** ekranıdır.

**3. İstemci tarafını açın** — `.env.local` içine `VITE_AUTH_GITHUB=true`.

**4. Yönlendirme adresini izin listesine ekleyin.** Supabase, listede *tam
eşleşme* bulamadığı adresi hata vermeden `site_url`'e düşürür. Yerelde
`config.toml` içindeki `additional_redirect_urls` bunu kapsar; bulut
projesinde **Authentication → URL Configuration** altına
`https://<alan-adiniz>/auth/callback` eklenmelidir.

> Aynı e-posta hem parolayla hem GitHub'la kullanılıyorsa Supabase varsayılan
> olarak kimlikleri tek hesapta birleştirir. İki ayrı hesap istiyorsanız
> Supabase tarafındaki hesap birleştirme ayarını değiştirin.

## Hata İzleme (opsiyonel)

Varsayılan olarak **kapalıdır**. `VITE_SENTRY_DSN` tanımlı değilse:

- hiçbir ağ isteği yapılmaz,
- Sentry paketi tarayıcıya **indirilmez bile** (ayrı bir parçaya bölünür ve
  service worker precache'inin dışında tutulur),
- hata sınırı yine çalışır; hatalar konsola düşer.

Açmak için `.env.local` içine Sentry projenizin DSN'ini yazın:

```
VITE_SENTRY_DSN=https://<anahtar>@<org>.ingest.sentry.io/<proje>
```

Değeri Sentry'de **Project Settings → Client Keys (DSN)** altında bulursunuz.

Gönderilenler bilinçli olarak dardır: `sendDefaultPii` kapalı, kullanıcı
nesnesi ve çerezler `beforeSend` içinde ayrıca temizlenir, performans izleme
ve oturum tekrarı kapalıdır. Kullanıcı kimliği göndermek isterseniz
`src/lib/monitoring.ts` içindeki `scrub` fonksiyonunu düzenleyin.

Sağlayıcıyı değiştirmek isterseniz tek dosya yeter: uygulama kodu Sentry'yi
doğrudan import etmez, yalnızca `initMonitoring` ve `captureError` kullanır.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm run preview` | Derlenmiş sürümü yerelde önizleme |
| `npm run lint` | ESLint denetimi |
| `npm test` | Birim testleri (Vitest) |
| `npm run test:e2e` | Uçtan uca testler (Playwright) |
| `npm run test:rls` | Şema güvenlik testleri (yerel Supabase gerekir) |
| `npm run db:types` | Veritabanı tiplerini yeniden üret |

## Eşitleme nasıl çalışır

Cihazdaki veri birincil kaynaktır. Uygulama çevrimdışıyken de tam olarak
çalışır; eşitleme bunun üzerine eklenen bir katmandır.

- **Değişiklik takibi:** Her yazma işlemi görevi "gönderilmeyi bekliyor"
  olarak işaretler, her silme bir mezar taşı bırakır. Bunlar LocalStorage'da
  saklandığı için tarayıcı kapatılsa bile kaybolmaz.
- **Ne zaman eşitlenir:** Girişte, bir değişiklikten 1,5 sn sonra (toplu
  göndermek için), sekmeye geri dönüldüğünde, bağlantı geri geldiğinde ve
  uygulama açıkken dakikada bir.
- **Çakışma:** `updatedAt` damgası yeni olan kazanır. Eşitlikte bulut kazanır,
  böylece bütün cihazlar aynı sonuca varır.
- **Silme:** Bulut tam anlık görüntü olarak çekilir. Cihazda duran ama bulutta
  olmayan ve gönderilmeyi beklemeyen bir görev, başka cihazda silinmiş
  demektir ve cihazdan da kaldırılır.
- **Hesap değişimi:** Cihazdaki verinin hangi hesaba ait olduğu tutulur.
  Misafirken eklenen görevler ilk girişte hesaba aktarılır; farklı bir hesap
  giriş yaparsa cihaz temizlenip o hesabın verisi çekilir.

Birleştirme kararı ağ çağrısı içermeyen saf bir fonksiyondadır
(`src/lib/sync-merge.ts`), bu yüzden tüm senaryolar birim testiyle kapsanır.

> Ölçek notu: her turda bulutun tamamı çekilir. Birkaç bin göreve kadar
> sorunsuz; ötesi için artımlı çekme ve sunucu tarafında mezar taşı tablosu
> gerekir.

## Testler

Üç katman var; her biri farklı bir soruyu yanıtlar.

**Birim testleri — `npm test`**
Store mantığı ve saf yardımcı fonksiyonlar (`src/**/*.test.ts`). Görev
ekleme/silme/sıralama, içe aktarmada bozuk veri savunması, tarih
dönüşümleri ve LocalStorage şema göçü burada doğrulanır. Saniyeler sürer;
geliştirirken `npm run test:watch` ile açık tutulabilir.

**Uçtan uca testler — `npm run test:e2e`**
Gerçek tarayıcıda gerçek kullanıcı akışları (`e2e/`). Dev sunucusunu
Playwright kendi başlatır. Giriş akışı testleri yalnızca Supabase
yapılandırılmışsa çalışır, aksi halde kendilerini atlar.

**Şema güvenlik testleri — `npm run test:rls`**
Yerel veritabanına karşı iki ayrı kullanıcı oluşturur ve Row Level Security
politikalarının gerçekten uygulandığını doğrular: bir kullanıcının diğerinin
görevlerini okuyamadığını, güncelleyemediğini ve silemediğini; oturumsuz
erişimin hiç veri döndürmediğini; tetikleyicilerin ve kısıtların beklendiği
gibi davrandığını kontrol eder. Şemaya dokunduğunuzda bu testi çalıştırın.

## Sürekli entegrasyon (CI)

Her push ve pull request'te `.github/workflows/ci.yml` çalışır. İki iş paralel
ilerler:

| İş | İçerik | Süre |
| --- | --- | --- |
| Lint, tip ve birim testleri | ESLint, `tsc`, Vitest, üretim derlemesi | ~1 dk |
| Şema ve uçtan uca testler | Supabase yığını, RLS testleri, Playwright | ~4 dk |

İkinci iş, koşucuda gerçek bir Supabase yığını başlatır. Yalnızca testlerin
ihtiyaç duyduğu servisler açılır (veritabanı, ağ geçidi, auth, REST); studio,
storage, realtime gibi servisler dışarıda bırakılarak açılış süresi kısaltılır.

E2E testleri başarısız olursa Playwright raporu çalıştırma sayfasında artefakt
olarak 7 gün saklanır — hatayı yerelde tekrar üretmeye çalışmadan inceleyebilirsiniz.

## Yayına Alma (Deployment)

Projeyi Vercel, Netlify veya benzeri bir statik barındırma servisinde
yayınlayabilirsiniz.

1. Üretim versiyonunu derleyin:

   ```bash
   npm run build
   ```

2. Oluşan `dist` klasörünü barındırma servisine yükleyin.

Barındırma servisinde `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` ortam
değişkenlerini tanımlamayı unutmayın; bunlar derleme sırasında pakete gömülür.
`anon` anahtarı istemciye açık olacak şekilde tasarlanmıştır ve RLS ile
korunur — ancak `service_role` anahtarı **hiçbir zaman** istemci koduna
konulmamalıdır.
