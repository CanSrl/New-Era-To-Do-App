import i18n from 'i18next';
import type { ParseKeys } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { enUS, tr as trDate } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import tr from './locales/tr.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['tr', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Geçerli bir çeviri anahtarı.
 *
 * Kullanıcıya metin döndürmek yerine anahtar döndüren katmanlar (auth, senkron)
 * bu tipi kullanır; böylece `t()`'ye ulaşana kadar anahtarın gerçekten var
 * olduğu derleme zamanında garanti edilir. Düz `string` kullanılsaydı yazım
 * hatası ancak ekranda ham anahtar görünce fark edilirdi.
 */
export type TranslationKey = ParseKeys<'translation'>;

/** Dil tercihinin saklandığı anahtar; tema ve store ile aynı ön eki taşır. */
export const LANGUAGE_STORAGE_KEY = 'yapilacaklar-language';

export const resources = {
    tr: { translation: tr },
    en: { translation: en },
} as const;

/**
 * Tarih biçimlendirmesi i18next'ten ayrı yürür: date-fns kendi locale
 * nesnelerini ister. İkisinin ayrışmaması için eşleme burada, tek yerde.
 */
const DATE_LOCALES: Record<Language, Locale> = {
    tr: trDate,
    en: enUS,
};

export function dateLocaleFor(language: string): Locale {
    return DATE_LOCALES[toSupported(language)];
}

/** Herhangi bir dil etiketini desteklenen bir dile indirger ('tr-TR' -> 'tr'). */
export function toSupported(language: string | undefined): Language {
    const base = (language ?? '').toLowerCase().split('-')[0];
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
        ? (base as Language)
        : 'tr';
}

void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        // Türkçe yedek dil: ürünün asıl kitlesi Türkçe konuşuyor ve eksik bir
        // çeviri anahtarında İngilizce'ye düşmek yerine Türkçe göstermek daha
        // az şaşırtıcı.
        fallbackLng: 'tr',
        supportedLngs: SUPPORTED_LANGUAGES,
        // 'tr-TR' gibi bölgesel etiketleri 'tr'ye indirger; aksi halde
        // tarayıcıdan gelen değer hiçbir kaynakla eşleşmezdi.
        load: 'languageOnly',
        nonExplicitSupportedLngs: true,
        detection: {
            // Kullanıcının açık seçimi her zaman tarayıcı tercihini yener.
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: LANGUAGE_STORAGE_KEY,
            caches: ['localStorage'],
        },
        interpolation: {
            // React zaten kaçışlama yapıyor; i18next'in ikinci kez kaçışlaması
            // tırnak ve & karakterlerini bozardı.
            escapeValue: false,
        },
    });

/**
 * Belgenin dilini ve sekme başlığını etkin dile göre günceller.
 *
 * `index.html` bunları statik olarak taşıyor; dil değiştiğinde ikisi de
 * güncellenmezse ekran çeviricileri yanlış dili varsayar ve sekmede eski
 * dilde bir başlık kalır.
 */
export function syncDocumentLanguage(language: string) {
    document.documentElement.lang = toSupported(language);
    document.title = i18n.t('app.documentTitle');
}

i18n.on('languageChanged', syncDocumentLanguage);
syncDocumentLanguage(i18n.resolvedLanguage ?? 'tr');

export default i18n;
