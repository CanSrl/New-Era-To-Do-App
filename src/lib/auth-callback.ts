/**
 * Yönlendirme adresinden dönen auth hatalarının okunması.
 *
 * Supabase, OAuth veya e-posta bağlantısı başarısız olduğunda kullanıcıyı yine
 * yönlendirme adresine gönderir; hata bilgisi adrese eklenir. Akış tipine göre
 * bazen sorgu dizesinde (`?error=…`, PKCE), bazen çapa parçasında
 * (`#error=…`, implicit) durur — bu yüzden ikisine de bakılır.
 *
 * Ağ çağrısı içermeyen saf bir fonksiyon olduğu için tüm hata biçimleri birim
 * testiyle kapsanabilir.
 */

import type { TranslationKey } from '../i18n';

export interface AuthCallbackError {
    /** Supabase'in kararlı hata kodu; bilinmeyen hatalarda günlüğe yazmak için. */
    code: string | null;
    /**
     * Çeviri anahtarı, hazır metin değil.
     *
     * Bu modül saf tutulabilsin diye çeviri burada yapılmaz: `t()` etkin dile
     * bağlıdır ve dil değişince yeniden çalışması gerekir. Anahtarı render
     * anında sayfa çevirir.
     */
    messageKey: TranslationKey;
}

const MESSAGE_KEYS: Record<string, TranslationKey> = {
    otp_expired: 'auth.callbackError.otpExpired',
    access_denied: 'auth.callbackError.accessDenied',
    provider_disabled: 'auth.callbackError.providerDisabled',
    provider_email_needs_verification: 'auth.callbackError.providerEmailNeedsVerification',
    signup_disabled: 'auth.callbackError.signupDisabled',
    email_exists: 'auth.callbackError.emailExists',
    validation_failed: 'auth.callbackError.validationFailed',
    bad_oauth_state: 'auth.callbackError.badOauthState',
    unexpected_failure: 'auth.callbackError.unexpectedFailure',
};

const FALLBACK: TranslationKey = 'auth.callbackError.fallback';

/**
 * @param search `window.location.search` (`?` ile başlayabilir)
 * @param hash   `window.location.hash` (`#` ile başlayabilir)
 * @returns Hata yoksa `null`.
 */
export function parseAuthCallbackError(search: string, hash: string): AuthCallbackError | null {
    // Sorgu dizesi önce okunur: PKCE akışı bugünkü varsayılan.
    const params = new URLSearchParams(search.replace(/^\?/, ''));
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''));

    const error = params.get('error') ?? hashParams.get('error');
    const errorCode = params.get('error_code') ?? hashParams.get('error_code');

    if (!error && !errorCode) return null;

    // `error_code` daha ayrıntılıdır (`otp_expired`), `error` daha geneldir
    // (`access_denied`); önce ayrıntılı olana bakılır.
    const code = errorCode ?? error;
    // `x && MESSAGE_KEYS[x]` yerine üçlü kullanılıyor: `&&` boş dizgede
    // dizginin kendisini döndürür ve sonuç tipi anahtar birliğinden taşardı.
    const messageKey =
        (errorCode ? MESSAGE_KEYS[errorCode] : undefined) ??
        (error ? MESSAGE_KEYS[error] : undefined) ??
        FALLBACK;

    return { code, messageKey };
}
