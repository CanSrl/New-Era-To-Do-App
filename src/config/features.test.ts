import { describe, expect, it } from 'vitest';
import { isEnabled } from './features';

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
