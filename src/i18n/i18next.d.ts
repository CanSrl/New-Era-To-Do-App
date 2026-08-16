import 'i18next';
import type tr from './locales/tr.json';
import type trNiche from './locales/tr.niche.json';

/**
 * Çeviri anahtarlarını tipe bağlar.
 *
 * Bunsuz `t('yanlis.anahtar')` sessizce anahtarın kendisini ekrana basardı.
 * Türkçe dosya referans alınır; İngilizce dosyanın aynı şekli taşıdığını
 * `src/i18n/i18n.test.ts` doğrular (tip sistemi iki JSON'u karşılaştıramaz).
 *
 * Niş anahtarlar tipe **her zaman** dahildir, oysa çalışma zamanında yalnızca
 * `NICHE_MODULE` açıkken yükleniyorlar. Bu bilinçli: niş bileşenler
 * `t('client.deleteConfirmTitle')` yazabilmeli ve bayrak kapalıyken o kod
 * zaten paketten eleniyor. Tipi koşullu yapmak, bayrak kapalı derlemede
 * niş kaynak dosyalarını derlenemez hale getirirdi.
 */
declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'translation';
        resources: {
            translation: typeof tr & typeof trNiche;
        };
    }
}
