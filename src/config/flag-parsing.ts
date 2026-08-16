/**
 * Özellik bayrağı metinlerini boolean'a çeviren saf yardımcılar.
 *
 * **Neden `features.ts`'ten ayrı bir dosya:** bu fonksiyonları `vite.config.ts`
 * de kullanıyor. `features.ts` modül gövdesinde `import.meta.env` okuyor;
 * yapılandırma dosyası Node tarafında çalıştığı için onu import etmek
 * çalışmazdı. Ayrıştırma mantığı burada tek nüsha duruyor ki derleme zamanında
 * enjekte edilen değer ile uygulamanın beklediği anlam ayrışmasın.
 *
 * Dosyanın `import.meta.env` gibi ortam bağımlılığı YOKTUR ve öyle kalmalıdır —
 * aksi halde `vite.config.ts` tarafındaki import yeniden kırılır.
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
