export const dynamic = 'force-dynamic'
import { getSupabaseAdmin, getSupabase } from '../../../lib/supabase'

export async function GET() {
  const admin = getSupabaseAdmin()
  const anon = getSupabase()
  const hoy = new Date().toISOString().split('T')[0]

  const [adminDd, anonDd, anonDdReciente] = await Promise.all([
    admin.from('datos_diarios').select('id,fecha,efectivo,ventas_acumuladas_mes,usuario_id').order('fecha', {ascending:false}).limit(5),
    anon.from('datos_diarios').select('id,fecha,efectivo,ventas_acumuladas_mes').eq('fecha', hoy),
    anon.from('datos_diarios').select('id,fecha,efectivo,ventas_acumuladas_mes').order('fecha', {ascending:false}).limit(5),
  ])

  return Response.json({
    hoy_utc: hoy,
    admin_rows: adminDd.data,
    admin_error: adminDd.error?.message,
    anon_hoy: anonDd.data,
    anon_hoy_error: anonDd.error?.message,
    anon_reciente: anonDdReciente.data,
    anon_reciente_error: anonDdReciente.error?.message,
  })
}
