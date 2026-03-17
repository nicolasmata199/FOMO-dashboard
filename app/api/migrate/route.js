export const dynamic = 'force-dynamic'

import { getSupabase, getSupabaseAdmin } from '../../../lib/supabase'

export async function GET(request) {
  try {
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return Response.json({ ok: false, error: 'no autenticado' })

    const userId = session.user.id
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error, count } = await supabaseAdmin
      .from('datos_diarios')
      .update({ usuario_id: userId })
      .is('usuario_id', null)
      .select()

    if (error) return Response.json({ ok: false, error: error.message })

    return Response.json({ ok: true, rowsUpdated: data?.length ?? 0, userId })
  } catch (e) {
    return Response.json({ ok: false, error: e.message })
  }
}
