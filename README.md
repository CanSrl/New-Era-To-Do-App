# Yapılacaklar Listesi

Modern, hızlı ve PWA destekli bir görev yöneticisi. React, TypeScript, Vite,
Tailwind CSS v4, Zustand ve Supabase ile geliştirilmiştir.

Uygulama **local-first** çalışır: Supabase yapılandırılmadan da her özellik
tam olarak çalışır, veriler tarayıcıda saklanır. Giriş yapmak isteğe bağlıdır
ve verileri cihazlar arasında eşitlemeyi mümkün kılar.

## Özellikler

- 🚀 **Modern UI:** Tailwind CSS ile tasarlanmış, glassmorphism estetiği.
- 🌙 **Karanlık Mod:** Sistem tercihine uygun otomatik veya manuel Light/Dark mod.
- 📱 **PWA ve Mobil Uyumlu:** Masaüstünde kenar çubuğu, mobilde alt gezinme menüsü.
- 💾 **Çevrimdışı Çalışma:** Zustand persist ile LocalStorage'a kaydetme.
- 🔐 **İsteğe Bağlı Hesap:** E-posta ve parola ile giriş (Supabase Auth).
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

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Üretim derlemesi |
| `npm run preview` | Derlenmiş sürümü yerelde önizleme |
| `npm run lint` | ESLint denetimi |
| `npm run test:rls` | Şema güvenlik testleri (yerel Supabase gerekir) |
| `npm run db:types` | Veritabanı tiplerini yeniden üret |

### Şema güvenlik testleri

`npm run test:rls`, yerel veritabanına karşı iki ayrı kullanıcı oluşturur ve
Row Level Security politikalarının gerçekten uygulandığını doğrular: bir
kullanıcının diğerinin görevlerini okuyamadığını, güncelleyemediğini ve
silemediğini; oturumsuz erişimin hiç veri döndürmediğini; tetikleyicilerin ve
kısıtların beklendiği gibi davrandığını kontrol eder. Şemaya dokunduğunuzda
bu testi çalıştırın.

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
