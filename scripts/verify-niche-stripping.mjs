/**
 * Niş modülün üretim paketinden gerçekten çıktığını doğrular.
 *
 * Bu, ürünün satış argümanının kanıtı: aynı kod tabanı hem jenerik starter kit
 * hem niş ürün olabilmeli. Argüman "kod bayrakla kapanıyor" değil, "kapalıyken
 * paketten izsiz çıkıyor" — ikisi farklı şeyler ve fark ancak ölçülerek görülür.
 *
 * Neden otomatik bir kontrol: bu daha önce sessizce bozuktu. Bayrak
 * `features.nicheModule` biçiminde bir nesne özelliğiydi, Vite dalları
 * katlayamıyordu ve `VITE_NICHE_MODULE=false` derlemesi açık olanla birebir
 * aynı boyutta çıkıyordu. Kimse ölçmediği için aylarca fark edilmedi.
 *
 * Kontrol iki yönlüdür ve ikisi de şart:
 *   1. Bayrak KAPALI derlemede niş izleri BULUNMAMALI.
 *   2. Bayrak AÇIK derlemede BULUNMALI — aksi halde test, modülü tamamen
 *      bozan bir değişiklikte de "geçer" ve hiçbir şey korumaz.
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST_ASSETS = 'dist/assets';

/**
 * Pakette aranacak izler.
 *
 * Bilinçli olarak **metin sabitleri** seçildi. Bileşen ve fonksiyon adları
 * (`ClientsPage`, `mergeClients`) minify sırasında yeniden adlandırılıyor;
 * onları aramak yanıltıcıdır — "0 eşleşme" elenmeyi değil, sadece ismin
 * değişmiş olmasını gösterir. Rota yolu ve kullanıcıya görünen metinler ise
 * minify'dan sağ çıkar.
 */
const MARKERS = [
    { pattern: 'app/clients', what: 'müşteriler rotası' },
    { pattern: 'app/delivery', what: 'teslim görünümü rotası' },
    { pattern: 'deleteConfirmProjects', what: 'niş çeviri anahtarı' },
    { pattern: 'projesi de silinir', what: 'niş Türkçe metin' },
    { pattern: 'teslim tarihine yakınlığına', what: 'teslim görünümü metni' },
];

function build(nicheEnabled) {
    // Tek metinlik komut: `execFileSync` + `shell: true` + args dizisi
    // birleşimi Node 22'de DEP0190 uyarısı veriyor (argümanlar kaçışlanmadan
    // birleştiriliyor). Burada argüman yok, bayrak ortam değişkeniyle geçiyor.
    //
    // Komut metni sabit ve dışarıdan hiçbir girdi almıyor; kabuk kullanılsa da
    // enjeksiyon yüzeyi yok. (Bir gün buraya değişken eklenirse `execFileSync`
    // + argüman dizisine dönülmeli.)
    execSync('npm run build', {
        stdio: 'pipe',
        env: { ...process.env, VITE_NICHE_MODULE: nicheEnabled ? 'true' : 'false' },
    });
}

/** `dist/assets` içindeki bütün JS dosyalarını tek metin olarak okur. */
function bundleText() {
    return readdirSync(DIST_ASSETS)
        .filter((name) => name.endsWith('.js'))
        .map((name) => readFileSync(join(DIST_ASSETS, name), 'utf8'))
        .join('\n');
}

const failures = [];

build(false);
const withoutNiche = bundleText();
for (const { pattern, what } of MARKERS) {
    if (withoutNiche.includes(pattern)) {
        failures.push(
            `VITE_NICHE_MODULE=false derlemesinde ${what} hâlâ var ("${pattern}").`
        );
    }
}

build(true);
const withNiche = bundleText();
for (const { pattern, what } of MARKERS) {
    if (!withNiche.includes(pattern)) {
        failures.push(
            `Bayrak AÇIKKEN ${what} pakette YOK ("${pattern}") — modül bozulmuş olabilir.`
        );
    }
}

if (failures.length > 0) {
    console.error('Niş modül eleme doğrulaması BAŞARISIZ:\n');
    for (const line of failures) console.error(`  ✗ ${line}`);
    console.error(
        '\nBayrağın derleme zamanında katlanabilmesi gerekiyor. Sık karşılaşılan sebepler:\n' +
        '  - `NICHE_MODULE` bir nesnenin içine taşınmış (özellik erişimi katlanmaz)\n' +
        '  - niş bir modül, ölü dalın DIŞINDA referans edilmiş (örn. fonksiyon argümanı)\n' +
        '  - `vite.config.ts` içindeki `define` kaldırılmış\n'
    );
    process.exit(1);
}

console.log(
    `Niş modül eleme doğrulandı: ${MARKERS.length} iz bayrak kapalıyken yok, açıkken var.`
);
