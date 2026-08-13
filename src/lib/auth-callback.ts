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

export interface AuthCallbackError {
    /** Supabase'in kararlı hata kodu; bilinmeyen hatalarda günlüğe yazmak için. */
    code: string | null;
    /** Kullanıcıya gösterilebilir Türkçe mesaj. */
    message: string;
}

const MESSAGES: Record<string, string> = {
    otp_expired: 'Bağlantının süresi dolmuş. Lütfen yeni bir bağlantı isteyin.',
    access_denied: 'Giriş isteği onaylanmadı. İzin ekranında "Authorize" demeniz gerekiyor.',
    provider_disabled: 'Bu giriş yöntemi şu anda kapalı.',
    provider_email_needs_verification:
        'Sağlayıcıdaki e-posta adresiniz doğrulanmamış. Önce orada doğrulayıp tekrar deneyin.',
    signup_disabled: 'Yeni kayıtlar şu anda kapalı.',
    email_exists:
        'Bu e-posta adresi zaten parolayla kayıtlı. Parolanızla giriş yapıp hesapları birleştirebilirsiniz.',
    validation_failed: 'Giriş isteği geçersiz. Lütfen tekrar deneyin.',
    bad_oauth_state: 'Giriş isteği doğrulanamadı. Lütfen baştan deneyin.',
    unexpected_failure: 'Sağlayıcı tarafında bir sorun oluştu. Lütfen tekrar deneyin.',
};

const FALLBACK = 'Giriş tamamlanamadı. Lütfen tekrar deneyin.';

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
    const message =
        (errorCode && MESSAGES[errorCode]) ?? (error && MESSAGES[error]) ?? FALLBACK;

    return { code, message };
}
