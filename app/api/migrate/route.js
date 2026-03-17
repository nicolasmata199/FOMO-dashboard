export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '../../../lib/supabase'

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: rows } = await supabaseAdmin
      .from('datos_diarios')
      .select('id, fecha, usuario_id, usuario_nombre, efectivo, transferencias, saldo_banco')
      .order('fecha', { ascending: false })
      .limit(30)

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, nombre')

    return Response.json({ rows, profiles })
  } catch (e) {
    return Response.json({ ok: false, error: e.message })
  }
}
