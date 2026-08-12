import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase, isSupabaseConfigured } from "../lib/supabase"

type AuthResult = { error: string | null }

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
    signOut: () => Promise<AuthResult>
    resetPassword: (email: string) => Promise<AuthResult>
}

const NOT_CONFIGURED: AuthResult = {
    error: "Bulut senkronizasyonu bu kurulumda yapılandırılmamış.",
}

const AuthProviderContext = createContext<AuthProviderState | undefined>(undefined)

/**
 * Supabase'in İngilizce hata metinlerini kullanıcıya gösterilebilir Türkçe
 * karşılıklarına çevirir. Önce kararlı `code` alanına, o yoksa mesaj
 * içeriğine bakar; tanınmayan hatalar için genel bir mesaj döner.
 */
function translateAuthError(error: { code?: string; message: string }): string {
    switch (error.code) {
        case "invalid_credentials":
            return "E-posta veya parola hatalı."
        case "user_already_exists":
        case "email_exists":
            return "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin."
        case "weak_password":
            return "Parola çok zayıf. En az 6 karakter kullanın."
        case "email_not_confirmed":
            return "E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu kontrol edin."
        case "validation_failed":
            return "Girdiğiniz bilgiler geçersiz. Lütfen kontrol edin."
        case "over_email_send_rate_limit":
        case "over_request_rate_limit":
            return "Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin."
        case "signup_disabled":
            return "Yeni kayıtlar şu anda kapalı."
    }

    const message = error.message.toLowerCase()
    if (message.includes("invalid login credentials")) return "E-posta veya parola hatalı."
    if (message.includes("already registered")) return "Bu e-posta adresi zaten kayıtlı."
    if (message.includes("password should be at least")) return "Parola en az 6 karakter olmalı."
    if (message.includes("unable to validate email")) return "Geçersiz e-posta adresi."
    if (message.includes("email not confirmed")) return "E-posta adresiniz henüz doğrulanmamış."
    if (message.includes("failed to fetch") || message.includes("network")) {
        return "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin."
    }

    return "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin."
}

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
                options: { emailRedirectTo: window.location.origin },
            })
            if (error) {
                return { error: translateAuthError(error), needsEmailConfirmation: false }
            }
            // Supabase, kayıtlı bir e-posta ile tekrar kayıt denendiğinde hesap
            // sızdırmamak için hata yerine boş `identities` dizisi döndürür.
            if (data.user && data.user.identities?.length === 0) {
                return {
                    error: "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.",
                    needsEmailConfirmation: false,
                }
            }
            return { error: null, needsEmailConfirmation: data.session === null }
        },

        signIn: async (email, password) => {
            if (!supabase) return NOT_CONFIGURED

            const { error } = await supabase.auth.signInWithPassword({ email, password })
            return { error: error ? translateAuthError(error) : null }
        },

        signOut: async () => {
            if (!supabase) return NOT_CONFIGURED

            const { error } = await supabase.auth.signOut()
            return { error: error ? translateAuthError(error) : null }
        },

        resetPassword: async (email) => {
            if (!supabase) return NOT_CONFIGURED

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            })
            return { error: error ? translateAuthError(error) : null }
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
