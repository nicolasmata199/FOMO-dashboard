export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '../../../lib/supabase'

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const hoy = new Date()
    const en3dias = new Date(hoy)
    en3dias.setDate(hoy.getDate() + 3)
    const fechaHoy = hoy.toISOString().split('T')[0]
    const fecha3d = en3dias.toISOString().split('T')[0]

    const { data: venc } = await supabaseAdmin
      .from('vencimientos')
      .select('*')
      .eq('pagado', false)
      .gte('fecha', fechaHoy)
      .lte('fecha', fecha3d)
      .order('fecha')

    const { data: caja } = await supabaseAdmin
      .from('datos_diarios')
      .select('*')
      .eq('fecha', fechaHoy)
      .single()

    const alertas = []

    if (venc && venc.length > 0) {
      for (const v of venc) {
        const dias = Math.round((new Date(v.fecha) - hoy) / 86400000)
        const cuando = dias === 0 ? 'HOY' : dias === 1 ? 'MAÑANA' : `en ${dias} dias`
        const monto = '$' + Math.round(v.monto).toLocaleString('es-AR')
        alertas.push(`⚠️ FOMO ALERTA: Vence ${cuando} - ${v.descripcion} - ${monto}`)
      }
    }

    if (caja) {
      const cajaTotal = (caja.efectivo || 0) + (caja.transferencias || 0) + (caja.saldo_banco || 0)
      if (cajaTotal < 1000000) {
        alertas.push(`🚨 FOMO ALERTA: Caja baja - $${Math.round(cajaTotal).toLocaleString('es-AR')} disponible`)
      }
    }

    return Response.json({ ok: true, alertas })
  } catch (e) {
    return Response.json({ ok: false, error: e.message })
  }
}
