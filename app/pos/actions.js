'use server'
import { getSupabaseAdmin } from '../../lib/supabase'

// ─── Clientes ─────────────────────────────────────────────────────────────────

export async function crearClienteAction({ dni, nombre, apellido, celular }) {
  const sb = getSupabaseAdmin()
  const { data, error } = await sb
    .from('clientes')
    .insert([{ dni: dni || null, nombre, apellido, celular: celular || null }])
    .select()
    .single()
  if (error) return { error: error.message }
  return { data }
}

// ─── Cierre de caja ───────────────────────────────────────────────────────────

export async function getCierreDataAction(fecha, vendedora_id) {
  const sb = getSupabaseAdmin()
  let query = sb.from('ventas').select('id').eq('fecha', fecha)
  if (vendedora_id) query = query.eq('vendedora_id', vendedora_id)
  const { data: ventasHoy, error: ev } = await query
  if (ev) return { error: ev.message }
  const ids = (ventasHoy || []).map(v => v.id)
  const esperado = {}
  if (ids.length > 0) {
    const { data: pags, error: ep } = await sb
      .from('pagos_venta').select('forma_pago, monto_ars')
      .in('venta_id', ids)
    if (ep) return { error: ep.message }
    ;(pags || []).forEach(p => {
      esperado[p.forma_pago] = (esperado[p.forma_pago] || 0) + (p.monto_ars || 0)
    })
  }
  return { data: esperado }
}

export async function guardarCierreAction({ fecha, vendedora_id, esperado, real }) {
  const sb = getSupabaseAdmin()
  const formas = Object.keys(esperado)
  const row = {
    fecha,
    vendedora_id: vendedora_id || null,
    confirmado: true,
    total_esperado: Object.values(esperado).reduce((a, b) => a + b, 0),
    total_real: formas.reduce((a, k) => a + (parseFloat(real[k] || '') || 0), 0),
    detalle_esperado: esperado,
    detalle_real: real,
    diferencia: formas.reduce((a, k) => {
      const r = parseFloat(real[k] || '')
      return r ? a + (r - (esperado[k] || 0)) : a
    }, 0),
  }
  const { error } = await sb.from('cierre_caja').upsert(row, { onConflict: 'vendedora_id,fecha' })
  if (error) return { error: error.message }
  return { ok: true }
}
