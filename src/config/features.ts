/**
 * Derleme zamanı özellik bayrakları.
 *
 * Starter kit alıcısı bir özelliği tek bir ortam değişkeniyle açıp
 * kapatabilmeli; bayrakları koda dağıtmak yerine burada toplu tutuyoruz.
 *
 * **İki farklı bayrak türü var ve aradaki fark tesadüfi değil:**
 *
 * - *Davranış* anahtarları (`features.githubAuth`) kapalıyken ilgili arayüzü
 *   render etmez. Kodun paketten elenmesi beklenmez, gerekmez de.
 *
 * - *Paketleme* anahtarları (`NICHE_MODULE`) modülün üretim paketinden izsiz
 *   çıkmasını sağlamak zorundadır — bu, ürünün satış argümanının kendisi:
 *   aynı kod tabanı hem jenerik starter kit hem niş ürün olabilmeli. Bu tür
 *   bayraklar nesne içinde DURAMAZ (aşağıya bakınız).
 */

export { isEnabled, isEnabledByDefault } from './flag-parsing';

import { isEnabled } from './flag-parsing';

/**
 * Niş modül: müşteri/proje bağlantılı görev takibi.
 *
 * **Neden `features` nesnesinin içinde değil:** `features.nicheModule`
 * biçiminde durduğu sürece Vite dalları eleyemiyordu. `as const` bir nesnenin
 * özelliğine erişim, değer sabit olsa bile derleme zamanında katlanmıyor.
 * Ölçüldü — bayrağı kapatan derleme, açık olanla birebir aynı boyutta
 * (995.51 kB) çıkıyor ve pakette yedi ayrı `.nicheModule` çalışma zamanı
 * kontrolü kalıyordu.
 *
 * Çıplak bir `const` olarak `__NICHE_MODULE__` derleme sırasında düz
 * `true`/`false` ile değiştirilir ve `NICHE_MODULE` içeren dallar katlanır.
 * Bu sabiti `features` nesnesine taşımak, modülün paketten çıkma garantisini
 * sessizce ortadan kaldırır — testler bunu yakalar (`niche-stripping.test.ts`).
 *
 * Değer `vite.config.ts` içinde `isEnabledByDefault` ile hesaplanır, yani
 * toleranslı ayrıştırma (` FALSE `, `False`) korunur.
 *
 * Varsayılan AÇIKTIR, çünkü bu depo aynı zamanda freemium ürünün kendisi.
 * Kapatmak için `VITE_NICHE_MODULE=false`; o zaman
 * `supabase/migrations/20260814120000_niche_module.sql` da silinebilir.
 *
 * Bayrak senkron motorunda da okunuyor: kapalıyken `clients`/`projects`
 * tabloları hiç sorgulanmaz. Sorgulansaydı, migration'ı silmiş bir kurulum
 * her turda "relation does not exist" alır ve GÖREVLER de dahil bütün senkron
 * düşerdi.
 */
export const NICHE_MODULE = __NICHE_MODULE__;

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
     * Faturalama arayüzü (`/app/billing`, yükseltme bağlantıları).
     *
     * Varsayılan kapalıdır: LS kimlik bilgileri yokken "Yükselt" göstermek
     * kullanıcıyı hataya yollar. Kapı migration'ı ayrıdır — bayrak yalnızca
     * arayüzü kapatır (DEC-PAY-12).
     */
    billing: isEnabled(import.meta.env.VITE_BILLING),
} as const;
