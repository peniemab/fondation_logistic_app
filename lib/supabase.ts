import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false, // DESACTIVE la mémoire à long terme
      autoRefreshToken: false, // Empêche de rester connecté indéfiniment
    }
  }
)