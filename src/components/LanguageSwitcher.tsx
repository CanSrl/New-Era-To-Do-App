import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { cn } from '../lib/utils';
import { SUPPORTED_LANGUAGES, toSupported } from '../i18n';

/**
 * Dil seçici.
 *
 * Seçim `i18next-browser-languagedetector` tarafından LocalStorage'a yazılır,
 * dolayısıyla burada ayrıca saklamak gerekmez. Tema seçiciyle aynı radio
 * grubu desenini kullanır: seçenek sayısı az ve hepsi aynı anda görünmeli.
 */
export function LanguageSwitcher() {
    const { t, i18n } = useTranslation();
    const current = toSupported(i18n.resolvedLanguage);

    return (
        <div role="radiogroup" aria-label={t('language.aria')} className="flex gap-2">
            {SUPPORTED_LANGUAGES.map((language) => (
                <button
                    key={language}
                    role="radio"
                    aria-checked={current === language}
                    onClick={() => void i18n.changeLanguage(language)}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all',
                        current === language
                            ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/20'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    )}
                >
                    <Languages size={16} />
                    {t(`language.${language}`)}
                </button>
            ))}
        </div>
    );
}
