/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Supabase proje URL'i. Tanımlı değilse uygulama yalnızca yerel modda çalışır. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) anahtarı. RLS ile korunur, istemciye gömülmesi güvenlidir. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
