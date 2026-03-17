import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function logHistorial(tabla, accion, descripcion, usuarioNombre) {
  await supabase.from('historial').insert({
    tabla, accion, descripcion, usuario_nombre: usuarioNombre
  })
}

export async function enviarAlertaWhatsapp(mensaje) {
  const apiKey = process.env.CALLMEBOT_API_KEY
  const numero = process.env.WHATSAPP_NUMERO
  if (!apiKey || !numero) return
  const url = `https://api.callmebot.com/whatsapp.php?phone=${numero}&text=${encodeURIComponent(mensaje)}&apikey=${apiKey}`
  await fetch(url).catch(() => {})
}
