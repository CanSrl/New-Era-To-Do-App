# Yapılacaklar Listesi

Modern, hızlı ve PWA destekli bir Görev Yöneticisi uygulaması. React, TypeScript, Vite, Tailwind CSS v4 ve Zustand kullanılarak geliştirilmiştir.

## Özellikler
- 🚀 **Modern UI:** Tailwind CSS ile tasarlanmış, glassmorphism estetiği.
- 🌙 **Karanlık Mod:** Sistem tercihine uygun otomatik veya manuel Light/Dark mod.
- 📱 **PWA ve Mobil Uyumlu:** Masaüstünde kenar çubuğu, mobilde alt gezinme menüsü.
- 💾 **Çevrimdışı Çalışma:** Zustand persist ile LocalStorage'a kaydetme.
- ↕️ **Sürükle & Bırak:** dnd-kit ile görevlerinizi kolayca sıralayın.
- 🎉 **Confetti:** Tüm görevler bittiğinde kutlama efekti!
- 📤 **Dışa/İçe Aktar:** Görevlerinizi JSON olarak yedekleyin.
- ⌨️ **Klavye Kısayolları:** Hızlıca "n" veya "Esc" tuşlarıyla kullanım.

## Kurulum ve Çalıştırma

Gereksinimler: \`Node.js v18+\`

1. Bağımlılıkları yükleyin:
   \`\`\`bash
   npm install --legacy-peer-deps
   \`\`\`

2. Geliştirme sunucusunu başlatın:
   \`\`\`bash
   npm run dev
   \`\`\`
   Tarayıcınızda \`http://localhost:5173\` adresini açın.

## Yayına Alma (Deployment)

Projeyi Vercel, Netlify veya GitHub Pages üzerinde ücretsiz yayınlayabilirsiniz.

1. Üretim versiyonunu derleyin:
   \`\`\`bash
   npm run build
   \`\`\`
2. Oluşan \`dist\` klasörünü istediğiniz bir statik barındırma servisine yükleyin.

Eğer Firebase veya Supabase entegrasyonu eklemek isterseniz, \`src/store/index.ts\` içindeki \`persist\` middleware yapısını ilgili API çağrılarıyla değiştirebilirsiniz.
