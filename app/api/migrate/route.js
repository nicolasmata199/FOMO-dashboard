export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '../../../lib/supabase'

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const [{ data: rows }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from('datos_diarios').select('id, usuario_nombre').is('usuario_id', null),
      supabaseAdmin.from('profiles').select('id, nombre'),
    ])

    if (!rows || rows.length === 0) return Response.json({ ok: true, msg: 'nada que migrar' })

    const results = []
    for (const row of rows) {
      const profile = profiles?.find(p => p.nombre === row.usuario_nombre) || profiles?.[0]
      if (!profile) continue
      const { error } = await supabaseAdmin
        .from('datos_diarios')
        .update({ usuario_id: profile.id })
        .eq('id', row.id)
      results.push({ id: row.id, usuario_nombre: row.usuario_nombre, asignado_a: profile.nombre, error: error?.message })
    }

    return Response.json({ ok: true, migrados: results.length, detalle: results })
  } catch (e) {
    return Response.json({ ok: false, error: e.message })
  }
}
