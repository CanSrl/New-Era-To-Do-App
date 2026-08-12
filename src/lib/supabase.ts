import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/**
 * Uygulama local-first çalışır: Supabase yapılandırılmamışsa giriş ve
 * senkronizasyon özellikleri kapanır, geri kalan her şey LocalStorage
 * üzerinden çalışmaya devam eder. Bu yüzden istemci `null` olabilir ve
 * çağrı yapan taraf bunu kontrol etmek zorundadır.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
    ? createClient<Database>(url!, anonKey!, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            // E-posta doğrulama / parola sıfırlama bağlantılarından dönen
            // oturumun URL'den okunabilmesi için gerekli.
            detectSessionInUrl: true,
            flowType: 'pkce',
            storageKey: 'yapilacaklar-auth',
        },
    })
    : null;
