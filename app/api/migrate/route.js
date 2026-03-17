export const dynamic = 'force-dynamic'

import { getSupabase, getSupabaseAdmin } from '../../../lib/supabase'

export async function GET() {
  try {
    const admin = getSupabaseAdmin()
    const anon = getSupabase()

    const [r1, r2, r3, r4] = await Promise.all([
      admin.from('datos_diarios').select('id, fecha, usuario_nombre, efectivo').order('fecha', {ascending:false}).limit(5),
      admin.from('profiles').select('id, nombre'),
      anon.from('datos_diarios').select('id, fecha, usuario_nombre, efectivo').order('fecha', {ascending:false}).limit(5),
      anon.from('profiles').select('id, nombre'),
    ])

    return Response.json({
      admin: { datos_diarios: r1.data, datos_error: r1.error?.message, profiles: r2.data, profiles_error: r2.error?.message },
      anon:  { datos_diarios: r3.data, datos_error: r3.error?.message, profiles: r4.data, profiles_error: r4.error?.message },
      env: { url: !!process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey: !!process.env.SUPABASE_SERVICE_KEY, anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
    })
  } catch (e) {
    return Response.json({ ok: false, error: e.message })
  }
}
