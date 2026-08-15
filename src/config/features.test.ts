import { describe, expect, it } from 'vitest';
import { isEnabled, isEnabledByDefault } from './features';

describe('isEnabled', () => {
    it('yalnızca "true" metnini açık sayar', () => {
        expect(isEnabled('true')).toBe(true);
        expect(isEnabled('TRUE')).toBe(true);
        expect(isEnabled('  true  ')).toBe(true);
    });

    it('tanımsız veya boş değerde kapalıdır', () => {
        expect(isEnabled(undefined)).toBe(false);
        expect(isEnabled('')).toBe(false);
        expect(isEnabled('   ')).toBe(false);
    });

    it('"false" metnini kapalı sayar', () => {
        // Klasik tuzak: ortam değişkeni metindir, `Boolean("false")` true'dur.
        // Bu kontrol olmadan `.env` içine `VITE_AUTH_GITHUB=false` yazmak
        // özelliği açardı.
        expect(isEnabled('false')).toBe(false);
        expect(isEnabled('0')).toBe(false);
    });

    it('belirsiz değerleri açmaz', () => {
        // Kapalı sağlayıcıya yönlendirmek kullanıcıyı hata sayfasına düşürür;
        // şüpheli girdide güvenli taraf "kapalı".
        expect(isEnabled('yes')).toBe(false);
        expect(isEnabled('1')).toBe(false);
        expect(isEnabled('enabled')).toBe(false);
    });
});

describe('isEnabledByDefault', () => {
    /**
     * `isEnabled`'ın aynadaki hâli. Ayrı bir fonksiyon olmasının sebebi:
     * varsayılanı açık olan bir özelliği `isEnabled` ile ifade etmek
     * `.env` dosyasına her kurulumda `=true` yazmayı zorunlu kılardı.
     */
    it('tanımsız veya boş değerde açıktır', () => {
        expect(isEnabledByDefault(undefined)).toBe(true);
        expect(isEnabledByDefault('')).toBe(true);
        expect(isEnabledByDefault('   ')).toBe(true);
    });

    it('yalnızca açık "false" metni kapatır', () => {
        expect(isEnabledByDefault('false')).toBe(false);
        expect(isEnabledByDefault('FALSE')).toBe(false);
        expect(isEnabledByDefault('  false  ')).toBe(false);
    });

    it('belirsiz değerleri kapatmaz', () => {
        // Buradaki güvenli taraf "açık": belirsiz bir değer yüzünden modülü
        // kapatmak, kullanıcının müşteri/proje verisini arayüzden görünmez
        // yapardı. Kapatma bilinçli bir eylem olmalı.
        expect(isEnabledByDefault('no')).toBe(true);
        expect(isEnabledByDefault('0')).toBe(true);
        expect(isEnabledByDefault('disabled')).toBe(true);
    });
});
