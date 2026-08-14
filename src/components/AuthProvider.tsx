import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase, isSupabaseConfigured } from "../lib/supabase"
import type { TranslationKey } from "../i18n"
import { authErrorKey } from "../lib/auth-errors"

/**
 * `errorKey` bir çeviri anahtarıdır, hazır metin değil.
 *
 * Sağlayıcıdan gelen İngilizce hata bu katmanda anahtara indirgenir; metne
 * çevirme işi arayüze bırakılır. Böylece dil değiştiğinde ekrandaki hata da
 * değişir ve bu modül React'ten bağımsız kalır.
 */
type AuthResult = { errorKey: TranslationKey | null }

type SignUpResult = AuthResult & { needsEmailConfirmation: boolean }

type AuthProviderState = {
    session: Session | null
    user: User | null
    /** İlk oturum okuması tamamlanana kadar true. */
    isLoading: boolean
    /** Supabase yapılandırılmamışsa false; giriş arayüzü gizlenir. */
    isConfigured: boolean
    signUp: (email: string, password: string) => Promise<SignUpResult>
    signIn: (email: string, password: string) => Promise<AuthResult>
    /**
     * GitHub'a yönlendirir. Dönen `error: null` "yönlendirme başladı" demektir,
     * "giriş yapıldı" değil — başarılı durumda bu sayfadan ayrılınır ve sonucu
     * `/auth/callback` karşılar.
     *
     * Hata neredeyse hiç dönmez: sağlayıcı Supabase'de kapalıysa bile istemci
     * yönlendirmeyi yapar ve kullanıcı Supabase'in ham JSON hatasına düşer
     * (ölçüldü: `{"msg":"Unsupported provider: provider is not enabled"}`).
     * Bu yüzden buton `features.githubAuth` bayrağıyla korunuyor; bayrağı
     * sunucu tarafı yapılandırılmadan açmayın.
     */
    signInWithGitHub: () => Promise<AuthResult>
    signOut: () => Promise<AuthResult>
    resetPassword: (email: string) => Promise<AuthResult>
    /** Sıfırlama bağlantısıyla açılan oturumda yeni parola belirler. */
    updatePassword: (password: string) => Promise<AuthResult>
}

const NOT_CONFIGURED: AuthResult = { errorKey: "auth.error.notConfigured" }

const AuthProviderContext = createContext<AuthProviderState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(isSupabaseConfigured)

    useEffect(() => {
        if (!supabase) return

        let active = true

        supabase.auth.getSession().then(({ data }) => {
            if (!active) return
            setSession(data.session)
            setIsLoading(false)
        })

        const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
            setSession(next)
            setIsLoading(false)
        })

        return () => {
            active = false
            subscription.subscription.unsubscribe()
        }
    }, [])

    const value = useMemo<AuthProviderState>(() => ({
        session,
        user: session?.user ?? null,
        isLoading,
        isConfigured: isSupabaseConfigured,

        signUp: async (email, password) => {
            if (!supabase) return { ...NOT_CONFIGURED, needsEmailConfirmation: false }

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
            })
            if (error) {
                return { errorKey: authErrorKey(error), needsEmailConfirmation: false }
            }
            // Supabase, kayıtlı bir e-posta ile tekrar kayıt denendiğinde hesap
            // sızdırmamak için hata yerine boş `identities` dizisi döndürür.
            if (data.user && data.user.identities?.length === 0) {
                return {
                    errorKey: "auth.error.userAlreadyExists",
                    needsEmailConfirmation: false,
                }
            }
            return { errorKey: null, needsEmailConfirmation: data.session === null }
        },

        signIn: async (email, password) => {
            if (!supabase) return NOT_CONFIGURED

            const { error } = await supabase.auth.signInWithPassword({ email, password })
            return { errorKey: error ? authErrorKey(error) : null }
        },

        signInWithGitHub: async () => {
            if (!supabase) return NOT_CONFIGURED

            // E-posta bağlantılarıyla aynı adrese dönülür; adres Supabase'in
            // izin listesinde *tam eşleşme* olarak bulunmalı, yoksa istek
            // sessizce site_url'e düşer.
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'github',
                options: { redirectTo: `${window.location.origin}/auth/callback` },
            })
            return { errorKey: error ? authErrorKey(error) : null }
        },

        signOut: async () => {
            if (!supabase) return NOT_CONFIGURED

            const { error } = await supabase.auth.signOut()
            return { errorKey: error ? authErrorKey(error) : null }
        },

        resetPassword: async (email) => {
            if (!supabase) return NOT_CONFIGURED

            // Bağlantı doğrudan yeni parola ekranına düşer; Supabase oradaki
            // koddan oturumu kurar ve kullanıcı parolasını belirleyebilir.
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })
            return { errorKey: error ? authErrorKey(error) : null }
        },

        updatePassword: async (password) => {
            if (!supabase) return NOT_CONFIGURED

            const { error } = await supabase.auth.updateUser({ password })
            return { errorKey: error ? authErrorKey(error) : null }
        },
    }), [session, isLoading])

    return (
        <AuthProviderContext.Provider value={value}>
            {children}
        </AuthProviderContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthProviderContext)

    if (context === undefined)
        throw new Error("useAuth must be used within an AuthProvider")

    return context
}
