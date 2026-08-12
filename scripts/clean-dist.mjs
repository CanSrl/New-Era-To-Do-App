/**
 * Derleme öncesi dist/ içeriğini temizler.
 *
 * Neden gerekli: Vite'ın kendi `emptyOutDir` adımı bu projede çalışmıyor.
 * Klasör OneDrive ile eşitlenen bir yolda olduğu için özyinelemeli klasör
 * silme (fs.rmSync(dir, { recursive: true })) hata döndürmeden başarısız
 * oluyor — tek tek dosya silmek ise çalışıyor. Bu yüzden içerik dosya bazlı
 * siliniyor.
 *
 * Sonucu önemsiz değil: eski derlemelerden kalan bundle'lar dist içinde
 * birikiyor ve vite-plugin-pwa hepsini precache listesine alıyor. Fark
 * edildiğinde service worker 774 KiB yerine 2602 KiB precache ediyordu, yani
 * kullanıcı her kurulumda ~1.8 MB ölü JavaScript indiriyordu.
 *
 * Temizlik tamamlanamazsa derleme bilerek durdurulur: sessizce şişmiş bir
 * PWA yayınlamaktansa hata vermek yeğdir.
 */
import { existsSync, readdirSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(projectRoot, 'dist');

function emptyDirectory(directory) {
    for (const entry of readdirSync(directory)) {
        const target = join(directory, entry);
        if (statSync(target).isDirectory()) {
            emptyDirectory(target);
            try {
                rmdirSync(target);
            } catch {
                // Klasörün kendisi kalabilir; önemli olan içinin boşalması.
            }
        } else {
            unlinkSync(target);
        }
    }
}

function remainingFiles(directory) {
    if (!existsSync(directory)) return [];
    return readdirSync(directory).flatMap((entry) => {
        const target = join(directory, entry);
        return statSync(target).isDirectory() ? remainingFiles(target) : [target];
    });
}

if (existsSync(distDir)) {
    emptyDirectory(distDir);

    const leftovers = remainingFiles(distDir);
    if (leftovers.length > 0) {
        console.error('dist/ temizlenemedi. Kalan dosyalar:');
        for (const file of leftovers) console.error(`  ${file}`);
        console.error('\nBu dosyalar service worker tarafından precache edilir.');
        process.exit(1);
    }
}
