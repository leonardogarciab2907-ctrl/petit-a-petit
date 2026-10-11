// Endereço e chave pública do projeto Supabase. A chave "publishable/anon" é feita para
// ficar no app: quem protege os dados é o Row Level Security (supabase/schema.sql).
// Vazio = o app funciona só no aparelho, sem login.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? '';
