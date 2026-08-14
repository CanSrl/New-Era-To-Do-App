import { describe, it, expect } from 'vitest';
import { authErrorKey } from './auth-errors';

describe('authErrorKey', () => {
    it('kararlı hata kodlarını eşler', () => {
        expect(authErrorKey({ code: 'invalid_credentials', message: '' }))
            .toBe('auth.error.invalidCredentials');
        expect(authErrorKey({ code: 'weak_password', message: '' }))
            .toBe('auth.error.weakPassword');
        expect(authErrorKey({ code: 'over_request_rate_limit', message: '' }))
            .toBe('auth.error.rateLimited');
    });

    it('kod yoksa mesaj içeriğine düşer', () => {
        // Supabase her hatada `code` doldurmuyor; bu yedek olmadan
        // kullanıcı her seferinde genel mesajı görürdü.
        expect(authErrorKey({ message: 'Invalid login credentials' }))
            .toBe('auth.error.invalidCredentials');
        expect(authErrorKey({ message: 'Failed to fetch' }))
            .toBe('auth.error.network');
    });

    it('kod, mesaj içeriğine göre önceliklidir', () => {
        expect(authErrorKey({ code: 'weak_password', message: 'Invalid login credentials' }))
            .toBe('auth.error.weakPassword');
    });

    it('tanınmayan hatayı genel anahtara düşürür', () => {
        expect(authErrorKey({ code: 'teleport_failed', message: 'Beam misaligned' }))
            .toBe('auth.error.unknown');
    });

    it('sağlayıcının İngilizce metnini geri döndürmez', () => {
        const result = authErrorKey({ message: 'Something exploded upstream' });
        expect(result).not.toContain('exploded');
    });
});
