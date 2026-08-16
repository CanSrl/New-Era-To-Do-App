/**
 * HTTP güvenlik başlıklarının iki dağıtım dosyası arasında ayrışmasını önler.
 *
 * Başlıklar iki yerde tanımlı olmak zorunda: `vercel.json` (Vercel) ve
 * `public/_headers` (Netlify ve uyumlu servisler). İkisi de statik dosya;
 * ortak bir kaynaktan üretilemiyorlar.
 *
 * Bu testin varlık sebebi, kopyanın sessiz bozulması: biri güncellenip diğeri
 * unutulursa uygulama hangi servise dağıtıldığına göre farklı korunur ve fark
 * ancak üretimde, `curl -I` ile bakan biri tarafından görülür. Yani hata
 * geliştirme sırasında hiçbir belirti vermez.
 *
 * Ayrıca politikanın kendisinden vazgeçilmediğini de sınar — bir kural
 * "geçici olarak" gevşetilip geri alınmayı beklerken kalıcı hale gelmesin.
 */
// Dosyalar `?raw` ile içe aktarılıyor, `node:fs` ile değil: `tsconfig.app.json`
// yalnızca `vite/client` tiplerini alıyor (uygulama kodu tarayıcıda çalışıyor),
// dolayısıyla `node:fs` burada tip hatası verirdi. `?raw` ayrıca dosya yolunu
// derleme zamanında bağlar — yol yanlışsa test çalışmadan önce patlar.
import vercelRaw from '../../vercel.json?raw';
import netlifyRaw from '../../public/_headers?raw';
import { describe, expect, it } from 'vitest';

const vercelConfig = JSON.parse(vercelRaw) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
};

/** `public/_headers` içindeki `/*` kuralını `{ başlık: değer }` haline getirir. */
function parseNetlifyHeaders(): Record<string, string> {
    const raw = netlifyRaw;
    const result: Record<string, string> = {};
    let inWildcardRule = false;

    for (const line of raw.split(/\r?\n/)) {
        if (line.startsWith('#') || line.trim() === '') continue;

        // Girintisiz satır yeni bir yol kuralı başlatır.
        if (!/^\s/.test(line)) {
            inWildcardRule = line.trim() === '/*';
            continue;
        }
        if (!inWildcardRule) continue;

        const separator = line.indexOf(':');
        result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }

    return result;
}

const vercelHeaders = Object.fromEntries(
    vercelConfig.headers
        .find((rule) => rule.source === '/(.*)')!
        .headers.map((h) => [h.key, h.value])
);
const netlifyHeaders = parseNetlifyHeaders();

describe('güvenlik başlıkları — iki dağıtım dosyası aynı olmalı', () => {
    it('aynı başlık kümesini tanımlar', () => {
        expect(Object.keys(netlifyHeaders).sort()).toEqual(Object.keys(vercelHeaders).sort());
    });

    it('her başlık için aynı değeri verir', () => {
        expect(netlifyHeaders).toEqual(vercelHeaders);
    });
});

describe('güvenlik başlıkları — politikadan vazgeçilmemiş', () => {
    const csp = vercelHeaders['Content-Security-Policy'];

    it('sayfanın iframe içine gömülmesini engeller', () => {
        // Kriter metninin birebir istediği direktif.
        expect(csp).toContain("frame-ancestors 'none'");
        expect(vercelHeaders['X-Frame-Options']).toBe('DENY');
    });

    it('MIME türü tahminini kapatır', () => {
        expect(vercelHeaders['X-Content-Type-Options']).toBe('nosniff');
    });

    it('yönlendiren bilgisini sızdırmaz', () => {
        expect(vercelHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('varsayılanı kendi kaynağına kilitler', () => {
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
    });

    it('script için unsafe-inline ya da unsafe-eval AÇMAZ', () => {
        // Üretim çıktısında satır içi script yok; bu izin verilirse XSS'e karşı
        // CSP'nin asıl değeri kaybolur.
        const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'))!;
        expect(scriptSrc).not.toContain('unsafe-inline');
        expect(scriptSrc).not.toContain('unsafe-eval');
    });

    it('Supabase bağlantısına izin verir', () => {
        // Bu olmadan bütün senkron istekleri tarayıcı tarafından engellenir —
        // uygulama çalışır görünür ama hiçbir şey eşitlenmez.
        expect(csp).toContain('https://*.supabase.co');
        expect(csp).toContain('wss://*.supabase.co');
    });
});
