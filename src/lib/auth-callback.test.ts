import { describe, expect, it } from 'vitest';
import { parseAuthCallbackError } from './auth-callback';

describe('parseAuthCallbackError', () => {
    it('temiz bir dönüşte hata bildirmez', () => {
        expect(parseAuthCallbackError('', '')).toBeNull();
        expect(parseAuthCallbackError('?code=abc123', '')).toBeNull();
        expect(parseAuthCallbackError('', '#access_token=abc&token_type=bearer')).toBeNull();
    });

    it('sorgu dizesindeki hatayı okur (PKCE akışı)', () => {
        const result = parseAuthCallbackError(
            '?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
            ''
        );

        expect(result).toEqual({
            code: 'otp_expired',
            message: 'Bağlantının süresi dolmuş. Lütfen yeni bir bağlantı isteyin.',
        });
    });

    it('çapa parçasındaki hatayı okur (implicit akış)', () => {
        const result = parseAuthCallbackError(
            '',
            '#error=access_denied&error_code=access_denied&error_description=User+denied'
        );

        expect(result?.code).toBe('access_denied');
        expect(result?.message).toContain('Authorize');
    });

    it('`?` ve `#` önekleri olmadan da çalışır', () => {
        expect(parseAuthCallbackError('error=provider_disabled', '')?.code).toBe('provider_disabled');
        expect(parseAuthCallbackError('', 'error=provider_disabled')?.code).toBe('provider_disabled');
    });

    it('ayrıntılı `error_code` genel `error` yerine tercih edilir', () => {
        // Supabase ikisini birlikte gönderir: `access_denied` neredeyse her
        // başarısızlıkta çıkar, asıl sebebi `error_code` taşır.
        const result = parseAuthCallbackError(
            '?error=access_denied&error_code=provider_email_needs_verification',
            ''
        );

        expect(result?.code).toBe('provider_email_needs_verification');
        expect(result?.message).toContain('doğrulanmamış');
    });

    it('yalnızca `error_code` gelse de hatayı yakalar', () => {
        expect(parseAuthCallbackError('?error_code=unexpected_failure', '')?.code).toBe(
            'unexpected_failure'
        );
    });

    it('tanınmayan kodda genel mesaj döner ama kodu korur', () => {
        const result = parseAuthCallbackError('?error=server_error&error_code=teleport_failed', '');

        // Kod günlüğe/destek kaydına yazılabilsin diye kaybedilmez.
        expect(result?.code).toBe('teleport_failed');
        expect(result?.message).toBe('Giriş tamamlanamadı. Lütfen tekrar deneyin.');
    });

    it('sağlayıcının İngilizce açıklamasını kullanıcıya sızdırmaz', () => {
        const result = parseAuthCallbackError(
            '?error=server_error&error_description=Unable+to+exchange+external+code',
            ''
        );

        expect(result?.message).not.toContain('Unable to exchange');
    });
});
