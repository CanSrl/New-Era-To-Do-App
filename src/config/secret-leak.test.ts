import { describe, expect, it } from 'vitest';

/**
 * `VITE_` öneki değeri istemci paketine gömer. Service role, webhook sırrı
 * veya API anahtarı bir gün yanlışlıkla bu önekle tanımlanırsa tarayıcıya
 * sızar. ANON_KEY bilinçli istisnadır: RLS ile korunur, istemciye aittir.
 */
describe('VITE_ sır sızıntısı', () => {
    it('istemci env adlarında SECRET / SERVICE_ROLE / TOKEN yok', () => {
        const names = Object.keys(import.meta.env).filter((key) => key.startsWith('VITE_'));
        const leaked = names.filter((name) => {
            if (name === 'VITE_SUPABASE_ANON_KEY') return false;
            return /SECRET|SERVICE_ROLE|TOKEN|(?<!ANON_)KEY/i.test(name);
        });
        expect(leaked).toEqual([]);
    });
});
