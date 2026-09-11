/** Sağlayıcıdan bağımsız abonelik olayı. Fonksiyonlar bu tipi bilir, LS'yi değil. */
export interface SubscriptionEvent {
    name: string;
    providerSubscriptionId: string;
    providerCustomerId: string | null;
    status: string;
    variantId: string | null;
    userId: string | null;
    renewsAt: string | null;
    endsAt: string | null;
    trialEndsAt: string | null;
    updatedAt: string;
    testMode: boolean;
}

export interface BillingProvider {
    verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean>;
    parseEvent(payload: unknown): SubscriptionEvent | null;
}
