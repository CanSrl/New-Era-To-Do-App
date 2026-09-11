import { describe, expect, it } from 'vitest';
import { classifySyncError, PostgrestSyncError, toSyncError } from './sync-errors';

describe('classifySyncError', () => {
    it('42501, 23514, 23502, 23503 kalıcıdır ve anahtar koda göre ayrılır', () => {
        expect(classifySyncError(toSyncError({ message: 'rls', code: '42501' }))).toEqual({
            kind: 'terminal',
            code: '42501',
            messageKey: 'sync.error.blockedRls',
        });
        expect(classifySyncError(new PostgrestSyncError('check', '23514')).messageKey)
            .toBe('sync.error.blockedCheck');
        expect(classifySyncError(new PostgrestSyncError('nn', '23502')).messageKey)
            .toBe('sync.error.blockedNotNull');
        expect(classifySyncError(new PostgrestSyncError('fk', '23503')).messageKey)
            .toBe('sync.error.blockedFk');
    });

    it('ağ ve 5xx geçicidir; dirty kalır', () => {
        expect(classifySyncError(new Error('Failed to fetch')).kind).toBe('retryable');
        expect(classifySyncError(toSyncError({ message: 'boom', code: 'PGRST301' })).kind)
            .toBe('retryable');
    });
});
