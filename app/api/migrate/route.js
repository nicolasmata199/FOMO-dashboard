export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '../../../lib/supabase'

export async function GET() {
  try {
    const admin = getSupabaseAdmin()

    // Test insert para ver el error exacto
    const { error: e1 } = await admin.from('datos_diarios').upsert({
      fecha: '2099-01-01',
      efectivo: 1,
      updated_at: new Date().toISOString()
    }, { onConflict: 'fecha' })

    const { error: e2 } = await admin.from('datos_diarios').upsert({
      fecha: '2099-01-02',
      efectivo: 1,
    }, { onConflict: 'fecha' })

    // Limpiar test rows
    await admin.from('datos_diarios').delete().in('fecha', ['2099-01-01','2099-01-02'])

    return Response.json({
      con_updated_at: e1 ? e1.message : 'OK',
      sin_updated_at: e2 ? e2.message : 'OK',
    })
  } catch (e) {
    return Response.json({ error: e.message })
  }
}
