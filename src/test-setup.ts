import i18n from './i18n';

/**
 * Birim testlerinde dili sabitler.
 *
 * Dil algılayıcı jsdom'un `navigator.language` değerini (en-US) okuyup
 * İngilizce'ye geçiyor; bu da tohumlanan kategori adları gibi dile bağlı
 * çıktıları testten teste oynak hale getirirdi. Türkçe seçiliyor çünkü
 * uygulamanın yedek dili o.
 *
 * Diller arası farklar ayrıca `src/i18n/i18n.test.ts` içinde sınanır.
 */
await i18n.changeLanguage('tr');
