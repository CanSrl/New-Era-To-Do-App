import { supabase, isSupabaseConfigured } from './supabase';
import type { TranslationKey } from '../i18n';

async function invokeBilling(name: 'billing-checkout' | 'billing-portal'): Promise<
    { url: string } | { errorKey: TranslationKey }
> {
    if (!isSupabaseConfigured || !supabase) {
        return { errorKey: 'auth.error.notConfigured' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { errorKey: 'billing.requireAuth.title' };

    const { data, error } = await supabase.functions.invoke(name, { method: 'POST' });
    if (error || !data || typeof data !== 'object' || typeof (data as { url?: unknown }).url !== 'string') {
        return { errorKey: name === 'billing-checkout' ? 'billing.checkoutError' : 'billing.portalError' };
    }
    return { url: (data as { url: string }).url };
}

export function startCheckout() {
    return invokeBilling('billing-checkout');
}

export function openPortal() {
    return invokeBilling('billing-portal');
}
