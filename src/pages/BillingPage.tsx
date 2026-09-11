import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useTaskStore } from '../store';
import { planStatusMessageKey, planStatusOf } from '../lib/billing';
import { openPortal, startCheckout } from '../lib/billing-api';
import { format, parseISO } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';

function formatStamp(iso: string | null, locale: string): string | null {
    if (!iso) return null;
    try {
        return format(parseISO(iso), 'd MMM yyyy', { locale: locale.startsWith('tr') ? tr : enUS });
    } catch {
        return iso;
    }
}

export function BillingPage() {
    const { t, i18n } = useTranslation();
    const subscription = useTaskStore((s) => s.subscription);
    const [busy, setBusy] = useState(false);
    const now = new Date().toISOString();
    const status = planStatusOf(subscription, now);

    const renews = formatStamp(subscription?.renewsAt ?? null, i18n.language);
    const ends = formatStamp(subscription?.endsAt ?? null, i18n.language);

    const run = async (fn: () => ReturnType<typeof startCheckout>) => {
        setBusy(true);
        const result = await fn();
        setBusy(false);
        if ('errorKey' in result) {
            toast.error(t(result.errorKey));
            return;
        }
        window.location.assign(result.url);
    };

    return (
        <div className="max-w-lg space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">{t('billing.title')}</h2>

            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <p className="text-lg font-semibold">{t(planStatusMessageKey(status))}</p>
                <p className="text-sm text-muted-foreground">
                    {status === 'pro' && t('billing.proBody')}
                    {status === 'free' && t('billing.freeBody')}
                    {status === 'pastDue' && t('billing.pastDueBody')}
                </p>
                {renews && status === 'pro' && (
                    <p className="text-sm text-muted-foreground">{t('billing.renewsAt', { date: renews })}</p>
                )}
                {ends && (
                    <p className="text-sm text-muted-foreground">{t('billing.endsAt', { date: ends })}</p>
                )}
            </div>

            {status === 'pro' || status === 'pastDue' ? (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => { void run(openPortal); }}
                    className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium disabled:opacity-50"
                >
                    {t('billing.manage')}
                </button>
            ) : (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => { void run(startCheckout); }}
                    className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium disabled:opacity-50"
                >
                    {t('billing.upgrade')}
                </button>
            )}
        </div>
    );
}
