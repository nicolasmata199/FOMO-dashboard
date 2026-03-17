export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '../../../lib/supabase'

export async function GET() {
  try {
    const admin = getSupabaseAdmin()

    // Test upsert con el nuevo índice
    const { error } = await admin.from('datos_diarios').upsert({
      fecha: '2099-01-01',
      efectivo: 99,
      usuario_id: null,
    }, { onConflict: 'fecha,usuario_id' })

    // Limpiar
    await admin.from('datos_diarios').delete().eq('fecha', '2099-01-01')

    return Response.json({ upsert_test: error ? error.message : 'OK — constraint funciona' })
  } catch (e) {
    return Response.json({ error: e.message })
  }
}
