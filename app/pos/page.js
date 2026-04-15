'use client'
import { useState, useEffect } from 'react'
import { getSupabase } from '../../lib/supabase'
import { crearClienteAction } from './actions'
import CierreCaja from '../../components/CierreCaja'

const sb = getSupabase()

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:     '#030712',
  bg2:    '#0d1117',
  bg3:    '#161b22',
  bg4:    '#21262d',
  accent: '#FFD700',
  text:   '#f0f6fc',
  text2:  '#8b949e',
  border: 'rgba(255,255,255,0.08)',
  green:  '#3fb950',
  red:    '#f85149',
}

const FORMAS_PAGO = [
  { id: 'efectivo_ars',        label: 'Efectivo ARS',       icon: '💵', recargo: 0,   editable: false },
  { id: 'transferencia',       label: 'Transferencia',      icon: '🏦', recargo: 0,   editable: false },
  { id: 'usd_billete',         label: 'USD Billete',        icon: '💲', recargo: 0,   editable: false },
  { id: 'posnet_debito',       label: 'Posnet Débito',      icon: '💳', recargo: 5,   editable: false },
  { id: 'posnet_credito_1',    label: 'Tarjeta 1 cuota',   icon: '💳', recargo: 10,  editable: false },
  { id: 'posnet_credito_3',    label: 'Tarjeta 3 cuotas',  icon: '💳', recargo: 42,  editable: false },
  { id: 'posnet_credito_6',    label: 'Tarjeta 6 cuotas',  icon: '💳', recargo: 76,  editable: false },
  { id: 'posnet_credito_9',    label: 'Tarjeta 9 cuotas',  icon: '💳', recargo: 96,  editable: false },
  { id: 'posnet_credito_12',   label: 'Tarjeta 12 cuotas', icon: '💳', recargo: 127, editable: false },
  { id: 'go_cuotas',           label: 'Go Cuotas',          icon: '📋', recargo: 36,  editable: false },
  { id: 'directo',             label: 'DIRECTO',            icon: '📋', recargo: 57,  editable: false },
  { id: 'rapicompra',          label: 'RapiCOMPRA',         icon: '📋', recargo: 15,  editable: true  },
  { id: 'credito_argentino',   label: 'Crédito Argentino',  icon: '📋', recargo: 15,  editable: true  },
  { id: 'rapicuotas',          label: 'Rapicuotas',         icon: '📋', recargo: 15,  editable: true  },
  { id: 'plan_canje',          label: 'Plan Canje',         icon: '🔄', recargo: 0,   editable: false },
]

const formatARS = (num) =>
  '$' + Number(num || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

// ─── Recargos y precio display ────────────────────────────────────────────────
function getPrecioDisplay(precioBase, forma, cotizacion) {
  const fp = FORMAS_PAGO.find(f => f.id === forma)
  const recargo = fp?.recargo || 0
  if (forma.startsWith('posnet_credito_')) {
    const n = parseInt(forma.replace('posnet_credito_', ''), 10)
    const total = Math.ceil(precioBase * (1 + recargo / 100))
    if (n === 1) return { tipo: 'tarjeta', total, label: '1 pago con tarjeta' }
    const cuota = Math.ceil(total / n)
    return { tipo: 'cuotas', cuota, total, n }
  }
  if (forma === 'usd_billete' && cotizacion?.usd_blue) {
    return { tipo: 'usd', usd: Math.ceil(precioBase / cotizacion.usd_blue) }
  }
  if (forma === 'plan_canje') {
    return { tipo: 'canje', precio: precioBase }
  }
  if (recargo > 0) {
    const total = Math.ceil(precioBase * (1 + recargo / 100))
    return { tipo: 'tarjeta', total, label: fp?.label }
  }
  return { tipo: 'efectivo', precio: precioBase }
}

function PrecioDisplay({ precioBase, forma, cotizacion, size = 'sm' }) {
  const d  = getPrecioDisplay(precioBase, forma, cotizacion)
  const fp = FORMAS_PAGO.find(f => f.id === forma)
  const lg = size === 'lg'
  const big = lg ? 22 : 15
  const sub = lg ? 13 : 12

  if (d.tipo === 'cuotas') return (
    <div style={{ textAlign: 'right', flexShrink: 0 }}>
      <div style={{ fontSize: lg ? 20 : 14, fontWeight: 700, color: C.accent, lineHeight: 1.2 }}>
        {formatARS(d.cuota)}<span style={{ fontSize: sub, fontWeight: 400 }}>/mes</span>
      </div>
      <div style={{ fontSize: sub, color: C.text2, marginTop: 2 }}>
        {d.n} cuotas · Total {formatARS(d.total)}
      </div>
    </div>
  )
  if (d.tipo === 'tarjeta') return (
    <div style={{ textAlign: 'right', flexShrink: 0 }}>
      <div style={{ fontSize: big, fontWeight: 700, color: C.accent }}>{formatARS(d.total)}</div>
      <div style={{ fontSize: sub, color: C.text2, marginTop: 2 }}>1 pago con {fp?.label}</div>
    </div>
  )
  if (d.tipo === 'usd') return (
    <div style={{ textAlign: 'right', flexShrink: 0 }}>
      <div style={{ fontSize: big, fontWeight: 700, color: C.accent }}>U$S {d.usd}</div>
    </div>
  )
  return (
    <div style={{ textAlign: 'right', flexShrink: 0 }}>
      <span style={{ fontSize: big, fontWeight: 700, color: C.accent }}>{formatARS(d.precio)}</span>
    </div>
  )
}

// ─── Micro-components ─────────────────────────────────────────────────────────
function TextInput({ value, onChange, placeholder, type = 'text', autoFocus, align }) {
  return (
    <input
      type={type}
      inputMode={type === 'number' ? 'numeric' : undefined}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: C.bg3, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: '12px 14px',
        color: C.text, fontSize: 15, outline: 'none',
        fontFamily: "'DM Mono', monospace",
        textAlign: align || 'left',
      }}
    />
  )
}

function Btn({ children, onClick, variant = 'primary', disabled }) {
  const vs = {
    primary: { background: C.accent, color: '#000', border: 'none' },
    ghost:   { background: 'transparent', color: C.text2, border: `1px solid ${C.border}` },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...vs[variant],
        width: '100%', borderRadius: 8, padding: '13px 20px',
        fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1, fontFamily: "'DM Mono', monospace",
      }}
    >
      {children}
    </button>
  )
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 13, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
      {children}
    </div>
  )
}

function Badge({ children, color }) {
  const col = color || C.accent
  return (
    <span style={{
      background: col + '25', color: col, borderRadius: 4,
      padding: '3px 8px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function SmallBtn({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: `1px solid ${danger ? C.red + '50' : C.border}`,
        borderRadius: 6, width: 36, height: 36, cursor: 'pointer',
        color: danger ? C.red : C.text, fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Mono', monospace", flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

// ─── Main POS ─────────────────────────────────────────────────────────────────
export default function POSPage() {
  // Auth
  const [usuario, setUsuario] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [paso, setPaso] = useState(0)          // 0 vendedora | 1 cliente | 2 carrito | 3 pagos | 4 éxito
  const [vendedoras, setVendedoras] = useState([])
  const [vendedora, setVendedora] = useState(null)
  const [vendedoraTemp, setVendedoraTemp] = useState(null) // seleccionada, pendiente de elegir sucursal
  const [cliente, setCliente] = useState(null)
  const [carrito, setCarrito] = useState([])
  const [cotizacion, setCotizacion] = useState(null)

  // Cliente
  const [busCliente, setBusCliente] = useState('')
  const [resCliente, setResCliente] = useState([])
  const [modoCrear, setModoCrear] = useState(false)
  const [nuevoC, setNuevoC] = useState({ dni: '', nombre: '', apellido: '', celular: '' })

  // Producto
  const [busProd, setBusProd] = useState('')
  const [resProd, setResProd] = useState([])

  // Pagos
  const [pagos, setPagos] = useState([{ id: 1, forma: 'efectivo_ars', monto: '' }])
  const [seq, setSeq] = useState(2)

  // Cierre
  const [cierreOpen, setCierreOpen] = useState(false)

  // UI
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [ventaOk, setVentaOk] = useState(null)

  // ── Auth check ───────────────────────────────────────────────────────────
  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/pos/login'; return }
      sb.from('usuarios_fomo').select('*').eq('id', session.user.id).single()
        .then(({ data }) => {
          if (!data) { window.location.href = '/pos/login'; return }
          setUsuario(data)
          setCheckingAuth(false)
        })
    })
  }, [])

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    sb.from('usuarios_fomo').select('*').order('nombre').then(({ data }) => setVendedoras(data || []))
    const hoy = new Date().toISOString().split('T')[0]
    sb.from('cotizacion').select('*').eq('fecha', hoy).maybeSingle().then(({ data }) => {
      if (data) setCotizacion(data)
    })
  }, [])

  // ── Buscar cliente ────────────────────────────────────────────────────────
  useEffect(() => {
    if (busCliente.length < 2) { setResCliente([]); return }
    const t = setTimeout(async () => {
      const isNum = /^\d+$/.test(busCliente)
      let q = sb.from('clientes').select('*')
      q = isNum ? q.ilike('dni', `%${busCliente}%`) : q.or(`nombre.ilike.%${busCliente}%,apellido.ilike.%${busCliente}%`)
      const { data } = await q.limit(8)
      setResCliente(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [busCliente])

  // ── Buscar producto ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!busProd || busProd.length < 2) { setResProd([]); return }
    const t = setTimeout(async () => {
      const q = busProd
      const suc = vendedora?.sucursal
      let qCels = sb.from('existencias').select('*')
        .or(`modelo.ilike.%${q}%,imei.ilike.%${q}%,marca.ilike.%${q}%`)
        .eq('estado_stock', 'disponible')
      if (suc) qCels = qCels.eq('sucursal', suc)
      let qAccs = sb.from('accesorios').select('*')
        .or(`nombre.ilike.%${q}%,compatibilidad.ilike.%${q}%,categoria.ilike.%${q}%`)
        .gt('stock_actual', 0)
      if (suc) qAccs = qAccs.eq('sucursal', suc)
      const [{ data: phones }, { data: accs }] = await Promise.all([
        qCels.limit(8),
        qAccs.limit(4),
      ])
      const results = []
      if (phones) results.push(...phones.map(d => ({ ...d, _tipo: 'celular' })))
      if (accs)   results.push(...accs.map(d => ({ ...d, _tipo: 'accesorio' })))
      setResProd(results)
    }, 300)
    return () => clearTimeout(t)
  }, [busProd, vendedora])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const totalCarrito = carrito.reduce((s, i) => s + i.precio_unitario_ars * i.cantidad, 0)
  const totalPagado = pagos.reduce((s, p) => {
    const monto = parseFloat(p.monto) || 0
    if (monto <= 0) return s
    const d = getPrecioDisplay(monto, p.forma, cotizacion)
    const montoCobrado = d.total ?? monto
    return s + (p.forma === 'usd_billete' && cotizacion?.usd_blue ? monto * cotizacion.usd_blue : montoCobrado)
  }, 0)
  const totalConRecargo = (() => {
    const hayMontos = pagos.some(p => (parseFloat(p.monto) || 0) > 0)
    if (!hayMontos) return totalCarrito
    if (pagos.length === 1) {
      const d = getPrecioDisplay(totalCarrito, pagos[0].forma, cotizacion)
      return d.total ?? totalCarrito
    }
    const sumado = pagos.reduce((sum, p) => {
      const monto = parseFloat(p.monto) || 0
      if (monto <= 0) return sum
      const d = getPrecioDisplay(monto, p.forma, cotizacion)
      return sum + (d.total ?? monto)
    }, 0)
    return Math.max(sumado, totalCarrito)
  })()
  const diferencia = totalPagado - totalConRecargo

  // ── Handlers ─────────────────────────────────────────────────────────────
  const selVendedora = (v) => { setVendedoraTemp(v) }
  const confirmarSucursal = (suc) => { setVendedora({ ...vendedoraTemp, sucursal: suc }); setVendedoraTemp(null); setPaso(1) }

  const selCliente = (c) => {
    setCliente(c); setBusCliente(''); setResCliente([]); setModoCrear(false); setPaso(2)
  }

  const crearClienteRapido = async () => {
    if (!nuevoC.nombre.trim() || !nuevoC.apellido.trim()) return
    setLoading(true)
    const { data, error } = await crearClienteAction(nuevoC)
    if (error) setErr(error)
    else if (data) selCliente(data)
    setLoading(false)
  }

  const agregarProducto = (item) => {
    if (item._tipo === 'celular') {
      if (carrito.find(c => c.imei === item.imei)) return
      setCarrito(prev => [...prev, {
        key: item.imei, _tipo: 'celular', imei: item.imei, accesorio_id: null,
        descripcion: item.modelo, cantidad: 1,
        precio_unitario_ars: item.precio_venta_ars || 0,
        costo_unitario_ars: item.costo_ars || 0,
      }])
    } else {
      const idx = carrito.findIndex(c => c.accesorio_id === item.id)
      if (idx >= 0) {
        const upd = [...carrito]; upd[idx] = { ...upd[idx], cantidad: upd[idx].cantidad + 1 }; setCarrito(upd)
      } else {
        setCarrito(prev => [...prev, {
          key: `acc_${item.id}`, _tipo: 'accesorio', imei: null, accesorio_id: item.id,
          descripcion: item.nombre, cantidad: 1,
          precio_unitario_ars: item.precio_lista_ars || 0,
          costo_unitario_ars: item.costo_ars || 0,
        }])
      }
    }
    setBusProd(''); setResProd([])
  }

  const quitarItem = (key) => setCarrito(prev => prev.filter(i => i.key !== key))
  const cambiarQty = (key, d) => setCarrito(prev =>
    prev.map(i => i.key === key ? { ...i, cantidad: Math.max(1, i.cantidad + d) } : i)
  )

  const addPago = () => {
    if (pagos.length >= 5) return
    setPagos(prev => [...prev, { id: seq, forma: 'efectivo_ars', monto: '' }])
    setSeq(n => n + 1)
  }
  const removePago = (id) => setPagos(prev => prev.filter(p => p.id !== id))
  const setPagoField = (id, field, val) => setPagos(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p))

  const confirmarVenta = async () => {
    setErr(''); setLoading(true)
    try {
      const pagosPayload = pagos
        .filter(p => (parseFloat(p.monto) || 0) > 0)
        .map(p => {
          const m = parseFloat(p.monto) || 0
          const d = getPrecioDisplay(m, p.forma, cotizacion)
          const montoCobrado = d.total ?? (p.forma === 'usd_billete' && cotizacion?.usd_blue ? m * cotizacion.usd_blue : m)
          const intereses = montoCobrado - m
          return {
            forma: p.forma,
            monto_base_ars: m,
            monto_ars: montoCobrado,
            intereses_ars: intereses > 0 ? intereses : 0,
            monto_usd: p.forma === 'usd_billete' ? m : null,
            canje_modelo: p.canje_modelo || null,
            canje_imei: p.canje_imei || null,
            canje_valor: p.canje_valor || null,
          }
        })
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch('/api/pos/venta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ vendedora_id: vendedora.id, vendedora_nombre: vendedora.nombre, sucursal: vendedora.sucursal, cliente_id: cliente?.id || null, carrito, pagos: pagosPayload, total_ars: totalConRecargo, total_base_ars: totalCarrito, intereses_ars: totalConRecargo - totalCarrito }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al registrar')
      setVentaOk(json); setPaso(4)
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  const nuevaVenta = () => {
    setCliente(null); setCarrito([]); setPagos([{ id: 1, forma: 'efectivo_ars', monto: '' }])
    setSeq(2); setBusCliente(''); setVentaOk(null); setErr(''); setPaso(1)
  }
  const cambiarVendedora = () => {
    setVendedora(null); setVendedoraTemp(null); setCliente(null); setCarrito([])
    setPagos([{ id: 1, forma: 'efectivo_ars', monto: '' }])
    setSeq(2); setBusCliente(''); setVentaOk(null); setErr(''); setPaso(0)
  }

  // ── Cierre de caja ────────────────────────────────────────────────────────
  const abrirCierre = () => setCierreOpen(true)

  // ─────────────────────────────────────────────────────────────────────────
  const pg = { minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'DM Mono', monospace", padding: 16, maxWidth: 480, margin: '0 auto', paddingBottom: 48 }

  if (checkingAuth) return <div style={{ background:'#030712', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#FFD700', fontFamily:"'Syne',sans-serif", fontSize:18 }}>Cargando...</div>

  return (
    <div style={pg}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.accent, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>FOMO OS</div>
          {vendedora && <div style={{ fontSize: 12, color: C.text2, marginTop: 3 }}>{vendedora.nombre}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {vendedora && paso < 4 && (
            <button onClick={abrirCierre} style={ghostBtn}>Cierre</button>
          )}
          {paso > 0 && paso < 4 && (
            <button onClick={() => setPaso(p => Math.max(0, p - 1))} style={ghostBtn}>← Atrás</button>
          )}
        </div>
      </div>

      {/* ── Stepper ────────────────────────────────────────────────────────── */}
      {paso < 4 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {['Vendedora', 'Cliente', 'Carrito', 'Pagos'].map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= paso ? C.accent : C.border }} />
          ))}
        </div>
      )}

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {err && (
        <div style={{ background: C.red + '18', border: `1px solid ${C.red}40`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: C.red, fontSize: 13 }}>
          {err}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PASO 0 · Vendedora
      ══════════════════════════════════════════════════════════════════════ */}
      {paso === 0 && (
        <div>
          {!vendedoraTemp ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, fontFamily: "'Syne', sans-serif" }}>¿Quién atiende hoy?</div>
              {usuario?.rol !== 'vendedora' && (
                <div style={{ marginBottom: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <a href="/pos/ventas" style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', color: C.accent, fontSize: 13, fontFamily: "'DM Mono', monospace", textDecoration: 'none', fontWeight: 600 }}>
                    📊 Ver ventas
                  </a>
                  <a href="/stock" style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', color: C.accent, fontSize: 13, fontFamily: "'DM Mono', monospace", textDecoration: 'none', fontWeight: 600 }}>
                    📦 Stock
                  </a>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {vendedoras.map(v => (
                  <button
                    key={v.id}
                    onClick={() => selVendedora(v)}
                    style={{
                      background: C.bg3, border: `1px solid ${C.border}`,
                      borderRadius: 12, padding: '22px 12px',
                      color: C.text, cursor: 'pointer', textAlign: 'center',
                      fontFamily: "'DM Mono', monospace",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                  >
                    <div style={{ fontSize: 30, marginBottom: 8 }}>👤</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{v.nombre}</div>
                    <div style={{ fontSize: 11, color: C.text2, marginTop: 4 }}>{v.sucursal || v.rol}</div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, fontFamily: "'Syne', sans-serif" }}>
                Hola, {vendedoraTemp.nombre.split(' ')[0]} 👋
              </div>
              <div style={{ fontSize: 14, color: C.text2, marginBottom: 24 }}>¿En qué sucursal estás hoy?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['695', '642', 'sanjuan', 'redes'].map(suc => (
                  <button
                    key={suc}
                    onClick={() => confirmarSucursal(suc)}
                    style={{
                      background: vendedoraTemp.sucursal === suc ? C.accent : C.bg3,
                      color: vendedoraTemp.sucursal === suc ? '#000' : C.text,
                      border: `1px solid ${vendedoraTemp.sucursal === suc ? C.accent : C.border}`,
                      borderRadius: 12, padding: '18px 20px',
                      cursor: 'pointer', textAlign: 'left',
                      fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span>Sucursal {suc.toUpperCase()}</span>
                    {vendedoraTemp.sucursal === suc && <span style={{ fontSize: 12, fontWeight: 400 }}>mi local habitual</span>}
                  </button>
                ))}
              </div>
              <button onClick={() => setVendedoraTemp(null)} style={{ marginTop: 16, background: 'none', border: 'none', color: C.text2, cursor: 'pointer', fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
                ← Volver
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PASO 1 · Cliente
      ══════════════════════════════════════════════════════════════════════ */}
      {paso === 1 && (
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 18, fontFamily: "'Syne', sans-serif" }}>Buscar Cliente</div>

          {!modoCrear ? (
            <>
              <div style={{ marginBottom: 10 }}>
                <TextInput value={busCliente} onChange={setBusCliente} placeholder="DNI o nombre..." autoFocus />
              </div>

              {resCliente.map(c => (
                <button key={c.id} onClick={() => selCliente(c)} style={rowBtn}>
                  <div style={{ fontWeight: 600 }}>{c.nombre} {c.apellido}</div>
                  <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>DNI: {c.dni || '—'} · {c.celular || ''}</div>
                </button>
              ))}

              {busCliente.length >= 2 && resCliente.length === 0 && (
                <div style={{ color: C.text2, fontSize: 13, margin: '14px 0', textAlign: 'center' }}>
                  No encontrado.{' '}
                  <button
                    onClick={() => { setModoCrear(true); setNuevoC({ dni: /^\d+$/.test(busCliente) ? busCliente : '', nombre: '', apellido: '', celular: '' }) }}
                    style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Mono', monospace", fontSize: 13 }}
                  >
                    + Crear cliente
                  </button>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button onClick={() => { setCliente(null); setPaso(2) }} style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 13, textDecoration: 'underline' }}>
                  Continuar sin cliente
                </button>
              </div>
            </>
          ) : (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.accent, marginBottom: 16 }}>Nuevo cliente</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><Label>DNI</Label><TextInput value={nuevoC.dni} onChange={v => setNuevoC(p => ({ ...p, dni: v }))} placeholder="Sin puntos" autoFocus /></div>
                <div><Label>Nombre *</Label><TextInput value={nuevoC.nombre} onChange={v => setNuevoC(p => ({ ...p, nombre: v }))} placeholder="Nombre" /></div>
                <div><Label>Apellido *</Label><TextInput value={nuevoC.apellido} onChange={v => setNuevoC(p => ({ ...p, apellido: v }))} placeholder="Apellido" /></div>
                <div><Label>Celular</Label><TextInput value={nuevoC.celular} onChange={v => setNuevoC(p => ({ ...p, celular: v }))} placeholder="Sin 0 ni 15" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <div style={{ flex: 1 }}>
                  <Btn onClick={crearClienteRapido} disabled={loading || !nuevoC.nombre.trim() || !nuevoC.apellido.trim()}>
                    {loading ? 'Guardando...' : 'Guardar y continuar'}
                  </Btn>
                </div>
                <button onClick={() => setModoCrear(false)} style={{ ...ghostBtn, padding: '13px 16px' }}>← Buscar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PASO 2 · Carrito
      ══════════════════════════════════════════════════════════════════════ */}
      {paso === 2 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Carrito</div>
            {cliente && <Badge>{cliente.nombre} {cliente.apellido}</Badge>}
          </div>

          <div style={{ marginBottom: 12 }}>
            <TextInput value={busProd} onChange={setBusProd} placeholder="IMEI, modelo o accesorio..." autoFocus />
          </div>

          {/* Resultados búsqueda */}
          {resProd.map((item, i) => (
            <button key={i} onClick={() => agregarProducto(item)} style={{ ...rowBtn, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <Badge color={item._tipo === 'celular' ? C.accent : '#60a5fa'}>{item._tipo}</Badge>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{item._tipo === 'celular' ? item.modelo : item.nombre}</span>
                </div>
                <div style={{ fontSize: 11, color: C.text2 }}>
                  {item._tipo === 'celular' ? `IMEI: ${item.imei}` : `Stock: ${item.stock_actual}`}
                </div>
              </div>
              <PrecioDisplay
                precioBase={item._tipo === 'celular' ? item.precio_venta_ars : item.precio_lista_ars}
                forma={pagos[0]?.forma || 'efectivo_ars'}
                cotizacion={cotizacion}
              />
            </button>
          ))}

          {/* Items en carrito */}
          {carrito.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.text2, padding: '40px 0', fontSize: 13 }}>
              Buscá un producto para agregar al carrito
            </div>
          ) : (
            <>
              <div style={{ marginTop: resProd.length > 0 ? 16 : 0 }}>
                {carrito.map(item => (
                  <div key={item.key} style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <Badge color={item._tipo === 'celular' ? C.accent : '#60a5fa'}>{item._tipo}</Badge>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{item.descripcion}</span>
                      </div>
                      {item.imei && <div style={{ fontSize: 11, color: C.text2 }}>IMEI: {item.imei}</div>}
                      <div style={{ marginTop: 4 }}>
                        <PrecioDisplay
                          precioBase={item.precio_unitario_ars * item.cantidad}
                          forma={pagos[0]?.forma || 'efectivo_ars'}
                          cotizacion={cotizacion}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {item._tipo === 'accesorio' && (
                        <>
                          <SmallBtn onClick={() => cambiarQty(item.key, -1)}>−</SmallBtn>
                          <span style={{ minWidth: 22, textAlign: 'center', fontSize: 14 }}>{item.cantidad}</span>
                          <SmallBtn onClick={() => cambiarQty(item.key, +1)}>+</SmallBtn>
                        </>
                      )}
                      <SmallBtn onClick={() => quitarItem(item.key)} danger>✕</SmallBtn>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: C.bg3, border: `1px solid ${C.accent}30`, borderRadius: 10, padding: '14px 16px', marginTop: 4, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ color: C.text2, fontSize: 14, paddingTop: 3 }}>Total</span>
                <PrecioDisplay
                  precioBase={totalCarrito}
                  forma={pagos[0]?.forma || 'efectivo_ars'}
                  cotizacion={cotizacion}
                  size="lg"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <select
                  value={pagos[0]?.forma || 'efectivo_ars'}
                  onChange={e => setPagoField(pagos[0].id, 'forma', e.target.value)}
                  style={{ width: '100%', background: C.bg4, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontFamily: "'DM Mono', monospace", fontSize: 14, outline: 'none' }}
                >
                  {FORMAS_PAGO.map(f => <option key={f.id} value={f.id}>{f.icon} {f.label}</option>)}
                </select>
                {pagos[0]?.forma === 'plan_canje' && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      placeholder="Modelo (ej: iPhone 13 128GB)"
                      style={{ background: C.bg4, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}
                      value={pagos[0]?.canje_modelo || ''}
                      onChange={e => setPagos(prev => prev.map(x => x.id === pagos[0].id ? { ...x, canje_modelo: e.target.value } : x))}
                    />
                    <input
                      placeholder="IMEI del celular en canje"
                      style={{ background: C.bg4, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}
                      value={pagos[0]?.canje_imei || ''}
                      onChange={e => setPagos(prev => prev.map(x => x.id === pagos[0].id ? { ...x, canje_imei: e.target.value } : x))}
                    />
                    <input
                      placeholder="Valor del canje en ARS"
                      type="number"
                      style={{ background: C.bg4, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}
                      value={pagos[0]?.canje_valor || ''}
                      onChange={e => setPagos(prev => prev.map(x => x.id === pagos[0].id ? { ...x, canje_valor: e.target.value, monto: e.target.value } : x))}
                    />
                  </div>
                )}
              </div>
              <Btn onClick={() => setPaso(3)}>Ir a Pagos →</Btn>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PASO 3 · Pagos
      ══════════════════════════════════════════════════════════════════════ */}
      {paso === 3 && (
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, fontFamily: "'Syne', sans-serif" }}>Formas de Pago</div>

          <div style={{ background: C.bg3, border: `1px solid ${C.accent}30`, borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: C.text2, fontSize: 14 }}>Total a cobrar</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: C.accent }}>{formatARS(totalConRecargo)}</span>
            </div>
            {pagos.length === 1 && (() => {
              const d = getPrecioDisplay(totalCarrito, pagos[0].forma, cotizacion)
              if (d.tipo === 'tarjeta') return <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>+{RECARGO_TARJETA}% recargo · Base: {formatARS(totalCarrito)}</div>
              if (d.tipo === 'cuotas') return <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>{pagos[0].forma.replace('credito_personal_','')} cuotas · +{RECARGO_CUOTAS[parseInt(pagos[0].forma.split('_').pop())]}% · Total: {formatARS(d.total)}</div>
              if (d.tipo === 'usd') return <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>≈ {d.usd?.toFixed(2)} USD · Blue: ${cotizacion?.usd_blue}</div>
              return null
            })()}
            {pagos.length > 1 && totalConRecargo > totalCarrito && (
              <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>
                Recargos incluidos · Base: {formatARS(totalCarrito)} · Con recargos: {formatARS(totalConRecargo)}
              </div>
            )}
          </div>

          {pagos.map((p, idx) => (
            <div key={p.id} style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Label>Forma de pago {idx + 1}</Label>
                {pagos.length > 1 && (
                  <button onClick={() => removePago(p.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Quitar</button>
                )}
              </div>
              <select
                value={p.forma}
                onChange={e => setPagoField(p.id, 'forma', e.target.value)}
                style={{ width: '100%', background: C.bg4, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontFamily: "'DM Mono', monospace", fontSize: 14, marginBottom: 8, outline: 'none' }}
              >
                {FORMAS_PAGO.map(f => <option key={f.id} value={f.id}>{f.icon} {f.label}</option>)}
              </select>
              {p.forma === 'plan_canje' && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    placeholder="Modelo (ej: iPhone 13 128GB)"
                    style={{ background: C.bg4, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}
                    value={p.canje_modelo || ''}
                    onChange={e => setPagos(prev => prev.map(x => x.id === p.id ? { ...x, canje_modelo: e.target.value } : x))}
                  />
                  <input
                    placeholder="IMEI del celular en canje"
                    style={{ background: C.bg4, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}
                    value={p.canje_imei || ''}
                    onChange={e => setPagos(prev => prev.map(x => x.id === p.id ? { ...x, canje_imei: e.target.value } : x))}
                  />
                  <input
                    placeholder="Valor del canje en ARS"
                    type="number"
                    style={{ background: C.bg4, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}
                    value={p.canje_valor || ''}
                    onChange={e => setPagos(prev => prev.map(x => x.id === p.id ? { ...x, canje_valor: e.target.value, monto: e.target.value } : x))}
                  />
                </div>
              )}
              <input
                type="text"
                inputMode="numeric"
                placeholder={p.forma === 'usd_billete' ? 'Monto en USD' : 'Monto en ARS'}
                value={p.monto}
                onChange={e => setPagoField(p.id, 'monto', e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: C.bg4, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 15, outline: 'none', fontFamily: "'DM Mono', monospace" }}
              />
              {p.forma === 'usd_billete' && cotizacion?.usd_blue && (parseFloat(p.monto) || 0) > 0 && (
                <div style={{ fontSize: 12, color: C.text2, marginTop: 5 }}>
                  ≈ {formatARS((parseFloat(p.monto) || 0) * cotizacion.usd_blue)} ARS · Blue: ${cotizacion.usd_blue}
                </div>
              )}
              {(() => {
                const monto = parseFloat(p.monto) || 0
                if (monto <= 0) return null
                const d = getPrecioDisplay(monto, p.forma, cotizacion)
                if (d.tipo === 'tarjeta') return (
                  <div style={{ fontSize: 12, color: C.accent, marginTop: 5 }}>
                    Total con recargo: {formatARS(d.total)} (+{RECARGO_TARJETA}%)
                  </div>
                )
                if (d.tipo === 'cuotas') {
                  const n = parseInt(p.forma.split('_').pop())
                  return (
                    <div style={{ fontSize: 12, color: C.accent, marginTop: 5 }}>
                      {n} cuotas de {formatARS(Math.ceil(d.total / n))} · Total: {formatARS(d.total)}
                    </div>
                  )
                }
                return null
              })()}
            </div>
          ))}

          {pagos.length < 5 && (
            <button onClick={addPago} style={{ width: '100%', background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 10, padding: 12, color: C.text2, cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 13, marginBottom: 16 }}>
              + Agregar forma de pago ({5 - pagos.length} disponibles)
            </button>
          )}

          {/* Balance */}
          <div style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: C.text2, fontSize: 14 }}>Ingresado</span>
              <span style={{ fontSize: 14 }}>{formatARS(totalPagado)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
              <span style={{ color: C.text2, fontSize: 14 }}>{diferencia >= 0 ? 'Vuelto / Sobrante' : 'Falta'}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: diferencia >= 0 ? C.green : C.red }}>
                {diferencia >= 0 ? '+' : ''}{formatARS(diferencia)}
              </span>
            </div>
          </div>

          <Btn onClick={confirmarVenta} disabled={loading || totalPagado < totalConRecargo || carrito.length === 0}>
            {loading ? 'Registrando...' : `Confirmar Venta · ${formatARS(totalConRecargo)}`}
          </Btn>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PASO 4 · Éxito
      ══════════════════════════════════════════════════════════════════════ */}
      {paso === 4 && ventaOk && (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 60, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.accent, fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>¡Venta registrada!</div>
          <div style={{ color: C.text2, fontSize: 13, marginBottom: 8 }}>#{String(ventaOk.id).slice(0, 8)}</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 32 }}>{formatARS(totalCarrito)}</div>

          <div style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'left' }}>
            {carrito.map(item => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span>{item.descripcion}{item.cantidad > 1 ? ` ×${item.cantidad}` : ''}</span>
                <span style={{ color: C.accent }}>{formatARS(item.precio_unitario_ars * item.cantidad)}</span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              {pagos.filter(p => (parseFloat(p.monto) || 0) > 0).map(p => {
                const fp = FORMAS_PAGO.find(f => f.id === p.forma)
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.text2, marginBottom: 4 }}>
                    <span>{fp?.icon} {fp?.label}</span>
                    <span>{p.forma === 'usd_billete' ? `USD ${p.monto}` : formatARS(parseFloat(p.monto) || 0)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <Btn onClick={nuevaVenta}>+ Nueva venta</Btn>
          <button onClick={cambiarVendedora} style={{ marginTop: 12, background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 20px', color: C.text2, fontSize: 13, cursor: 'pointer', width: '100%', fontFamily: "'DM Mono', monospace" }}>
            Cambiar vendedora
          </button>
        </div>
      )}

      {/* ── Cierre de Caja (componente separado) ─────────────────────────── */}
      <CierreCaja
        open={cierreOpen}
        onClose={() => setCierreOpen(false)}
        vendedora={vendedora}
      />

    </div>
  )
}

// ─── Shared inline style objects ─────────────────────────────────────────────
const ghostBtn = {
  background: 'transparent',
  border: `1px solid rgba(255,255,255,0.08)`,
  borderRadius: 8, padding: '8px 12px',
  color: '#8b949e', cursor: 'pointer',
  fontSize: 12, fontFamily: "'DM Mono', monospace",
}

const rowBtn = {
  width: '100%', textAlign: 'left',
  background: '#161b22', border: `1px solid rgba(255,255,255,0.08)`,
  borderRadius: 8, padding: '11px 14px', marginBottom: 6,
  cursor: 'pointer', color: '#f0f6fc', fontFamily: "'DM Mono', monospace",
}
