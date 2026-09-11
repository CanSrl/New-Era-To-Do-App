import type { TranslationKey } from '../i18n';

/**
 * PostgREST hata kodunu koruyan sarmalayıcı.
 *
 * `throw new Error(error.message)` kodu düşürürdü; kalıcı/geçici ayrımı
 * koda bakmak zorunda.
 */
export class PostgrestSyncError extends Error {
    readonly code: string;

    constructor(message: string, code: string) {
        super(message);
        this.name = 'PostgrestSyncError';
        this.code = code;
    }
}

export type SyncErrorKind = 'retryable' | 'terminal';

export interface ClassifiedSyncError {
    kind: SyncErrorKind;
    code: string | null;
    messageKey: TranslationKey;
}

const TERMINAL_KEYS: Record<string, TranslationKey> = {
    '42501': 'sync.error.blockedRls',
    '23514': 'sync.error.blockedCheck',
    '23502': 'sync.error.blockedNotNull',
    '23503': 'sync.error.blockedFk',
};

export function toSyncError(error: { message: string; code?: string | null }): PostgrestSyncError {
    return new PostgrestSyncError(error.message, error.code ?? '');
}

export function classifySyncError(error: unknown): ClassifiedSyncError {
    const code = codeOf(error);
    const messageKey = code ? TERMINAL_KEYS[code] : undefined;
    if (messageKey) {
        return { kind: 'terminal', code, messageKey };
    }
    return { kind: 'retryable', code, messageKey: 'sync.error.unknown' };
}

function codeOf(error: unknown): string | null {
    if (error instanceof PostgrestSyncError && error.code) return error.code;
    if (error && typeof error === 'object' && 'code' in error) {
        const value = (error as { code: unknown }).code;
        return typeof value === 'string' && value.length > 0 ? value : null;
    }
    return null;
}
