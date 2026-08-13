/**
 * Derleme zamanı özellik bayrakları.
 *
 * Starter kit alıcısı bir özelliği tek bir ortam değişkeniyle açıp
 * kapatabilmeli; bayrakları koda dağıtmak yerine burada toplu tutuyoruz.
 * Değerler `import.meta.env` üzerinden geldiği için Vite bunları derleme
 * sırasında sabitler — kapalı özelliklerin dalları paketten elenebilir.
 */

/**
 * Yalnızca açık `true` metnini kabul eder; `"false"`, `""`, tanımsız → kapalı.
 *
 * Ortam değişkenleri her zaman metindir: `Boolean(value)` yazılsaydı
 * `VITE_AUTH_GITHUB=false` özelliği *açardı*. Bu yüzden ayrı bir fonksiyon ve
 * kendi testi var.
 */
export function isEnabled(value: string | undefined): boolean {
    return value?.trim().toLowerCase() === 'true';
}

export const features = {
    /**
     * GitHub ile giriş butonu.
     *
     * Varsayılan kapalıdır: Supabase projesinde sağlayıcı etkinleştirilmeden
     * butonu göstermek kullanıcıyı "Unsupported provider" hatasına yollar.
     * Açmadan önce hem GitHub'da bir OAuth App hem de Supabase tarafında
     * sağlayıcı yapılandırılmış olmalı (bkz. README).
     */
    githubAuth: isEnabled(import.meta.env.VITE_AUTH_GITHUB),
} as const;
