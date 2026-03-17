import { createClient } from '@supabase/supabase-js'

export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
}

export async function enviarAlertaWhatsapp(mensaje) {
  const apiKey = process.env.CALLMEBOT_API_KEY
  const numero = process.env.WHATSAPP_NUMERO
  if (!apiKey || !numero) return
  const url = `https://api.callmebot.com/whatsapp.php?phone=${numero}&text=${encodeURIComponent(mensaje)}&apikey=${apiKey}`
  await fetch(url).catch(() => {})
}
