import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Понятная ошибка вместо «тихого» падения, если забыли .env
  console.error(
    'Не заданы переменные окружения VITE_SUPABASE_URL и/или VITE_SUPABASE_ANON_KEY. ' +
      'Создайте файл .env по образцу .env.example и перезапустите dev-сервер.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Сессия сохраняется в localStorage и подхватывается при обновлении страницы
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
