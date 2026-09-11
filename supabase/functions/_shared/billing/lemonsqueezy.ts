import type { BillingProvider, SubscriptionEvent } from './provider';

function toHex(bytes: Uint8Array): string {
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let out = 0;
    for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
    return out === 0;
}

async function hmacHexUtf8(secret: string, rawBody: string): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    // LS, ham HMAC baytlarını değil hex dizenin UTF-8'ini karşılaştırır.
    return new TextEncoder().encode(toHex(new Uint8Array(sig)));
}

export async function verifySignature(
    rawBody: string,
    signature: string,
    secret: string,
): Promise<boolean> {
    if (!rawBody || !signature || !secret) return false;
    const digest = await hmacHexUtf8(secret, rawBody);
    const given = new TextEncoder().encode(signature);
    return timingSafeEqual(digest, given);
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseEvent(payload: unknown): SubscriptionEvent | null {
    const root = asRecord(payload);
    if (!root) return null;
    const meta = asRecord(root.meta);
    const data = asRecord(root.data);
    const attributes = data ? asRecord(data.attributes) : null;
    if (!meta || !data || !attributes) return null;

    const name = asString(meta.event_name);
    const providerSubscriptionId = asString(data.id);
    const status = asString(attributes.status);
    const updatedAt = asString(attributes.updated_at);
    if (!name || !providerSubscriptionId || !status || !updatedAt) return null;

    const custom = asRecord(meta.custom_data);
    const userId = custom ? asString(custom.user_id) : null;

    return {
        name,
        providerSubscriptionId,
        providerCustomerId: attributes.customer_id != null ? String(attributes.customer_id) : null,
        status,
        variantId: attributes.variant_id != null ? String(attributes.variant_id) : null,
        userId,
        renewsAt: asString(attributes.renews_at),
        endsAt: asString(attributes.ends_at),
        trialEndsAt: asString(attributes.trial_ends_at),
        updatedAt,
        testMode: meta.test_mode === true || attributes.test_mode === true,
    };
}

export const lemonsqueezy: BillingProvider = { verifySignature, parseEvent };

export async function createCheckoutUrl(input: {
    apiKey: string;
    storeId: string;
    variantId: string;
    userId: string;
    fetchImpl?: typeof fetch;
}): Promise<string> {
    const fetchImpl = input.fetchImpl ?? fetch;
    const res = await fetchImpl('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
            data: {
                type: 'checkouts',
                attributes: {
                    checkout_data: {
                        custom: { user_id: input.userId },
                    },
                },
                relationships: {
                    store: { data: { type: 'stores', id: input.storeId } },
                    variant: { data: { type: 'variants', id: input.variantId } },
                },
            },
        }),
    });
    if (!res.ok) throw new Error(`checkout ${res.status}`);
    const json = await res.json() as { data?: { attributes?: { url?: string } } };
    const url = json.data?.attributes?.url;
    if (!url) throw new Error('checkout url missing');
    return url;
}

export async function fetchCustomerPortalUrl(input: {
    apiKey: string;
    subscriptionId: string;
    fetchImpl?: typeof fetch;
}): Promise<string> {
    const fetchImpl = input.fetchImpl ?? fetch;
    const res = await fetchImpl(
        `https://api.lemonsqueezy.com/v1/subscriptions/${input.subscriptionId}`,
        {
            headers: {
                Accept: 'application/vnd.api+json',
                Authorization: `Bearer ${input.apiKey}`,
            },
        },
    );
    if (!res.ok) throw new Error(`portal ${res.status}`);
    const json = await res.json() as {
        data?: { attributes?: { urls?: { customer_portal?: string } } };
    };
    const url = json.data?.attributes?.urls?.customer_portal;
    if (!url) throw new Error('portal url missing');
    return url;
}
