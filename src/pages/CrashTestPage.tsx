/**
 * Kasıtlı olarak çöken sayfa.
 *
 * Hata sınırının gerçekten çalıştığı ancak gerçek bir çökmeyle doğrulanabilir;
 * bu sayfa uçtan uca testin tetikleyicisidir. Rota yalnızca geliştirmede
 * kayıtlıdır (bkz. `src/router.tsx`), üretim derlemesinde dal tamamen elenir.
 */
export function CrashTestPage(): never {
    throw new Error('Kasıtlı çökme testi (yalnızca geliştirme rotası)');
}
