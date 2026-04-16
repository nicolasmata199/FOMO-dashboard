'use client'
import { useState, useEffect } from 'react'
import { getSupabase } from '../../../lib/supabase'

const sb = getSupabase()

const C = {
  bg:'#030712', bg2:'#0d1117', bg3:'#161b22', bg4:'#21262d',
  accent:'#FFD700', text:'#f0f6fc', text2:'#8b949e',
  border:'rgba(255,255,255,0.08)', green:'#3fb950', red:'#f85149',
  blue:'#58a6ff', orange:'#f0883e'
}

const SUCURSALES = ['695', '642', 'sanjuan', 'redes']
const SUCURSAL_LABEL = { '695':'Córdoba 695', '642':'Córdoba 642', 'sanjuan':'San Juan', 'redes':'Redes' }
const FORMA_LABEL = {
  efectivo:'Efectivo', transferencia:'Transferencia', tarjeta:'Tarjeta',
  qr:'QR', usd:'USD', plan_canje:'Plan Canje', debito:'Débito', cheque:'Cheque'
}

function formatARS(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-AR')
}

function BarraProgreso({ actual, objetivo }) {
  const pct = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0
  const c = pct >= 100 ? C.green : pct >= 70 ? C.accent : C.red
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:C.text2, marginBottom:3 }}>
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
  const [tab, setTab] = useState('hoy')
  const [usuario, setUsuario] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [cierres, setCierres] = useState([])
  const [usuariosCierre, setUsuariosCierre] = useState([])
  const [detallesVenta, setDetallesVenta] = useState([])
  const [pagosVenta, setPagosVenta] = useState([])
  const [token, setToken] = useState(null)

  // UI estado para detalle / anular / editar
  const [ventaAbierta, setVentaAbierta] = useState(null) // id de venta expandida
  const [modalAnular, setModalAnular] = useState(null)   // venta a anular
  const [modalEditar, setModalEditar] = useState(null)   // venta a editar
  const [editForm, setEditForm] = useState({ vendedora_nombre:'', sucursal:'', notas:'' })
  const [procesando, setProcesando] = useState(false)
  const [msgGlobal, setMsgGlobal] = useState('')

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/pos/login'; return }
      setToken(session.access_token)
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
    if (!checkingAuth) cargarDatos()
  }, [fecha, checkingAuth]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarDatos() {
    setLoading(true)
    const mes = fecha.slice(0,7)
    const [anio, mesNum] = mes.split('-').map(Number)
    const ultimoDia = new Date(anio, mesNum, 0).getDate()
    const fechaFin = `${mes}-${String(ultimoDia).padStart(2,'0')}`

    const [{ data: ventasHoy }, { data: ventasMes }, { data: obj }, { data: cierresHoy }] = await Promise.all([
      sb.from('ventas').select('*').eq('fecha', fecha).order('hora', { ascending: false }),
      sb.from('ventas').select('*').gte('fecha', mes+'-01').lte('fecha', fechaFin).order('fecha', { ascending: false }),
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
    } else {
      setDetallesVenta([])
      setPagosVenta([])
    }
    setObjetivos(obj || [])
    setCierres(cierresHoy || [])
    const vendedoraIds = (cierresHoy || []).map(c => c.vendedora_id).filter(Boolean)
    if (vendedoraIds.length > 0) {
      const { data: usrs } = await sb.from('usuarios_fomo').select('id, nombre, sucursal').in('id', vendedoraIds)
      setUsuariosCierre(usrs || [])
    }
    setLoading(false)
  }

  async function anularVenta() {
    if (!modalAnular || !token) return
    setProcesando(true)
    try {
      const res = await fetch('/api/pos/venta/' + modalAnular.id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      })
      const json = await res.json()
      if (!res.ok) { setMsgGlobal('Error: ' + json.error); return }
      setMsgGlobal('Venta anulada correctamente')
      setModalAnular(null)
      cargarDatos()
    } catch (e) {
      setMsgGlobal('Error: ' + e.message)
    } finally {
      setProcesando(false)
    }
  }

  async function editarVenta() {
    if (!modalEditar || !token) return
    setProcesando(true)
    try {
      const res = await fetch('/api/pos/venta/' + modalEditar.id, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      const json = await res.json()
      if (!res.ok) { setMsgGlobal('Error: ' + json.error); return }
      setMsgGlobal('Venta actualizada')
      setModalEditar(null)
      cargarDatos()
    } catch (e) {
      setMsgGlobal('Error: ' + e.message)
    } finally {
      setProcesando(false)
    }
  }

  function abrirEditar(v) {
    setEditForm({ vendedora_nombre: v.vendedora_nombre || '', sucursal: v.sucursal || '', notas: v.notas || '' })
    setModalEditar(v)
  }

  const ventasActivas = (tab === 'hoy' ? ventas.hoy : ventas.mes) || []

  // Agrupar por vendedora
  const porVendedora = {}
  ventasActivas.forEach(v => {
    if (v.estado === 'anulada') return
    const key = v.vendedora_id
    if (!porVendedora[key]) porVendedora[key] = {
      nombre: v.vendedora_nombre || 'Sin nombre',
      sucursal: v.sucursal,
      celulares: 0, accesorios_monto: 0, celulares_monto: 0,
      total: 0, descuentos: 0, ventas: []
    }
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
    porVendedora[key].ventas.push(v)
  })

  // Agrupar por sucursal (excluye anuladas)
  const porSucursal = {}
  SUCURSALES.forEach(s => { porSucursal[s] = { fundas: 0, templados: 0, total: 0 } })
  ventasActivas.forEach(v => {
    if (v.estado === 'anulada') return
    const s = v.sucursal
    if (!porSucursal[s]) porSucursal[s] = { fundas: 0, templados: 0, total: 0 }
    detallesVenta.filter(det => det.venta_id === v.id).forEach(item => {
      const desc = (item.descripcion || '').toLowerCase()
      if (desc.includes('funda')) porSucursal[s].fundas += item.cantidad
      if (desc.includes('templado')) porSucursal[s].templados += item.cantidad
      porSucursal[s].total += item.precio_unitario_ars * item.cantidad
    })
  })

  function getObj(sucursal, tipo) {
    const o = objetivos.find(x => x.sucursal === sucursal && x.tipo === tipo)
    return o?.valor || 0
  }

  const estiloTab = (t) => ({
    padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontFamily: "'Inter', system-ui, sans-serif", fontSize: 15, fontWeight: 600,
    background: tab === t ? C.accent : C.bg3,
    color: tab === t ? '#000' : C.text2
  })

  const inputStyle = {
    width: '100%', background: C.bg4, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '10px 12px', color: C.text, fontSize: 15, outline: 'none',
    fontFamily: "'Inter', system-ui, sans-serif", boxSizing: 'border-box'
  }

  if (checkingAuth) return <div style={{ background:'#030712', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#FFD700', fontFamily:"'Syne',sans-serif", fontSize:18 }}>Cargando...</div>

  return (
    <div style={{ background:C.bg, minHeight:'100vh', padding:'20px 16px', color:C.text, fontFamily:"'Inter', system-ui, sans-serif", maxWidth:1200, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ fontFamily:"'Syne', sans-serif", fontSize:20, fontWeight:800, color:C.accent }}>
          FOMO OS <span style={{ fontSize:13, color:C.text2, fontWeight:400 }}>· Ventas</span>
        </div>
        <a href="/pos" style={{ fontSize:12, color:C.text2, textDecoration:'none' }}>← POS</a>
      </div>

      {/* Mensaje global */}
      {msgGlobal && (
        <div style={{ background: msgGlobal.startsWith('Error') ? C.red : C.green, color:'#fff',
          borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, display:'flex', justifyContent:'space-between' }}>
          <span>{msgGlobal}</span>
          <button onClick={() => setMsgGlobal('')} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:16 }}>×</button>
        </div>
      )}

      {/* Selector fecha */}
      <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
        style={{ width:'100%', background:C.bg3, border:`1px solid ${C.border}`, borderRadius:8,
          padding:'10px 12px', color:C.text, fontSize:14, marginBottom:16, outline:'none',
          fontFamily:"'Inter', system-ui, sans-serif" }}
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

          {/* SECCIÓN: Lista de ventas individuales */}
          <div style={{ fontSize:11, color:C.text2, letterSpacing:'.05em', marginBottom:10, marginTop:24 }}>VENTAS INDIVIDUALES</div>
          {ventasActivas.length === 0 && (
            <div style={{ textAlign:'center', color:C.text2, padding:'20px 0', fontSize:13 }}>Sin ventas</div>
          )}
          {ventasActivas.map(v => {
            const anulada = v.estado === 'anulada'
            const dets = detallesVenta.filter(d => d.venta_id === v.id)
            const pags = pagosVenta.filter(p => p.venta_id === v.id)
            const abierta = ventaAbierta === v.id
            return (
              <div key={v.id} style={{
                background: anulada ? C.bg2 : C.bg3,
                border: `1px solid ${anulada ? C.red + '44' : C.border}`,
                borderRadius:10, marginBottom:8, overflow:'hidden',
                opacity: anulada ? 0.6 : 1
              }}>
                {/* Cabecera de venta */}
                <div
                  onClick={() => setVentaAbierta(abierta ? null : v.id)}
                  style={{ padding:'12px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                >
                  <div>
                    <div style={{ fontSize:13, fontWeight:700 }}>
                      {v.vendedora_nombre || 'Sin nombre'}
                      {anulada && <span style={{ marginLeft:8, fontSize:11, color:C.red, background:C.red+'22', padding:'2px 6px', borderRadius:4 }}>ANULADA</span>}
                    </div>
                    <div style={{ fontSize:11, color:C.text2 }}>
                      {SUCURSAL_LABEL[v.sucursal] || v.sucursal || 'Sin sucursal'} · {v.fecha}{v.hora ? ' ' + v.hora.slice(0,5) : ''}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:15, fontWeight:700, color: anulada ? C.text2 : C.accent }}>{formatARS(v.total_ars)}</div>
                    <div style={{ fontSize:11, color:C.text2 }}>{abierta ? '▲ cerrar' : '▼ ver'}</div>
                  </div>
                </div>

                {/* Detalle expandible */}
                {abierta && (
                  <div style={{ padding:'0 14px 14px', borderTop:`1px solid ${C.border}` }}>
                    {/* Items */}
                    <div style={{ fontSize:11, color:C.text2, marginTop:10, marginBottom:6 }}>PRODUCTOS</div>
                    {dets.map((item, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                        <span style={{ color:C.text }}>{item.descripcion} x{item.cantidad}</span>
                        <span style={{ color:C.accent }}>{formatARS(item.precio_unitario_ars * item.cantidad)}</span>
                      </div>
                    ))}
                    {dets.length === 0 && <div style={{ fontSize:12, color:C.text2 }}>Sin detalle</div>}

                    {/* Pagos */}
                    <div style={{ fontSize:11, color:C.text2, marginTop:10, marginBottom:6 }}>PAGOS</div>
                    {pags.map((p, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                        <span style={{ color:C.text2 }}>{FORMA_LABEL[p.forma_pago] || p.forma_pago}</span>
                        <span style={{ color:C.text }}>{formatARS(p.monto_ars)}{p.monto_usd ? ' / U$S ' + p.monto_usd : ''}</span>
                      </div>
                    ))}
                    {pags.length === 0 && <div style={{ fontSize:12, color:C.text2 }}>Sin pagos</div>}

                    {/* Totales */}
                    {v.intereses_ars > 0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginTop:6, color:C.orange }}>
                        <span>Intereses</span><span>{formatARS(v.intereses_ars)}</span>
                      </div>
                    )}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700, marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
                      <span>Total</span><span style={{ color:C.accent }}>{formatARS(v.total_ars)}</span>
                    </div>

                    {/* Acciones */}
                    {!anulada && (
                      <div style={{ display:'flex', gap:8, marginTop:14 }}>
                        <button
                          onClick={() => abrirEditar(v)}
                          style={{ flex:1, padding:'11px', background:C.blue+'22', border:`1px solid ${C.blue}44`, borderRadius:8,
                            color:C.blue, fontSize:14, cursor:'pointer', fontFamily:"'Inter', system-ui, sans-serif" }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setModalAnular(v)}
                          style={{ flex:1, padding:'11px', background:C.red+'22', border:`1px solid ${C.red}44`, borderRadius:8,
                            color:C.red, fontSize:14, cursor:'pointer', fontFamily:"'Inter', system-ui, sans-serif" }}
                        >
                          Anular
                        </button>
                      </div>
                    )}
                    <div style={{ fontSize:10, color:C.text2, marginTop:8 }}>ID: {v.id}</div>
                  </div>
                )}
              </div>
            )
          })}

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
                              Real: {formatARS(real)} {dif !== 0 ? '(' + (dif > 0 ? '+' : '') + formatARS(dif) + ')' : '\u2713'}
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

      {/* MODAL: Confirmar anulación */}
      {modalAnular && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
          <div style={{ background:C.bg3, borderRadius:16, padding:24, maxWidth:380, width:'100%', border:`1px solid ${C.red}44` }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8, color:C.red }}>Anular venta</div>
            <div style={{ fontSize:13, color:C.text2, marginBottom:6 }}>
              ¿Confirmas la anulación de esta venta?
            </div>
            <div style={{ background:C.bg4, borderRadius:8, padding:'10px 12px', marginBottom:16, fontSize:13 }}>
              <div style={{ fontWeight:700 }}>{modalAnular.vendedora_nombre} — {SUCURSAL_LABEL[modalAnular.sucursal] || modalAnular.sucursal}</div>
              <div style={{ color:C.accent, fontSize:15, marginTop:4 }}>{formatARS(modalAnular.total_ars)}</div>
              <div style={{ color:C.text2, fontSize:11, marginTop:4 }}>{modalAnular.fecha}</div>
            </div>
            <div style={{ fontSize:12, color:C.orange, marginBottom:16 }}>
              Se restaurará el stock de todos los productos de esta venta.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={() => setModalAnular(null)}
                disabled={procesando}
                style={{ flex:1, padding:'10px', background:C.bg4, border:`1px solid ${C.border}`, borderRadius:8,
                  color:C.text, fontSize:13, cursor:'pointer', fontFamily:"'Inter', system-ui, sans-serif" }}
              >
                Cancelar
              </button>
              <button
                onClick={anularVenta}
                disabled={procesando}
                style={{ flex:1, padding:'10px', background:C.red, border:'none', borderRadius:8,
                  color:'#fff', fontSize:13, cursor:'pointer', fontWeight:700, fontFamily:"'Inter', system-ui, sans-serif" }}
              >
                {procesando ? 'Anulando...' : 'Anular venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar venta */}
      {modalEditar && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 }}>
          <div style={{ background:C.bg3, borderRadius:16, padding:24, maxWidth:380, width:'100%' }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:16, color:C.accent }}>Editar venta</div>

            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:C.text2, marginBottom:4 }}>Vendedora</div>
              <input
                value={editForm.vendedora_nombre}
                onChange={e => setEditForm(f => ({ ...f, vendedora_nombre: e.target.value }))}
                style={inputStyle}
                placeholder="Nombre vendedora"
              />
            </div>

            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:C.text2, marginBottom:4 }}>Sucursal</div>
              <select
                value={editForm.sucursal}
                onChange={e => setEditForm(f => ({ ...f, sucursal: e.target.value }))}
                style={{ ...inputStyle }}
              >
                <option value="">Sin sucursal</option>
                {SUCURSALES.map(s => <option key={s} value={s}>{SUCURSAL_LABEL[s]}</option>)}
              </select>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:C.text2, marginBottom:4 }}>Notas</div>
              <input
                value={editForm.notas}
                onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))}
                style={inputStyle}
                placeholder="Notas opcionales"
              />
            </div>

            <div style={{ fontSize:11, color:C.text2, marginBottom:16 }}>
              Solo se pueden editar vendedora, sucursal y notas. Para corregir productos o montos, anulá y registrá de nuevo.
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={() => setModalEditar(null)}
                disabled={procesando}
                style={{ flex:1, padding:'10px', background:C.bg4, border:`1px solid ${C.border}`, borderRadius:8,
                  color:C.text, fontSize:13, cursor:'pointer', fontFamily:"'Inter', system-ui, sans-serif" }}
              >
                Cancelar
              </button>
              <button
                onClick={editarVenta}
                disabled={procesando}
                style={{ flex:1, padding:'10px', background:C.accent, border:'none', borderRadius:8,
                  color:'#000', fontSize:13, cursor:'pointer', fontWeight:700, fontFamily:"'Inter', system-ui, sans-serif" }}
              >
                {procesando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
