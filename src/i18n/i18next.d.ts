import 'i18next';
import type tr from './locales/tr.json';

/**
 * Çeviri anahtarlarını tipe bağlar.
 *
 * Bunsuz `t('yanlis.anahtar')` sessizce anahtarın kendisini ekrana basardı.
 * Türkçe dosya referans alınır; İngilizce dosyanın aynı şekli taşıdığını
 * `src/i18n/i18n.test.ts` doğrular (tip sistemi iki JSON'u karşılaştıramaz).
 */
declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'translation';
        resources: {
            translation: typeof tr;
        };
    }
}
