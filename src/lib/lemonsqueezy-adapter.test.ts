import { describe, expect, it } from 'vitest';
import {
    createCheckoutUrl,
    parseEvent,
    verifySignature,
} from '../../supabase/functions/_shared/billing/lemonsqueezy';

const SECRET = 'test-secret';
const BODY = '{"meta":{"event_name":"subscription_created","custom_data":{"user_id":"u1"},"test_mode":true},"data":{"id":"1","attributes":{"status":"active","updated_at":"2026-09-01T00:00:00.000Z","customer_id":9,"variant_id":3}}}';

async function sign(body: string, secret = SECRET) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('LemonSqueezy adaptörü', () => {
    it('doğru imzayı kabul, tek bit değişmiş imzayı red eder', async () => {
        const good = await sign(BODY);
        expect(await verifySignature(BODY, good, SECRET)).toBe(true);
        const flipped = (good.startsWith('a') ? 'b' : 'a') + good.slice(1);
        expect(await verifySignature(BODY, flipped, SECRET)).toBe(false);
    });

    it('boş gövde veya boş imzayı reddeder', async () => {
        expect(await verifySignature('', await sign(BODY), SECRET)).toBe(false);
        expect(await verifySignature(BODY, '', SECRET)).toBe(false);
    });

    it('farklı sırra ait imzayı reddeder', async () => {
        expect(await verifySignature(BODY, await sign(BODY, 'other'), SECRET)).toBe(false);
    });

    it('LS durumlarını SubscriptionEvent\'e çevirir', () => {
        const event = parseEvent(JSON.parse(BODY));
        expect(event).toMatchObject({
            name: 'subscription_created',
            providerSubscriptionId: '1',
            status: 'active',
            userId: 'u1',
            testMode: true,
        });
    });

    it('checkout gövdesindeki user_id\'yi istemciden değil argümandan yazar', async () => {
        let sent: string | null = null;
        const url = await createCheckoutUrl({
            apiKey: 'k',
            storeId: 's',
            variantId: 'v',
            userId: 'jwt-user',
            fetchImpl: async (_input, init) => {
                sent = typeof init?.body === 'string' ? init.body : null;
                return new Response(JSON.stringify({
                    data: { attributes: { url: 'https://pay.example/c' } },
                }));
            },
        });
        expect(url).toBe('https://pay.example/c');
        expect(sent).toContain('"user_id":"jwt-user"');
        expect(sent).not.toContain('attacker');
    });
});
