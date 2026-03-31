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

export async function getCierreDataAction(fecha) {
  const sb = getSupabaseAdmin()

  // Obtener IDs de ventas del día
  const { data: ventasHoy, error: ev } = await sb
    .from('ventas')
    .select('id')
    .gte('fecha', fecha)
    .lte('fecha', fecha + 'T23:59:59')

  if (ev) return { error: ev.message }

  const ids = (ventasHoy || []).map(v => v.id)
  const esperado = {}

  if (ids.length > 0) {
    const { data: pags, error: ep } = await sb
      .from('pagos_venta')
      .select('forma_pago, monto_ars')
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

  const { error } = await sb.from('cierre_caja').upsert(
    {
      fecha,
      vendedora_id: vendedora_id || null,
      esperado_efectivo: esperado['efectivo_ars'] || 0,
      real_efectivo: parseFloat(real['efectivo_ars'] || '') || 0,
      confirmado: true,
    },
    { onConflict: 'fecha' }
  )

  if (error) return { error: error.message }
  return { ok: true }
}
