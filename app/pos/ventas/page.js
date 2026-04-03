'use client'
import { useState, useEffect } from 'react'
import { getSupabase } from '../../../lib/supabase'

const sb = getSupabase()

const C = {
  bg:'#030712', bg2:'#0d1117', bg3:'#161b22', bg4:'#21262d',
  accent:'#FFD700', text:'#f0f6fc', text2:'#8b949e',
  border:'rgba(255,255,255,0.08)', green:'#3fb950', red:'#f85149',
  blue:'#58a6ff'
}

const SUCURSALES = ['695', '642', 'sanjuan', 'redes']
const SUCURSAL_LABEL = { '695':'Córdoba 695', '642':'Córdoba 642', 'sanjuan':'San Juan', 'redes':'Redes' }

function formatARS(n) {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

function BarraProgreso({ actual, objetivo }) {
  const pct = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0
  const c = pct >= 100 ? C.green : pct >= 70 ? C.accent : C.red
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.text2, marginBottom:3 }}>
        <span>{actual} / {objetivo}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div style={{ background:C.bg4, borderRadius:4, height:6 }}>
        <div style={{ width:`${pct}%`, background:c, borderRadius:4, height:6, transition:'width .3s' }}/>
      </div>
    </div>
  )
}

export default function VentasDashboard() {
  const [ventas, setVentas] = useState({})
  const [objetivos, setObjetivos] = useState([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('hoy') // hoy | mes
  const [usuario, setUsuario] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [cierres, setCierres] = useState([])
  const [usuariosCierre, setUsuariosCierre] = useState([])
  const [detallesVenta, setDetallesVenta] = useState([])
  const [pagosVenta, setPagosVenta] = useState([])

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/pos/login'; return }
      sb.from('usuarios_fomo').select('*').eq('id', session.user.id).single()
        .then(({ data }) => {
          if (!data) { window.location.href = '/pos/login'; return }
          if (data.rol === 'vendedora') { window.location.href = '/pos'; return }
          setUsuario(data)
          setCheckingAuth(false)
        })
    })
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [fecha]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarDatos() {
    setLoading(true)
    const mes = fecha.slice(0,7)

    const [{ data: ventasHoy }, { data: ventasMes }, { data: obj }, { data: cierresHoy, error: cierresError }] = await Promise.all([
      sb.from('ventas').select('*').eq('fecha', fecha),
      sb.from('ventas').select('*').gte('fecha', mes+'-01').lte('fecha', mes+'-31'),
      sb.from('objetivos').select('*').eq('mes', mes),
      sb.from('cierre_caja').select('*').eq('fecha', fecha)
    ])

    setVentas({ hoy: ventasHoy || [], mes: ventasMes || [] })
    const todosIds = [...(ventasHoy||[]), ...(ventasMes||[])].map(v => v.id)
    if (todosIds.length > 0) {
      const { data: detalles } = await sb.from('detalle_venta').select('*').in('venta_id', todosIds)
      const { data: pagos } = await sb.from('pagos_venta').select('*').in('venta_id', todosIds)
      setDetallesVenta(detalles || [])
      setPagosVenta(pagos || [])
    }
    setObjetivos(obj || [])
    console.log('FOMO-CIERRES', fecha, cierresHoy, cierresError)
    setCierres(cierresHoy || [])
    const vendedoraIds = (cierresHoy || []).map(c => c.vendedora_id).filter(Boolean)
    if (vendedoraIds.length > 0) {
      const { data: usrs } = await sb.from('usuarios_fomo').select('id, nombre, sucursal').in('id', vendedoraIds)
      setUsuariosCierre(usrs || [])
    }
    setLoading(false)
  }

  const ventasActivas = tab === 'hoy' ? ventas.hoy || [] : ventas.mes || []

  // Agrupar por vendedora
  const porVendedora = {}
  ventasActivas.forEach(v => {
    const key = v.vendedora_id
    if (!porVendedora[key]) porVendedora[key] = {
      nombre: v.vendedora_nombre || 'Sin nombre',
      sucursal: v.sucursal,
      celulares: 0, accesorios_monto: 0, celulares_monto: 0,
      total: 0, descuentos: 0, ventas: []
    }
    const d = porVendedora[key]
    detallesVenta.filter(det => det.venta_id === v.id).forEach(item => {
      const precio = item.precio_unitario_ars * item.cantidad
      const original = item.precio_original_ars ? item.precio_original_ars * item.cantidad : precio
      porVendedora[key].descuentos += original - precio
      if (item.tipo_producto === 'celular') {
        porVendedora[key].celulares += item.cantidad
        porVendedora[key].celulares_monto += precio
      } else {
        porVendedora[key].accesorios_monto += precio
      }
      porVendedora[key].total += precio
    })
    d.ventas.push(v)
  })

  // Agrupar por sucursal
  const porSucursal = {}
  SUCURSALES.forEach(s => {
    porSucursal[s] = { fundas: 0, templados: 0, total: 0 }
  })
  ventasActivas.forEach(v => {
    const s = v.sucursal
    if (!porSucursal[s]) porSucursal[s] = { fundas: 0, templados: 0, total: 0 }
    detallesVenta.filter(det => det.venta_id === v.id).forEach(item => {
      const desc = (item.descripcion || '').toLowerCase()
      if (desc.includes('funda')) porSucursal[s].fundas += item.cantidad
      if (desc.includes('templado')) porSucursal[s].templados += item.cantidad
      porSucursal[s].total += item.precio_unitario_ars * item.cantidad
    })
  })

  // Objetivos helpers
  function getObj(sucursal, tipo) {
    const o = objetivos.find(x => x.sucursal === sucursal && x.tipo === tipo)
    return o?.valor || 0
  }

  const estiloTab = (t) => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600,
    background: tab === t ? C.accent : C.bg3,
    color: tab === t ? '#000' : C.text2
  })

  if (checkingAuth) return <div style={{ background:'#030712', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#FFD700', fontFamily:"'Syne',sans-serif", fontSize:18 }}>Cargando...</div>

  return (
    <div style={{ background:C.bg, minHeight:'100vh', padding:'20px 16px', color:C.text, fontFamily:"'DM Mono', monospace", maxWidth:480, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ fontFamily:"'Syne', sans-serif", fontSize:20, fontWeight:800, color:C.accent }}>
          FOMO OS <span style={{ fontSize:13, color:C.text2, fontWeight:400 }}>· Ventas</span>
        </div>
        <a href="/pos" style={{ fontSize:12, color:C.text2, textDecoration:'none' }}>← POS</a>
      </div>

      {/* Selector fecha */}
      <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
        style={{ width:'100%', background:C.bg3, border:`1px solid ${C.border}`, borderRadius:8,
          padding:'10px 12px', color:C.text, fontSize:14, marginBottom:16, outline:'none',
          fontFamily:"'DM Mono', monospace" }}
      />

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <button style={estiloTab('hoy')} onClick={() => setTab('hoy')}>Hoy</button>
        <button style={estiloTab('mes')} onClick={() => setTab('mes')}>Este mes</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', color:C.text2, paddingTop:60 }}>Cargando...</div>
      ) : (
        <>
          {/* SECCIÓN: Por sucursal */}
          <div style={{ fontSize:11, color:C.text2, letterSpacing:'.05em', marginBottom:10 }}>OBJETIVOS POR SUCURSAL</div>
          {SUCURSALES.map(s => {
            const d = porSucursal[s]
            const objFundas = tab === 'hoy' ? getObj(s,'fundas_dia') : getObj(s,'fundas_dia') * 30
            const objTemplados = tab === 'hoy' ? getObj(s,'templados_dia') : getObj(s,'templados_dia') * 30
            return (
              <div key={s} style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:8 }}>{SUCURSAL_LABEL[s]}</div>
                <div style={{ fontSize:12, color:C.text2, marginBottom:4 }}>Fundas</div>
                <BarraProgreso actual={d.fundas} objetivo={objFundas}/>
                <div style={{ fontSize:12, color:C.text2, marginBottom:4, marginTop:8 }}>Templados</div>
                <BarraProgreso actual={d.templados} objetivo={objTemplados}/>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, fontSize:12 }}>
                  <span style={{ color:C.text2 }}>Total vendido</span>
                  <span style={{ color:C.accent, fontWeight:700 }}>{formatARS(d.total)}</span>
                </div>
              </div>
            )
          })}

          {/* SECCIÓN: Por vendedora */}
          <div style={{ fontSize:11, color:C.text2, letterSpacing:'.05em', marginBottom:10, marginTop:20 }}>RANKING VENDEDORAS</div>
          {Object.entries(porVendedora)
            .sort((a,b) => b[1].accesorios_monto - a[1].accesorios_monto)
            .map(([id, d]) => {
              const objCelulares = tab === 'hoy' ? 1 : getObj('individual','celulares_mes') || 25
              return (
                <div key={id} style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{d.nombre}</div>
                      <div style={{ fontSize:11, color:C.text2 }}>{SUCURSAL_LABEL[d.sucursal] || d.sucursal}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:16, fontWeight:700, color:C.accent }}>{formatARS(d.total)}</div>
                      <div style={{ fontSize:11, color:C.text2 }}>{d.ventas.length} ventas</div>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                    <div style={{ flex:1, background:C.bg4, borderRadius:8, padding:'8px 10px' }}>
                      <div style={{ fontSize:11, color:C.text2 }}>Accesorios</div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.green }}>{formatARS(d.accesorios_monto)}</div>
                    </div>
                    <div style={{ flex:1, background:C.bg4, borderRadius:8, padding:'8px 10px' }}>
                      <div style={{ fontSize:11, color:C.text2 }}>Celulares</div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.blue }}>{formatARS(d.celulares_monto)}</div>
                    </div>
                  </div>

                  <div style={{ fontSize:12, color:C.text2, marginBottom:4 }}>Celulares vendidos (objetivo: {objCelulares === 1 ? '—' : objCelulares})</div>
                  {tab === 'mes' && <BarraProgreso actual={d.celulares} objetivo={objCelulares}/>}
                  {tab === 'hoy' && <div style={{ fontSize:13, fontWeight:700 }}>{d.celulares} unidades hoy</div>}

                  {d.descuentos > 0 && (
                    <div style={{ marginTop:8, fontSize:11, color:C.red }}>
                      Descuentos otorgados: {formatARS(d.descuentos)}
                    </div>
                  )}
                </div>
              )
            })}

          {Object.keys(porVendedora).length === 0 && (
            <div style={{ textAlign:'center', color:C.text2, padding:'40px 0', fontSize:13 }}>
              Sin ventas registradas
            </div>
          )}

          {/* SECCIÓN: Cierres de caja */}
          <div style={{ fontSize:11, color:C.text2, letterSpacing:'.05em', marginBottom:10, marginTop:24 }}>CIERRES DE CAJA — HOY</div>
          {cierres.length === 0 ? (
            <div style={{ textAlign:'center', color:C.text2, padding:'20px 0', fontSize:13 }}>Sin cierres registrados hoy</div>
          ) : (
            cierres.map(c => {
              const detEsp = c.detalle_esperado || {}
              const detReal = c.detalle_real || {}
              const diff = c.diferencia || 0
              const formas = Object.keys(detEsp)
              return (
                <div key={c.id} style={{ background:C.bg3, border:`1px solid ${diff < 0 ? C.red : diff > 0 ? C.accent : C.border}`, borderRadius:10, padding:'12px 14px', marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{usuariosCierre.find(u => u.id === c.vendedora_id)?.nombre || 'Sin nombre'}</div>
                      <div style={{ fontSize:11, color:C.text2 }}>{SUCURSAL_LABEL[usuariosCierre.find(u => u.id === c.vendedora_id)?.sucursal] || usuariosCierre.find(u => u.id === c.vendedora_id)?.sucursal}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:13, color:C.text2 }}>Total esperado</div>
                      <div style={{ fontSize:16, fontWeight:700, color:C.accent }}>{formatARS(c.total_esperado || 0)}</div>
                    </div>
                  </div>
                  <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
                    {formas.map(forma => {
                      const esp = detEsp[forma] || 0
                      const real = parseFloat(detReal[forma] || 0)
                      const dif = real - esp
                      const fp = forma.replace('_',' ').replace('ars','ARS')
                      return (
                        <div key={forma} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                          <span style={{ color:C.text2, textTransform:'capitalize' }}>{fp}</span>
                          <span>
                            <span style={{ color:C.text2 }}>{formatARS(esp)}</span>
                            {real > 0 && <span style={{ color: dif < 0 ? C.red : dif > 0 ? C.green : C.text2, marginLeft:8 }}>
                              Real: {formatARS(real)} {dif !== 0 ? `(${dif > 0 ? '+' : ''}${formatARS(dif)})` : '✓'}
                            </span>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {diff !== 0 && (
                    <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700 }}>
                      <span>Diferencia total</span>
                      <span style={{ color: diff < 0 ? C.red : C.green }}>{diff > 0 ? '+' : ''}{formatARS(diff)}</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </>
      )}
    </div>
  )
}
