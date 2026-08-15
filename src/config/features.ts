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

/**
 * `isEnabled`'ın aynadaki hâli: varsayılanı AÇIK olan özellikler için.
 *
 * Yalnızca açık `false` metni kapatır; tanımsız, boş ve tanınmayan değerler
 * açık sayılır. Ayrı bir fonksiyon olmasının sebebi, varsayılanı açık bir
 * özelliği `isEnabled` ile ifade etmenin her kuruluma `.env` içine `=true`
 * yazma zorunluluğu getirmesiydi.
 *
 * Belirsiz girdide güvenli taraf burada `isEnabled`'ın tersidir: orada kapalı
 * bir sağlayıcıya yönlendirmek kullanıcıyı hata sayfasına düşürürdü; burada
 * yanlışlıkla kapatmak kullanıcının mevcut verisini arayüzden yok ederdi.
 */
export function isEnabledByDefault(value: string | undefined): boolean {
    return value?.trim().toLowerCase() !== 'false';
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

    /**
     * Niş modül: müşteri/proje bağlantılı görev takibi.
     *
     * Varsayılan AÇIKTIR, çünkü bu depo aynı zamanda freemium ürünün kendisi.
     * Starter kit alıcısı jenerik bir görev listesi istiyorsa
     * `VITE_NICHE_MODULE=false` yazar; o zaman `supabase/migrations/
     * 20260814120000_niche_module.sql` dosyası da silinebilir.
     *
     * Bayrak senkron motorunda okunuyor: kapalıyken `clients`/`projects`
     * tabloları hiç sorgulanmaz. Sorgulansaydı, migration'ı silmiş bir kurulum
     * her turda "relation does not exist" alır ve GÖREVLER de dahil bütün
     * senkron düşerdi.
     */
    nicheModule: isEnabledByDefault(import.meta.env.VITE_NICHE_MODULE),
} as const;
