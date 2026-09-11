import { describe, expect, it } from 'vitest';
import { canAddClient, planStatusOf } from './billing';
import type { Client, Subscription } from './types';

const NOW = '2026-09-01T12:00:00.000Z';
const FUTURE = '2026-10-01T00:00:00.000Z';
const PAST = '2026-08-01T00:00:00.000Z';

function sub(over: Partial<Subscription> & Pick<Subscription, 'status'>): Subscription {
    return {
        userId: 'u1',
        provider: 'lemonsqueezy',
        providerSubscriptionId: 'sub_1',
        providerCustomerId: 'cus_1',
        variantId: '1',
        renewsAt: FUTURE,
        endsAt: null,
        trialEndsAt: null,
        testMode: true,
        createdAt: NOW,
        updatedAt: NOW,
        ...over,
    };
}

const oneClient = [{ id: 'c1' } as Client];
const twoClients = [{ id: 'c1' } as Client, { id: 'c2' } as Client];

describe('planStatusOf', () => {
    it('abonelik yokken free', () => {
        expect(planStatusOf(null, NOW)).toBe('free');
    });

    it('active ve on_trial Pro', () => {
        expect(planStatusOf(sub({ status: 'active' }), NOW)).toBe('pro');
        expect(planStatusOf(sub({ status: 'on_trial' }), NOW)).toBe('pro');
    });

    it('cancelled, ends_at gelecekteyse Pro; geçmişteyse free', () => {
        expect(planStatusOf(sub({ status: 'cancelled', endsAt: FUTURE }), NOW)).toBe('pro');
        expect(planStatusOf(sub({ status: 'cancelled', endsAt: PAST }), NOW)).toBe('free');
        expect(planStatusOf(sub({ status: 'cancelled', endsAt: null }), NOW)).toBe('pro');
    });

    it('past_due ve unpaid pastDue', () => {
        expect(planStatusOf(sub({ status: 'past_due' }), NOW)).toBe('pastDue');
        expect(planStatusOf(sub({ status: 'unpaid' }), NOW)).toBe('pastDue');
    });

    it('expired ve paused free', () => {
        expect(planStatusOf(sub({ status: 'expired' }), NOW)).toBe('free');
        expect(planStatusOf(sub({ status: 'paused' }), NOW)).toBe('free');
    });
});

describe('canAddClient', () => {
    it('girişsiz kullanıcıya sınır uygulanmaz', () => {
        expect(canAddClient(
            { ownerId: null, clients: twoClients, subscription: null },
            NOW,
        )).toBe(true);
    });

    it('ücretsiz girişli kullanıcı 1. müşteriyi ekler, 2.yi eklemez', () => {
        expect(canAddClient(
            { ownerId: 'u1', clients: [], subscription: null },
            NOW,
        )).toBe(true);
        expect(canAddClient(
            { ownerId: 'u1', clients: oneClient, subscription: null },
            NOW,
        )).toBe(false);
    });

    it('Pro sınırsız ekler', () => {
        expect(canAddClient(
            { ownerId: 'u1', clients: twoClients, subscription: sub({ status: 'active' }) },
            NOW,
        )).toBe(true);
    });
});
