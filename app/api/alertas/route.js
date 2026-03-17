export const dynamic = 'force-dynamic'

import { getSupabaseAdmin } from '../../../lib/supabase'

function fmtPeso(n) {
  return 'ARS ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

async function enviarWsp(mensaje) {
  const apiKey = process.env.CALLMEBOT_API_KEY
  const numero = process.env.WHATSAPP_NUMERO
  if (!apiKey || !numero) return { ok: false, error: 'env vars faltantes' }
  const url = `https://api.callmebot.com/whatsapp.php?phone=${numero}&text=${encodeURIComponent(mensaje)}&apikey=${apiKey}`
  try {
    const res = await fetch(url)
    const text = await res.text()
    return { ok: res.ok, status: res.status, body: text.slice(0, 200) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

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
    const wspResults = []

    if (venc && venc.length > 0) {
      for (const v of venc) {
        const dias = Math.round((new Date(v.fecha) - hoy) / 86400000)
        const cuando = dias === 0 ? 'HOY' : dias === 1 ? 'MAÑANA' : `en ${dias} dias`
        const monto = fmtPeso(v.monto)
        const msg = `⚠️ FOMO: Vence ${cuando} - ${v.descripcion} - ${monto}`
        alertas.push(msg)
        const r = await enviarWsp(msg)
        wspResults.push(r)
      }
    }

    if (caja) {
      const cajaTotal = (caja.efectivo || 0) + (caja.transferencias || 0) + (caja.saldo_banco || 0)
      if (cajaTotal < 1000000) {
        const msg = `🚨 FOMO: Caja baja - ${fmtPeso(cajaTotal)} disponible`
        alertas.push(msg)
        const r = await enviarWsp(msg)
        wspResults.push(r)
      }
    }

    return Response.json({ ok: true, alertas, wspResults })
  } catch (e) {
    return Response.json({ ok: false, error: e.message })
  }
}
