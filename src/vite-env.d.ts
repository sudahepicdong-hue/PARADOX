/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_USERNAME_HASH?: string;
  readonly VITE_ADMIN_PASSWORD_HASH?: string;
  readonly VITE_TALENT_PASSWORD_HASH?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
