import type { TranslationKey } from '../i18n';
import type { Client, PlanStatus, Subscription } from './types';

/** Ücretsiz planda izin verilen müşteri sayısı (arşivli dahil). */
export const FREE_CLIENT_LIMIT = 1;

const PRO_STATUSES = new Set(['active', 'on_trial', 'cancelled']);
const PAST_DUE_STATUSES = new Set(['past_due', 'unpaid']);

/**
 * Sağlayıcı durumunu uygulama planına çevirir. `is_pro` SQL fonksiyonunun
 * ikizi: ayrışırsa arayüz Pro gösterip veritabanı reddeder.
 *
 * `now` parametre — saf katman saat okumaz.
 */
export function planStatusOf(subscription: Subscription | null, now: string): PlanStatus {
    if (!subscription) return 'free';

    const endsAt = subscription.endsAt;
    const stillCovered = endsAt === null || endsAt > now;

    if (PRO_STATUSES.has(subscription.status) && stillCovered) return 'pro';
    if (PAST_DUE_STATUSES.has(subscription.status)) return 'pastDue';
    return 'free';
}

export function isProPlan(subscription: Subscription | null, now: string): boolean {
    return planStatusOf(subscription, now) === 'pro';
}

/**
 * Yeni müşteri eklenebilir mi?
 *
 * Girişsiz kullanıcıya uygulanmaz: uygulama local-first, kapı ancak
 * `ownerId` varken devreye girer.
 */
export function canAddClient(
    state: {
        ownerId: string | null;
        clients: readonly Client[];
        subscription: Subscription | null;
    },
    now: string,
): boolean {
    if (!state.ownerId) return true;
    if (isProPlan(state.subscription, now)) return true;
    return state.clients.length < FREE_CLIENT_LIMIT;
}

export function planStatusMessageKey(status: PlanStatus): TranslationKey {
    if (status === 'pro') return 'billing.status.pro';
    if (status === 'pastDue') return 'billing.status.pastDue';
    return 'billing.status.free';
}
