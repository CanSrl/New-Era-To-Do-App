import { useState } from 'react';
import { cn } from '../lib/utils';

interface InlineNameProps {
    /** Kayıttaki mevcut ad. Senkron turu bunu değiştirirse taslak tazelenir. */
    value: string;
    maxLength: number;
    /**
     * Erişilebilir ad. Alanın görünür bir etiketi yoktur — girdinin kendisi
     * zaten adı taşır — bu yüzden `aria-label` şart.
     */
    label: string;
    /**
     * Taslağı işler. `false` dönerse ad reddedilmiştir (ör. aynı ad başka bir
     * kayıtta kullanılıyor) ve alan eski değerine döner. Kullanıcıya sebebi
     * söylemek çağıranın işi; burada yalnızca geri alınır.
     */
    onCommit: (name: string) => boolean;
    className?: string;
}

/**
 * Satır içinde düzenlenen ad alanı.
 *
 * Taslak yerel tutulur ve yalnızca odak kaybında ya da Enter'da işlenir; her
 * tuş vuruşunda store'a yazmak kaydı sürekli "gönderilmeyi bekliyor" durumuna
 * sokar ve senkronu gereksiz yere tetiklerdi. Escape taslağı iptal eder.
 *
 * Kenarlık yalnızca hover/odakta belirir: satır normalde metin gibi okunur ama
 * alan her zaman gerçek bir `input`'tur — "tıklayınca girdiye dönüşen metin"
 * deseni klavye kullanıcısını dışarıda bırakırdı.
 */
export function InlineName({ value, maxLength, label, onCommit, className }: InlineNameProps) {
    const [draft, setDraft] = useState(value);
    const [syncedValue, setSyncedValue] = useState(value);
    // Odak durumu ref değil state: render sırasında okunması gerekiyor.
    const [isFocused, setIsFocused] = useState(false);

    // Kayıt dışarıdan değişmiş olabilir (başka cihaz, senkron turu). Bu,
    // React'in "prop değişince durumu render sırasında düzelt" deseni; effect
    // ile yapmak fazladan bir render turu doğururdu.
    //
    // Kullanıcı o sırada yazıyorsa taslağına dokunulmaz: dakikada bir koşan
    // senkron, yazılmakta olan adı gözünün önünde silerdi.
    if (value !== syncedValue) {
        setSyncedValue(value);
        if (!isFocused) {
            setDraft(value);
        }
    }

    const commit = () => {
        const trimmed = draft.trim();

        if (!trimmed || trimmed === value) {
            setDraft(value);
            return;
        }

        if (!onCommit(trimmed)) {
            setDraft(value);
        }
    };

    return (
        <input
            value={draft}
            maxLength={maxLength}
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
                    setDraft(value);
                    e.currentTarget.blur();
                }
            }}
            className={cn(
                'w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1',
                'transition-colors hover:border-input focus-visible:border-input',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                className
            )}
        />
    );
}
