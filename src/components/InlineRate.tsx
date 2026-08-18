import { useState } from 'react';
import { cn } from '../lib/utils';

interface InlineRateProps {
    /**
     * Kayıttaki saatlik ücret. `null` = değer yok — projede "müşteriden
     * miras al" demektir ve `0`'dan (bu proje ücretsiz) FARKLIDIR.
     */
    value: number | null;
    /** Erişilebilir ad; alanın görünür etiketi yok. */
    label: string;
    /** Alan boşken görünen metin (projede miras alınan ücret). */
    placeholder?: string;
    /**
     * Boş bırakılabilir mi? Projede evet (`null` = miras), müşteride hayır:
     * `clients.hourly_rate` şemada `not null`.
     */
    allowEmpty?: boolean;
    /**
     * Taslağı işler. `false` dönerse değer reddedilmiştir (ör. negatif ücret)
     * ve alan eski değerine döner. Sebebi kullanıcıya söylemek çağıranın işi.
     */
    onCommit: (rate: number | null) => boolean;
    className?: string;
}

/** Sayı alanı her zaman nokta ayraçlı ham değeri taşır (`input[type=number]`). */
function toDraft(value: number | null): string {
    return value === null ? '' : String(value);
}

/**
 * Satır içinde düzenlenen saatlik ücret alanı — `InlineName`'in sayı ikizi.
 *
 * Aynı sözleşme: taslak yerel tutulur, yalnızca odak kaybında ya da Enter'da
 * işlenir (her tuş vuruşunda store'a yazmak kaydı sürekli "gönderilmeyi
 * bekliyor" durumunda tutar ve senkronu boşuna tetikler), Escape iptal eder,
 * kenarlık yalnızca hover/odakta belirir ama alan **her zaman gerçek bir
 * `input`**'tur.
 *
 * Aralık denetimi burada YAPILMAZ: sayıya çevrilemeyen taslak sessizce geri
 * alınır, geri kalanı `onCommit`'e gider ve şemanın ikizi olan store kuralı
 * karar verir. Böylece "negatif ücret" hatası kullanıcıya tek yerden,
 * store'un gerçekten reddettiği durumda söylenir.
 */
export function InlineRate({
    value,
    label,
    placeholder,
    allowEmpty = false,
    onCommit,
    className,
}: InlineRateProps) {
    const [draft, setDraft] = useState(() => toDraft(value));
    const [syncedValue, setSyncedValue] = useState(value);
    const [isFocused, setIsFocused] = useState(false);

    // Kayıt dışarıdan değişmiş olabilir (başka cihaz, senkron turu). Kullanıcı
    // o sırada yazıyorsa taslağına dokunulmaz.
    if (value !== syncedValue) {
        setSyncedValue(value);
        if (!isFocused) {
            setDraft(toDraft(value));
        }
    }

    const revert = () => setDraft(toDraft(value));

    const commit = () => {
        const trimmed = draft.trim();

        if (!trimmed) {
            if (!allowEmpty || value === null) {
                revert();
                return;
            }
            if (!onCommit(null)) revert();
            return;
        }

        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) {
            revert();
            return;
        }

        if (parsed === value) {
            revert();
            return;
        }

        if (!onCommit(parsed)) revert();
    };

    return (
        <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={draft}
            placeholder={placeholder}
            aria-label={label}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
                setIsFocused(false);
                commit();
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                    revert();
                    e.currentTarget.blur();
                }
            }}
            className={cn(
                'min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 tabular-nums',
                'transition-colors hover:border-input focus-visible:border-input',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                className
            )}
        />
    );
}
