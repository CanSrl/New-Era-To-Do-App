import type { TranslationKey } from '../i18n';

/**
 * Supabase'in İngilizce hatasını bir çeviri anahtarına indirger.
 *
 * Önce kararlı `code` alanına bakar, o yoksa mesaj içeriğine düşer;
 * tanınmayan hatalar genel anahtara gider. Metne çevirme işi arayüze
 * bırakılır, böylece dil değiştiğinde ekrandaki hata da değişir.
 */
export function authErrorKey(error: { code?: string; message: string }): TranslationKey {
    switch (error.code) {
        case 'invalid_credentials':
            return 'auth.error.invalidCredentials';
        case 'user_already_exists':
        case 'email_exists':
            return 'auth.error.userAlreadyExists';
        case 'weak_password':
            return 'auth.error.weakPassword';
        case 'email_not_confirmed':
            return 'auth.error.emailNotConfirmed';
        case 'validation_failed':
            return 'auth.error.validationFailed';
        case 'over_email_send_rate_limit':
        case 'over_request_rate_limit':
            return 'auth.error.rateLimited';
        case 'signup_disabled':
            return 'auth.error.signupDisabled';
    }

    // Kod alanı Supabase sürümleri arasında her hata için dolmuyor; mesaj
    // içeriği kırılgan ama tek yedek.
    const message = error.message.toLowerCase();
    if (message.includes('invalid login credentials')) return 'auth.error.invalidCredentials';
    if (message.includes('already registered')) return 'auth.error.userAlreadyExists';
    if (message.includes('password should be at least')) return 'auth.error.weakPassword';
    if (message.includes('unable to validate email')) return 'auth.error.invalidEmail';
    if (message.includes('email not confirmed')) return 'auth.error.emailNotConfirmed';
    if (message.includes('failed to fetch') || message.includes('network')) {
        return 'auth.error.network';
    }

    return 'auth.error.unknown';
}
