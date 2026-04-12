import { getSupabaseAdmin, getSupabase } from '../../../../../lib/supabase'
import { NextResponse } from 'next/server'

async function verificarAuth(req, rolesPermitidos) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return { error: 'No autorizado', status: 401 }

  const sbAnon = getSupabase()
  const { data: { user }, error: authError } = await sbAnon.auth.getUser(token)
  if (authError || !user) return { error: 'Sesión inválida', status: 401 }

  const sb = getSupabaseAdmin()
  const { data: usuarioFomo } = await sb.from('usuarios_fomo').select('id,rol,nombre').eq('id', user.id).single()
  if (!usuarioFomo) return { error: 'Usuario sin acceso', status: 403 }
  if (rolesPermitidos && !rolesPermitidos.includes(usuarioFomo.rol)) {
    return { error: 'Permiso insuficiente', status: 403 }
  }
  return { user, usuarioFomo, sb }
}

// PATCH /api/pos/venta/[id] — Editar datos de una venta (no modifica items ni total)
export async function PATCH(req, { params }) {
  try {
    const auth = await verificarAuth(req, ['encargada', 'dueno'])
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { sb, usuarioFomo } = auth

    const { id } = params
    const body = await req.json()
    const { vendedora_nombre, sucursal, notas } = body

    // Verificar que la venta existe y no está anulada
    const { data: venta, error: ev } = await sb.from('ventas').select('id,estado').eq('id', id).single()
    if (ev || !venta) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    if (venta.estado === 'anulada') return NextResponse.json({ error: 'No se puede editar una venta anulada' }, { status: 400 })

    const cambios = {}
    if (vendedora_nombre !== undefined) cambios.vendedora_nombre = vendedora_nombre
    if (sucursal !== undefined) cambios.sucursal = sucursal
    if (notas !== undefined) cambios.notas = notas

    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const { error: eu } = await sb.from('ventas').update(cambios).eq('id', id)
    if (eu) return NextResponse.json({ error: eu.message }, { status: 500 })

    // Historial
    await sb.from('movimientos_stock').insert({
      tipo: 'edicion_venta',
      descripcion: 'Edición de venta #' + id.slice(0, 8) + ' — ' + JSON.stringify(cambios),
      usuario_nombre: usuarioFomo.nombre,
      sucursal: sucursal || null,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/pos/venta/[id] — Anular venta (restaura stock)
export async function DELETE(req, { params }) {
  try {
    const auth = await verificarAuth(req, ['encargada', 'dueno'])
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { sb, usuarioFomo } = auth

    const { id } = params

    // Verificar que la venta existe
    const { data: venta, error: ev } = await sb.from('ventas').select('*').eq('id', id).single()
    if (ev || !venta) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
    if (venta.estado === 'anulada') return NextResponse.json({ error: 'La venta ya está anulada' }, { status: 400 })

    // Obtener detalles para restaurar stock
    const { data: detalles } = await sb.from('detalle_venta').select('*').eq('venta_id', id)

    // Restaurar stock por cada item
    for (const item of detalles || []) {
      if (item.tipo_producto === 'celular' && item.imei) {
        await sb.from('existencias')
          .update({ estado_stock: 'disponible' })
          .eq('imei', item.imei)
          .eq('estado_stock', 'vendido')
      } else if (item.tipo_producto === 'accesorio' && item.accesorio_id) {
        const { data: acc } = await sb.from('accesorios').select('stock_actual').eq('id', item.accesorio_id).single()
        if (acc !== null) {
          await sb.from('accesorios')
            .update({ stock_actual: (acc.stock_actual || 0) + item.cantidad })
            .eq('id', item.accesorio_id)
        }
      }
    }

    // Verificar si hubo plan canje — revertir (marcar celular ingresado como anulado o eliminarlo)
    const { data: pagos } = await sb.from('pagos_venta').select('*').eq('venta_id', id)
    for (const pago of pagos || []) {
      if (pago.forma_pago === 'plan_canje' && pago.canje_imei) {
        // Eliminar el celular en canje que se ingresó al stock
        await sb.from('existencias').delete().eq('imei', pago.canje_imei).eq('estado_stock', 'disponible')
      }
    }

    // Marcar venta como anulada
    const { error: ea } = await sb.from('ventas').update({ estado: 'anulada' }).eq('id', id)
    if (ea) return NextResponse.json({ error: ea.message }, { status: 500 })

    // Registrar en movimientos_stock
    await sb.from('movimientos_stock').insert({
      tipo: 'anulacion_venta',
      descripcion: 'Anulación de venta #' + id.slice(0, 8) + ' — ' + formatARS(venta.total_ars) + ' — ' + (venta.vendedora_nombre || ''),
      usuario_nombre: usuarioFomo.nombre,
      sucursal: venta.sucursal || null,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function formatARS(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-AR')
}
