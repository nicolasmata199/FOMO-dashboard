import { getSupabaseAdmin } from '../../../../lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { vendedora_id, vendedora_nombre, cliente_id, carrito, pagos, total_ars, total_base_ars, intereses_ars } = await req.json()
    const sb = getSupabaseAdmin()

    // 1. Insertar venta
    const { data: venta, error: e1 } = await sb
      .from('ventas')
      .insert({ fecha: new Date().toISOString(), cliente_id: cliente_id || null, vendedora_id, vendedora_nombre: vendedora_nombre || null, total_ars, total_base_ars: total_base_ars || total_ars, intereses_ars: intereses_ars || 0 })
      .select()
      .single()
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

    // 2. Insertar detalle_venta
    const detalles = carrito.map(item => ({
      venta_id: venta.id,
      tipo_producto: item._tipo,
      imei: item.imei || null,
      accesorio_id: item.accesorio_id || null,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio_unitario_ars: item.precio_unitario_ars,
      costo_unitario_ars: item.costo_unitario_ars,
    }))
    const { error: e2 } = await sb.from('detalle_venta').insert(detalles)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    // 3. Insertar pagos_venta
    const pagoRows = pagos
      .filter(p => (p.monto_ars || 0) > 0)
      .map(p => ({
        venta_id: venta.id,
        forma_pago: p.forma,
        monto_base_ars: p.monto_base_ars || p.monto_ars,
        monto_ars: p.monto_ars,
        intereses_ars: p.intereses_ars || 0,
        monto_usd: p.monto_usd || null,
      }))
    if (pagoRows.length > 0) {
      const { error: e3 } = await sb.from('pagos_venta').insert(pagoRows)
      if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })
    }

    // 4. Actualizar stock
    for (const item of carrito) {
      if (item._tipo === 'celular' && item.imei) {
        await sb.from('existencias').update({ estado_stock: 'vendido' }).eq('imei', item.imei)
      } else if (item._tipo === 'accesorio' && item.accesorio_id) {
        const { data: acc } = await sb
          .from('accesorios').select('stock_actual').eq('id', item.accesorio_id).single()
        if (acc) {
          await sb.from('accesorios')
            .update({ stock_actual: Math.max(0, (acc.stock_actual || 0) - item.cantidad) })
            .eq('id', item.accesorio_id)
        }
      }
    }

    return NextResponse.json({ id: venta.id, ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
