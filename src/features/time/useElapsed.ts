import { useCallback, useSyncExternalStore } from 'react';

/** Duvar saatinin saniye çözünürlüklü anlık değeri. */
function nowInSeconds(): number {
    return Math.floor(Date.now() / 1000);
}

/**
 * Çalışan sayacın geçen saniyesi.
 *
 * `setInterval` bir sayaç DEĞİL, yalnızca yeniden okuma tetikleyicisidir;
 * değer her seferinde `startedAt` damgasıyla duvar saati arasındaki farktan
 * türetilir. Sekme uykuya dalıp interval'lar kısıldığında ya da tamamen
 * durduğunda bile süre doğru kalır — biriktirilen bir sayaç olsaydı kaçan
 * tıklar kadar geri kalır ve kullanıcı bir saatlik işi 40 dakika olarak
 * kaydederdi.
 *
 * Saat `useSyncExternalStore` ile okunuyor, `useState` + `useEffect` ile
 * değil. Sebebi üslup değil, kural:
 * - `Date.now()` doğrudan render içinde çağrılamaz (`react-hooks/purity`),
 * - efektin gövdesinden `setState` çağrılamaz (`react-hooks/set-state-in-effect`),
 * - ve efektle kurulan bir state, yenilemeden sonra bir kare boyunca
 *   `0:00:00` gösterip gerçek süreye sıçrardı.
 * `useSyncExternalStore` tam da "değişken bir dış kaynağı render için güvenli
 * biçimde okumak" için var; ilk render doğru değeri gösterir.
 *
 * Anlık görüntü saniyeye yuvarlanır: aynı saniye içinde yapılan okumalar aynı
 * sayıyı döndürür, yani React gereksiz yeniden render görmez.
 *
 * Sayaç kapalıyken interval hiç kurulmaz; uygulama saniyede bir render
 * etmemeli.
 */
export function useElapsed(startedAt: string | null): number {
    const subscribe = useCallback(
        (onChange: () => void) => {
            if (!startedAt) return () => {};

            const id = setInterval(onChange, 1000);
            return () => clearInterval(id);
        },
        [startedAt]
    );

    const now = useSyncExternalStore(subscribe, nowInSeconds);

    if (!startedAt) return 0;

    // Saat geri alındıysa fark negatif çıkabilir; süre negatif olamaz.
    return Math.max(0, now - Math.floor(new Date(startedAt).getTime() / 1000));
}
