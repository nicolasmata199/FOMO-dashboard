export const dynamic = 'force-dynamic'
import { getSupabaseAdmin } from '../../../lib/supabase'

export async function GET() {
  const admin = getSupabaseAdmin()
  const hoy = new Date().toISOString().split('T')[0]

  const [dd, profiles, gastos] = await Promise.all([
    admin.from('datos_diarios').select('*').order('fecha', {ascending:false}).limit(10),
    admin.from('profiles').select('*'),
    admin.from('gastos').select('*').order('created_at', {ascending:false}).limit(5),
  ])

  return Response.json({
    hoy_utc: hoy,
    datos_diarios: dd.data,
    datos_error: dd.error?.message,
    profiles: profiles.data,
    gastos: gastos.data,
  })
}
