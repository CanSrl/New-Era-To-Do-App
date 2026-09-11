import { createClient } from 'npm:@supabase/supabase-js@2';
import { createCheckoutUrl } from '../_shared/billing/lemonsqueezy.ts';

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return new Response('method', { status: 405, headers: cors });

    const auth = req.headers.get('Authorization');
    if (!auth) return new Response('unauthorized', { status: 401, headers: cors });

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: auth } } },
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return new Response('unauthorized', { status: 401, headers: cors });

    // İstemcinin gönderdiği user_id yok sayılır — JWT'deki id yazılır (DEC-PAY-07).
    try {
        const url = await createCheckoutUrl({
            apiKey: Deno.env.get('LEMONSQUEEZY_API_KEY') ?? '',
            storeId: Deno.env.get('LEMONSQUEEZY_STORE_ID') ?? '',
            variantId: Deno.env.get('LEMONSQUEEZY_VARIANT_ID') ?? '',
            userId: user.id,
        });
        return new Response(JSON.stringify({ url }), {
            headers: { ...cors, 'Content-Type': 'application/json' },
        });
    } catch {
        return new Response('checkout failed', { status: 502, headers: cors });
    }
});
