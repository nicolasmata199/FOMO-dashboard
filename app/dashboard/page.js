'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '../../lib/supabase'

const OBJ_DIA = 937500
const CMV_R = 0.612
const FIJOS = 9340241+6033219+2160000+1788634+139586+200000+306130+69449+500000

function fmt(n) {
  const s = '$' + Math.abs(Math.round(n)).toLocaleString('es-AR')
  return n < 0 ? '−' + s : s
}
function fmtS(n) {
  const a = Math.abs(n)
  if (a >= 1e6) return (n < 0 ? '−' : '') + '$' + (a / 1e6).toFixed(1) + 'M'
  if (a >= 1000) return (n < 0 ? '−' : '') + '$' + (a / 1000).toFixed(0) + 'K'
  return fmt(n)
}
function diasHasta(f) {
  const h = new Date(); h.setHours(0,0,0,0)
  const d = new Date(f + 'T12:00:00')
  return Math.round((d.getTime() - h.getTime()) / 86400000)
}
function hoyStr() { return new Date().toISOString().split('T')[0] }
function fechaLabel() {
  const d = new Date()
  const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const mes = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${dias[d.getDay()]} ${d.getDate()} ${mes[d.getMonth()]}`
}

export default function Dashboard() {
  const [usuario, setUsuario] = useState(null)
  const [tab, setTab] = useState('hoy')
  const [loading, setLoading] = useState(true)

  const [datosDia, setDatosDia] = useState({efectivo:0,transferencias:0,tarjeta_pendiente:0,cheque_recibido:0,saldo_banco:0,ventas_acumuladas_mes:15000000,notas:''})
  const [vencimientos, setVencimientos] = useState([])
  const [deudas, setDeudas] = useState([])
  const [gastos, setGastos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [stock, setStock] = useState([])
  const [historial, setHistorial] = useState([])

  const [fVenc, setFVenc] = useState({fecha:'',descripcion:'',monto:'',tipo:'cheque'})
  const [fDeuda, setFDeuda] = useState({descripcion:'',monto:'',tipo:'tarjeta'})
  const [fechaCarga, setFechaCarga] = useState(hoyStr())
  const [fGasto, setFGasto] = useState({descripcion:'',monto:'',categoria:'stock'})
  const [fCambio, setFCambio] = useState({tipo:'cheque_efectivo',monto_original:'',monto_recibido:'',descripcion:''})
  const [modal, setModal] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setUsuario(profile || { nombre: session.user.email, rol: 'admin' })
      await loadAll()
      setLoading(false)
    })
  }, [])

  async function loadAll() {
    const supabase = getSupabase()
    const [v, d, g, p, s, h, dd] = await Promise.all([
      supabase.from('vencimientos').select('*').eq('pagado', false).order('fecha'),
      supabase.from('deudas').select('*').eq('activa', true).order('monto', {ascending:false}),
      supabase.from('gastos').select('*').eq('fecha', hoyStr()).order('created_at', {ascending:false}),
      supabase.from('proveedores').select('*').order('deuda_actual', {ascending:false}),
      supabase.from('stock').select('*').order('categoria'),
      supabase.from('historial').select('*').order('created_at', {ascending:false}).limit(20),
      supabase.from('datos_diarios').select('*').eq('fecha', hoyStr()).single(),
    ])
    if (v.data) setVencimientos(v.data)
    if (d.data) setDeudas(d.data)
    if (g.data) setGastos(g.data)
    if (p.data) setProveedores(p.data)
    if (s.data) setStock(s.data)
    if (h.data) setHistorial(h.data)
    if (dd.data) setDatosDia(dd.data)
  }

  async function logH(accion, descripcion) {
    const supabase = getSupabase()
    await supabase.from('historial').insert({
      tabla: 'general', accion, descripcion,
      usuario_nombre: usuario?.nombre || 'usuario'
    })
  }

  async function cargarFecha(fecha) {
    const supabase = getSupabase()
    const { data } = await supabase.from('datos_diarios').select('*').eq('fecha', fecha).single()
    const { data: gas } = await supabase.from('gastos').select('*').eq('fecha', fecha).order('created_at', {ascending:false})
    if (data) setDatosDia(data)
    else setDatosDia({efectivo:0,transferencias:0,tarjeta_pendiente:0,cheque_recibido:0,saldo_banco:0,ventas_acumuladas_mes:0,notas:''})
    if (gas) setGastos(gas)
  }

  async function guardarDatos() {
    setSaving(true)
    const supabase = getSupabase()
    const { error } = await supabase.from('datos_diarios').upsert({
      ...datosDia, fecha: fechaCarga,
      usuario_nombre: usuario?.nombre,
      updated_at: new Date().toISOString()
    }, { onConflict: 'fecha' })
    if (!error) {
      const esHoy = fechaCarga === hoyStr()
      await logH(esHoy ? 'UPDATE' : 'EDIT', `${esHoy ? 'Actualizó' : 'Modificó'} datos del ${fechaCarga} — caja: ${fmtS(datosDia.efectivo + datosDia.transferencias + datosDia.saldo_banco)}`)
      setMsg('✓ Guardado')
      setTimeout(() => setMsg(''), 2000)
    }
    setSaving(false)
  }

  async function agregarVencimiento() {
    if (!fVenc.fecha || !fVenc.descripcion || !fVenc.monto) return
    const supabase = getSupabase()
    await supabase.from('vencimientos').insert({...fVenc, monto: parseFloat(fVenc.monto), usuario_nombre: usuario?.nombre})
    await logH('INSERT', `Agregó vencimiento: ${fVenc.descripcion} — ${fmt(parseFloat(fVenc.monto))}`)
    setFVenc({fecha:'',descripcion:'',monto:'',tipo:'cheque'})
    setModal('')
    await loadAll()
  }

  async function marcarPagado(id, desc) {
    const supabase = getSupabase()
    await supabase.from('vencimientos').update({pagado:true, fecha_pago: hoyStr()}).eq('id', id)
    await logH('UPDATE', `Marcó como pagado: ${desc}`)
    await loadAll()
  }

  async function agregarDeuda() {
    if (!fDeuda.descripcion || !fDeuda.monto) return
    const supabase = getSupabase()
    await supabase.from('deudas').insert({...fDeuda, monto: parseFloat(fDeuda.monto), usuario_nombre: usuario?.nombre})
    await logH('INSERT', `Agregó deuda: ${fDeuda.descripcion} — ${fmt(parseFloat(fDeuda.monto))}`)
    setFDeuda({descripcion:'',monto:'',tipo:'tarjeta'})
    setModal('')
    await loadAll()
  }

  async function agregarGasto() {
    if (!fGasto.descripcion || !fGasto.monto) return
    const supabase = getSupabase()
    await supabase.from('gastos').insert({...fGasto, monto: parseFloat(fGasto.monto), fecha: fechaCarga, usuario_nombre: usuario?.nombre})
    await logH('INSERT', `Registró gasto: ${fGasto.descripcion} — ${fmt(parseFloat(fGasto.monto))}`)
    setFGasto({descripcion:'',monto:'',categoria:'stock'})
    await loadAll()
    setMsg('✓ Gasto registrado')
    setTimeout(() => setMsg(''), 2000)
  }

  async function agregarCambio() {
    if (!fCambio.monto_original || !fCambio.monto_recibido) return
    const supabase = getSupabase()
    const orig = parseFloat(fCambio.monto_original)
    const recib = parseFloat(fCambio.monto_recibido)
    const descuento = orig - recib
    const tipos = {'cheque_efectivo':'Cheque → Efectivo','echeq_efectivo':'E-cheq → Efectivo','banco_efectivo':'Banco → Efectivo','efectivo_banco':'Efectivo → Banco','transferencia_efectivo':'Transferencia → Efectivo','efectivo_transferencia':'Efectivo → Transferencia'}
    const tipoLabel = tipos[fCambio.tipo] || fCambio.tipo
    const desc = `Cambio: ${tipoLabel} | Original: ${fmt(orig)} | Recibido: ${fmt(recib)}${descuento > 0 ? ` | Descuento: ${fmt(descuento)}` : ''}${fCambio.descripcion ? ` — ${fCambio.descripcion}` : ''}`
    await supabase.from('gastos').insert({descripcion: desc, monto: descuento > 0 ? descuento : 0, fecha: fechaCarga, categoria: 'cambio', usuario_nombre: usuario?.nombre})
    await logH('INSERT', `Registró cambio: ${tipoLabel} ${fmt(orig)} → ${fmt(recib)}`)
    setFCambio({tipo:'cheque_efectivo',monto_original:'',monto_recibido:'',descripcion:''})
    await loadAll()
    setMsg('✓ Cambio registrado')
    setTimeout(() => setMsg(''), 2000)
  }

  async function eliminarItem(tabla, id, desc) {
    if (!confirm(`¿Eliminar "${desc}"?`)) return
    const supabase = getSupabase()
    await supabase.from(tabla).update({activa:false}).eq('id', id)
    await logH('DELETE', `Eliminó de ${tabla}: ${desc}`)
    await loadAll()
  }

  async function logout() {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const ventasHoy = datosDia.efectivo + datosDia.transferencias + datosDia.cheque_recibido
  const cajaTotal = datosDia.efectivo + datosDia.saldo_banco
  const disponibleTotal = cajaTotal + datosDia.tarjeta_pendiente + datosDia.transferencias
  const v7 = vencimientos.filter(v => { const d = diasHasta(v.fecha); return d >= 0 && d <= 7 })
  const tv7 = v7.reduce((s, v) => s + v.monto, 0)
  const v15 = vencimientos.filter(v => { const d = diasHasta(v.fecha); return d >= 0 && d <= 15 })
  const tv15 = v15.reduce((s, v) => s + v.monto, 0)
  const posNeta = disponibleTotal - tv15
  const pctObj = ventasHoy > 0 ? Math.min(100, Math.round(ventasHoy / OBJ_DIA * 100)) : 0
  const cmv = datosDia.ventas_acumuladas_mes * CMV_R
  const mb = datosDia.ventas_acumuladas_mes - cmv
  const neto = mb - FIJOS
  const stockValor = stock.reduce((s, i) => s + (i.cantidad * i.costo_unitario), 0)
  const totalDeudas = deudas.reduce((s, d) => s + d.monto, 0)
  const colorCaja = cajaTotal > 3e6 ? '#3ddc84' : cajaTotal > 1e6 ? '#f5a623' : '#ff5050'
  const colorVentas = pctObj >= 100 ? '#3ddc84' : pctObj >= 70 ? '#f5a623' : '#ff5050'

  function tipoBadge(t) {
    const m = {cheque:'#f5a623',echeq:'#f5a623',banco:'#5b9fff',impuesto:'#ff5050',sueldo:'#ff5050',servicio:'#7a7876',tarjeta:'#f5a623',proveedor:'#7a7876',personal:'#5b9fff',stock:'#3ddc84',alquiler:'#5b9fff',mercaderia:'#3ddc84',prestamo:'#a78bfa',cambio:'#22d3ee',otro:'#7a7876'}
    const l = {cheque:'CHQ',echeq:'ECHEQ',banco:'BCO',impuesto:'AFIP',sueldo:'SUE',servicio:'SVC',tarjeta:'TRJ',proveedor:'PRV',personal:'CRED',stock:'STK',alquiler:'ALQ',mercaderia:'MERC',prestamo:'PREST',cambio:'CAMBIO',otro:'OTRO'}
    return <span style={{fontSize:'9px',fontWeight:700,padding:'2px 6px',borderRadius:'4px',fontFamily:'monospace',background:(m[t]||'#7a7876')+'22',color:m[t]||'#7a7876'}}>{l[t]||t.toUpperCase()}</span>
  }

  const C = {
    bg: '#13141a',
    card: '#1c1e26',
    cardBorder: 'rgba(255,255,255,0.09)',
    inputBg: '#23252f',
    label: '#8b9099',
    muted: '#4a4e58',
    text: '#e8eaf0',
    accent: '#f5e000',
    green: '#34d399',
    red: '#f87171',
    blue: '#60a5fa',
  }

  const S = {
    page: {padding:'16px 16px 90px',fontFamily:"'Syne',sans-serif"},
    sec: {fontSize:'11px',fontWeight:700,letterSpacing:'.12em',color:C.muted,textTransform:'uppercase',margin:'22px 0 12px'},
    card: {background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:'14px',padding:'16px',marginBottom:'12px'},
    inp: {width:'100%',background:C.inputBg,border:`1px solid rgba(255,255,255,0.12)`,borderRadius:'10px',color:C.text,fontFamily:'DM Mono,monospace',fontSize:'16px',padding:'12px 14px',outline:'none',boxSizing:'border-box'},
    sel: {width:'100%',background:C.inputBg,border:`1px solid rgba(255,255,255,0.12)`,borderRadius:'10px',color:C.label,fontFamily:'DM Mono,monospace',fontSize:'15px',padding:'12px 14px',outline:'none',boxSizing:'border-box'},
    btn: {width:'100%',background:C.accent,color:'#000',border:'none',borderRadius:'12px',padding:'14px',fontSize:'15px',fontWeight:700,fontFamily:"'Syne',sans-serif",cursor:'pointer'},
    row: {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 0',borderBottom:`1px solid ${C.cardBorder}`,fontSize:'14px'},
    label: {fontSize:'13px',color:C.label,display:'block',marginBottom:'8px',fontWeight:600},
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'12px'}}>
      <div style={{fontSize:'28px',fontWeight:800,fontFamily:"'Syne',sans-serif",color:C.text}}>FO<span style={{color:C.accent}}>MO</span></div>
      <p style={{color:C.label,fontFamily:'DM Mono,monospace',fontSize:'12px',letterSpacing:'.08em'}}>cargando...</p>
    </div>
  )

  const navItems = [
    {id:'hoy',icon:'◉',label:'HOY'},
    {id:'cargar',icon:'＋',label:'CARGAR'},
    {id:'pagos',icon:'⚡',label:'PAGOS'},
    {id:'pl',icon:'≋',label:'P&L'},
    {id:'mas',icon:'···',label:'MÁS'},
  ]

  return (
    <div style={{background:C.bg,minHeight:'100vh',color:C.text}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      <style>{`
        * { box-sizing: border-box; }
        body { background: #13141a; }
        .fomo-desktop-layout { display: block; }
        .fomo-sidebar { display: none; }
        .fomo-main { width: 100%; }
        .fomo-bottom-nav { display: flex; }
        .fomo-metrics-grid { grid-template-columns: 1fr 1fr; }
        .fomo-metric-value { font-size: 22px; }
        .fomo-metric-label { font-size: 10px; }
        @media (min-width: 900px) {
          .fomo-desktop-layout { display: flex; min-height: 100vh; }
          .fomo-sidebar {
            display: flex; flex-direction: column;
            width: 240px; flex-shrink: 0;
            background: #0f1016;
            border-right: 1px solid rgba(255,255,255,0.08);
            padding: 0; position: sticky; top: 0; height: 100vh;
            overflow: hidden;
          }
          .fomo-sidebar-logo {
            font-size: 26px; font-weight: 800; letter-spacing: -1px;
            padding: 28px 28px 24px;
            border-bottom: 1px solid rgba(255,255,255,0.07);
            margin-bottom: 12px;
          }
          .fomo-sidebar-btn {
            display: flex; align-items: center; gap: 14px;
            padding: 13px 28px; font-size: 13px; font-weight: 700;
            letter-spacing: .05em; text-transform: uppercase;
            cursor: pointer; border: none; background: none;
            font-family: 'Syne', sans-serif; width: 100%; text-align: left;
            transition: all .15s; position: relative;
          }
          .fomo-sidebar-btn:hover { background: rgba(255,255,255,0.05); }
          .fomo-sidebar-btn.active {
            background: rgba(245,166,35,0.08);
            color: #f5a623 !important;
          }
          .fomo-sidebar-btn.active::before {
            content: ''; position: absolute; left: 0; top: 4px; bottom: 4px;
            width: 3px; background: #f5a623; border-radius: 0 3px 3px 0;
          }
          .fomo-sidebar-icon { font-size: 20px; width: 26px; text-align: center; }
          .fomo-main { flex: 1; min-width: 0; overflow-y: auto; }
          .fomo-header { padding: 22px 40px !important; }
          .fomo-header-logo { display: none; }
          .fomo-content { max-width: 760px; margin: 0 auto; padding: 28px 40px 60px !important; }
          .fomo-bottom-nav { display: none !important; }
          .fomo-metrics-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 14px !important; }
          .fomo-metric-value { font-size: 28px !important; }
          .fomo-metric-label { font-size: 11px !important; }
          .fomo-modal-inner { border-radius: 20px !important; max-width: 500px; margin: auto; }
          .fomo-modal-wrap { align-items: center !important; }
          .fomo-sidebar-user {
            margin-top: auto; padding: 20px 28px;
            border-top: 1px solid rgba(255,255,255,0.07);
            font-size: 12px; color: #8b9099; font-family: monospace; line-height: 1.6;
          }
          .fomo-card-row { font-size: 14px !important; padding: 13px 0 !important; }
          .fomo-section-title { font-size: 12px !important; margin: 28px 0 14px !important; }
        }
      `}</style>

      {/* LAYOUT WRAPPER */}
      <div className="fomo-desktop-layout">

      {/* SIDEBAR (solo desktop) */}
      <aside className="fomo-sidebar">
        <div className="fomo-sidebar-logo">FO<span style={{color:C.accent}}>MO</span></div>
        {navItems.map(n => (
          <button key={n.id} className={`fomo-sidebar-btn${tab===n.id?' active':''}`}
            style={{color: tab===n.id ? C.accent : C.label}}
            onClick={() => setTab(n.id)}>
            <span className="fomo-sidebar-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
        <div className="fomo-sidebar-user">
          <div style={{fontWeight:700,color:C.text,marginBottom:'2px'}}>{usuario?.nombre}</div>
          <div style={{color:C.muted,fontSize:'11px'}}>{usuario?.rol}</div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="fomo-main">

      {/* HEADER */}
      <div className="fomo-header" style={{padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`1px solid ${C.cardBorder}`,background:C.bg,position:'sticky',top:0,zIndex:100}}>
        <div className="fomo-header-logo" style={{fontSize:'20px',fontWeight:800,letterSpacing:'-.5px',fontFamily:"'Syne',sans-serif"}}>FO<span style={{color:C.accent}}>MO</span></div>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          {msg && <span style={{fontSize:'12px',color:C.green,fontFamily:'DM Mono,monospace',fontWeight:600}}>{msg}</span>}
          <span style={{fontSize:'11px',color:C.label,background:C.card,padding:'6px 12px',borderRadius:'8px',border:`1px solid ${C.cardBorder}`,fontFamily:'DM Mono,monospace'}}>{fechaLabel()}</span>
          <button onClick={logout} style={{fontSize:'11px',color:C.label,background:'none',border:`1px solid ${C.cardBorder}`,borderRadius:'8px',padding:'6px 12px',cursor:'pointer',fontFamily:"'Syne',sans-serif",fontWeight:600}}>salir</button>
        </div>
      </div>

      {/* ALERTAS */}
      {tab === 'hoy' && (
        <div style={{padding:'12px 16px 0'}}>
          {vencimientos.filter(v => diasHasta(v.fecha) === 0).length > 0 && (
            <div style={{background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.25)',borderRadius:'12px',padding:'12px 16px',fontSize:'13px',color:'#fca5a5',marginBottom:'10px',lineHeight:1.6,fontWeight:500}}>
              🔴 <strong>HOY vencen:</strong> {vencimientos.filter(v=>diasHasta(v.fecha)===0).map(v=>v.descripcion).join(', ')} — {fmt(vencimientos.filter(v=>diasHasta(v.fecha)===0).reduce((s,v)=>s+v.monto,0))}
            </div>
          )}
          {vencimientos.filter(v => diasHasta(v.fecha) === 1).length > 0 && (
            <div style={{background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.25)',borderRadius:'12px',padding:'12px 16px',fontSize:'13px',color:'#fcd34d',marginBottom:'10px',lineHeight:1.6,fontWeight:500}}>
              🟡 <strong>Mañana vencen:</strong> {vencimientos.filter(v=>diasHasta(v.fecha)===1).map(v=>v.descripcion).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* HOY */}
      {tab === 'hoy' && (
        <div className="fomo-content" style={S.page}>
          <div className="fomo-metrics-grid" style={{display:'grid',gap:'9px',marginBottom:'14px'}}>
            {[
              {label:'VENTAS HOY',val:ventasHoy>0?fmtS(ventasHoy):'—',color:colorVentas,sub:`${pctObj}% del objetivo`,prog:pctObj},
              {label:'CAJA TOTAL',val:fmtS(cajaTotal),color:colorCaja,sub:'efectivo + banco',prog:0},
              {label:'VENCE 7 DÍAS',val:fmtS(tv7),color:C.red,sub:`${v7.length} obligacion(es)`,prog:0},
              {label:'MES ACTUAL',val:fmtS(datosDia.ventas_acumuladas_mes),color:C.blue,sub:`${new Date().getDate()} días`,prog:0},
            ].map((k,i) => (
              <div key={i} style={{...S.card,position:'relative',overflow:'hidden',paddingTop:'18px'}}>
                <div style={{position:'absolute',top:0,left:0,right:0,height:'3px',background:k.color,opacity:.9}}/>
                <div className="fomo-metric-label" style={{color:C.label,marginBottom:'8px',fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase'}}>{k.label}</div>
                <div className="fomo-metric-value" style={{fontWeight:800,fontFamily:'DM Mono,monospace',letterSpacing:'-1px',color:k.color,lineHeight:1}}>{k.val}</div>
                <div style={{fontSize:'11px',color:C.muted,marginTop:'6px',fontFamily:'DM Mono,monospace'}}>{k.sub}</div>
                {k.prog > 0 && <div style={{background:C.inputBg,borderRadius:'4px',height:'4px',marginTop:'10px',overflow:'hidden'}}><div style={{height:'100%',borderRadius:'4px',background:k.color,width:k.prog+'%',transition:'width .4s'}}/></div>}
              </div>
            ))}
          </div>

          <div style={S.sec}>Detalle de cobros de hoy</div>
          <div style={S.card}>
            {[
              {label:'Efectivo', val:datosDia.efectivo},
              {label:'Transferencias', val:datosDia.transferencias},
              {label:'Cheques / E-cheq recibidos', val:datosDia.cheque_recibido},
              {label:'Tarjeta (pendiente acred.)', val:datosDia.tarjeta_pendiente, color:C.accent},
            ].map((r,i) => (
              <div key={i} style={{...S.row,...(i===3?{borderBottom:'none'}:{})}}>
                <span style={{color:C.label}}>{r.label}</span>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:r.color||'#eeecea'}}>{fmt(r.val||0)}</span>
              </div>
            ))}
            <div style={{...S.row,borderBottom:'none',fontWeight:700,fontSize:'13px',paddingTop:'12px',borderTop:'1px solid rgba(255,255,255,0.13)',marginTop:'4px'}}>
              <span>Total cobrado hoy</span>
              <span style={{fontFamily:'monospace',color:C.green}}>{fmt(ventasHoy)}</span>
            </div>
          </div>

          <div style={S.sec}>Posición de caja</div>
          <div style={S.card}>
            {[
              {l:'Efectivo en caja', v:datosDia.efectivo, c:'#3ddc84'},
              {l:'Saldo banco', v:datosDia.saldo_banco, c:'#3ddc84'},
              {l:'Transferencias del día', v:datosDia.transferencias, c:'#3ddc84'},
              {l:'Tarjeta pendiente acreditación', v:datosDia.tarjeta_pendiente, c:'#f5a623'},
            ].map((r,i) => (
              <div key={i} style={S.row}>
                <span style={{color:C.label,fontSize:'12px'}}>{r.l}</span>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:r.c}}>{fmt(r.v||0)}</span>
              </div>
            ))}
            <div style={{...S.row,fontWeight:700,fontSize:'13px',borderTop:'1px solid rgba(255,255,255,0.13)',marginTop:'4px',paddingTop:'10px'}}>
              <span>Total disponible</span>
              <span style={{fontFamily:'monospace',color:disponibleTotal>2e6?'#3ddc84':'#f5a623'}}>{fmt(disponibleTotal)}</span>
            </div>
            <div style={S.row}><span style={{color:C.label,fontSize:'12px'}}>Vence próx. 15 días</span><span style={{fontFamily:'monospace',fontSize:'12px',color:C.red}}>−{fmt(tv15)}</span></div>
            <div style={{...S.row,borderBottom:'none',fontWeight:700,fontSize:'14px',background:'rgba(245,166,35,0.06)',margin:'4px -13px -13px',padding:'12px 13px',borderRadius:'0 0 12px 12px'}}>
              <span>Posición neta 15d</span>
              <span style={{fontFamily:'monospace',color:posNeta>0?'#3ddc84':'#ff5050'}}>{fmt(posNeta)}</span>
            </div>
          </div>

          <div style={S.sec}>Últimos cambios del equipo</div>
          <div style={S.card}>
            {historial.slice(0,5).map((h,i) => (
              <div key={i} style={{...S.row,...(i===4?{borderBottom:'none'}:{})}}>
                <div>
                  <span style={{fontSize:'11px',color:C.accent,fontWeight:600}}>{h.usuario_nombre} </span>
                  <span style={{fontSize:'11px',color:C.label}}>{h.descripcion}</span>
                </div>
                <span style={{fontSize:'10px',color:C.muted,fontFamily:'monospace',flexShrink:0,marginLeft:'8px'}}>{new Date(h.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span>
              </div>
            ))}
            {historial.length === 0 && <p style={{fontSize:'12px',color:C.muted,textAlign:'center',padding:'12px 0'}}>Sin cambios hoy</p>}
          </div>
        </div>
      )}

      {/* CARGAR */}
      {tab === 'cargar' && (
        <div className="fomo-content" style={S.page}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'4px'}}>
            <div style={S.sec}>Datos del día</div>
            <input type="date" style={{background:C.inputBg,border:`1px solid ${C.cardBorder}`,borderRadius:'10px',color:C.text,fontFamily:'DM Mono,monospace',fontSize:'13px',padding:'8px 12px',outline:'none',cursor:'pointer'}}
              value={fechaCarga}
              onChange={e => { setFechaCarga(e.target.value); cargarFecha(e.target.value) }}
            />
          </div>
          {fechaCarga !== hoyStr() && (
            <div style={{background:'rgba(245,224,0,0.08)',border:'1px solid rgba(245,224,0,0.25)',borderRadius:'12px',padding:'12px 14px',marginBottom:'12px',fontSize:'13px',color:C.accent,fontWeight:600,lineHeight:1.7}}>
              ✏️ Editando datos del {fechaCarga.split('-').reverse().join('/')}<br/>
              <span style={{fontSize:'12px',fontWeight:400,color:C.label}}>Los valores ya están cargados — cambiá solo el que estaba mal y guardá.</span>
            </div>
          )}
          {[
            {label:'Efectivo en caja ($)', key:'efectivo'},
            {label:'Transferencias recibidas ($)', key:'transferencias'},
            {label:'Cheques / E-cheq recibidos ($)', key:'cheque_recibido'},
            {label:'Tarjeta pendiente de acreditación ($)', key:'tarjeta_pendiente', hint:'Lo que el banco todavía no acreditó'},
            {label:'Saldo banco ($)', key:'saldo_banco'},
            {label:'Ventas acumuladas del mes ($)', key:'ventas_acumuladas_mes'},
          ].map(f => (
            <div key={f.key} style={S.card}>
              <label style={S.label}>{f.label}</label>
              <input type="number" inputMode="numeric" style={S.inp}
                value={datosDia[f.key] || ''}
                placeholder="0"
                onChange={e => setDatosDia({...datosDia, [f.key]: parseFloat(e.target.value)||0})}
              />
              {f.hint && <p style={{fontSize:'10px',color:C.muted,marginTop:'5px',fontFamily:'monospace'}}>{f.hint}</p>}
            </div>
          ))}
          <div style={S.card}>
            <label style={S.label}>Notas del día (opcional)</label>
            <input type="text" style={S.inp} placeholder="ej: día lento, falta stock..."
              value={datosDia.notas||''} onChange={e => setDatosDia({...datosDia, notas:e.target.value})}/>
          </div>
          <button style={{...S.btn, background: fechaCarga !== hoyStr() ? C.inputBg : C.accent, color: fechaCarga !== hoyStr() ? C.accent : '#000', border: fechaCarga !== hoyStr() ? `2px solid ${C.accent}` : 'none'}} onClick={guardarDatos} disabled={saving}>
            {saving ? 'Guardando...' : fechaCarga !== hoyStr() ? `✏️ Guardar modificación del ${fechaCarga.split('-').reverse().join('/')}` : `Guardar — ${usuario?.nombre}`}
          </button>

          <div style={S.sec}>Registrar gasto del día</div>
          <div style={S.card}>
            <label style={S.label}>Descripción</label>
            <input type="text" style={{...S.inp,marginBottom:'10px'}} placeholder="ej: Pago proveedor fundas"
              value={fGasto.descripcion} onChange={e=>setFGasto({...fGasto,descripcion:e.target.value})}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'9px'}}>
              <div>
                <label style={S.label}>Monto ($)</label>
                <input type="number" inputMode="numeric" style={S.inp} placeholder="0"
                  value={fGasto.monto} onChange={e=>setFGasto({...fGasto,monto:e.target.value})}/>
              </div>
              <div>
                <label style={S.label}>Categoría</label>
                <select style={S.sel} value={fGasto.categoria} onChange={e=>setFGasto({...fGasto,categoria:e.target.value})}>
                  <option value="stock">Stock</option>
                  <option value="mercaderia">Mercadería / Efectivo</option>
                  <option value="prestamo">Préstamo otorgado</option>
                  <option value="sueldo">Sueldo</option>
                  <option value="alquiler">Alquiler</option>
                  <option value="banco">Banco</option>
                  <option value="impuesto">Impuesto</option>
                  <option value="servicio">Servicio</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
            <button style={{...S.btn,marginTop:'12px',background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.text}} onClick={agregarGasto}>
              + Registrar gasto
            </button>
          </div>

          <div style={S.sec}>Registrar cambio de dinero</div>
          <div style={S.card}>
            <label style={S.label}>Tipo de cambio</label>
            <select style={{...S.sel,marginBottom:'10px'}} value={fCambio.tipo} onChange={e=>setFCambio({...fCambio,tipo:e.target.value})}>
              <option value="cheque_efectivo">Cheque → Efectivo</option>
              <option value="echeq_efectivo">E-cheq → Efectivo</option>
              <option value="banco_efectivo">Banco → Efectivo</option>
              <option value="efectivo_banco">Efectivo → Banco</option>
              <option value="transferencia_efectivo">Transferencia → Efectivo</option>
              <option value="efectivo_transferencia">Efectivo → Transferencia</option>
            </select>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'9px',marginBottom:'10px'}}>
              <div>
                <label style={S.label}>Valor original ($)</label>
                <input type="number" inputMode="numeric" style={S.inp} placeholder="0"
                  value={fCambio.monto_original} onChange={e=>setFCambio({...fCambio,monto_original:e.target.value})}/>
              </div>
              <div>
                <label style={S.label}>Lo que recibís ($)</label>
                <input type="number" inputMode="numeric" style={S.inp} placeholder="0"
                  value={fCambio.monto_recibido} onChange={e=>setFCambio({...fCambio,monto_recibido:e.target.value})}/>
              </div>
            </div>
            {fCambio.monto_original && fCambio.monto_recibido && parseFloat(fCambio.monto_original) > parseFloat(fCambio.monto_recibido) && (
              <div style={{background:'rgba(255,80,80,0.1)',border:'1px solid rgba(255,80,80,0.2)',borderRadius:'8px',padding:'9px 12px',marginBottom:'10px',fontSize:'12px',color:'#ff8080',fontFamily:'monospace'}}>
                Descuento: {fmt(parseFloat(fCambio.monto_original) - parseFloat(fCambio.monto_recibido))} ({((1 - parseFloat(fCambio.monto_recibido)/parseFloat(fCambio.monto_original))*100).toFixed(1)}%)
              </div>
            )}
            <label style={S.label}>Nota (opcional)</label>
            <input type="text" style={{...S.inp,marginBottom:'10px'}} placeholder="ej: descuento con cambista"
              value={fCambio.descripcion} onChange={e=>setFCambio({...fCambio,descripcion:e.target.value})}/>
            <button style={{...S.btn,background:'transparent',border:'1px solid rgba(34,211,238,0.4)',color:'#22d3ee'}} onClick={agregarCambio}>
              + Registrar cambio
            </button>
          </div>

          {gastos.length > 0 && (
            <>
              <div style={S.sec}>Gastos registrados hoy</div>
              <div style={S.card}>
                {gastos.map((g,i) => (
                  <div key={i} style={{...S.row,...(i===gastos.length-1?{borderBottom:'none'}:{})}}>
                    <div>
                      <span style={{fontSize:'12px'}}>{g.descripcion} </span>
                      {tipoBadge(g.categoria)}
                      <div style={{fontSize:'10px',color:C.muted,fontFamily:'monospace',marginTop:'2px'}}>{g.usuario_nombre}</div>
                    </div>
                    <span style={{fontFamily:'monospace',fontSize:'12px',color:C.red}}>{fmt(g.monto)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* PAGOS */}
      {tab === 'pagos' && (
        <div className="fomo-content" style={S.page}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
            <div style={S.sec}>Vencimientos a pagar</div>
            <button style={{fontSize:'11px',color:C.accent,background:'none',border:'none',cursor:'pointer',fontFamily:"'Syne',sans-serif",fontWeight:700,padding:'4px 8px'}} onClick={()=>setModal('venc')}>+ Nuevo</button>
          </div>
          <div style={{...S.card,padding:0,overflow:'hidden'}}>
            {vencimientos.map((v,i) => {
              const d = diasHasta(v.fecha)
              const col = d < 0 ? '#3a3a38' : d === 0 ? '#ff5050' : d <= 3 ? '#ff5050' : d <= 7 ? '#f5a623' : '#5b9fff'
              const badge = d < 0 ? 'PASADO' : d === 0 ? 'HOY' : d === 1 ? 'MAÑ' : `${d}d`
              return (
                <div key={i} style={{padding:'11px 13px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'12px',marginBottom:'3px'}}>{v.descripcion} {tipoBadge(v.tipo)}</div>
                    <div style={{fontSize:'10px',color:C.label,fontFamily:'monospace'}}>{v.fecha.split('-').reverse().join('/')} · {v.usuario_nombre||'sistema'}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontFamily:'monospace',fontSize:'12px',color:C.red,marginBottom:'3px'}}>{fmtS(v.monto)}</div>
                    <span style={{fontSize:'9px',fontWeight:700,padding:'2px 6px',borderRadius:'4px',background:col+'22',color:col,fontFamily:'monospace'}}>{badge}</span>
                  </div>
                  <button style={{background:'none',border:'none',color:C.green,cursor:'pointer',fontSize:'16px',padding:'4px'}} onClick={()=>marcarPagado(v.id, v.descripcion)}>✓</button>
                </div>
              )
            })}
            {vencimientos.length === 0 && <p style={{fontSize:'12px',color:C.muted,textAlign:'center',padding:'20px'}}>Sin vencimientos pendientes</p>}
          </div>

          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px',marginTop:'4px'}}>
            <div style={S.sec}>Deudas registradas</div>
            <button style={{fontSize:'11px',color:C.accent,background:'none',border:'none',cursor:'pointer',fontFamily:"'Syne',sans-serif",fontWeight:700,padding:'4px 8px'}} onClick={()=>setModal('deuda')}>+ Nueva</button>
          </div>
          <div style={{...S.card,padding:0,overflow:'hidden'}}>
            {deudas.map((d,i) => (
              <div key={i} style={{padding:'11px 13px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:'8px'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'12px',marginBottom:'3px'}}>{d.descripcion} {tipoBadge(d.tipo)}</div>
                  <div style={{fontSize:'10px',color:C.muted,fontFamily:'monospace'}}>{d.usuario_nombre||'sistema'}</div>
                </div>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:C.red}}>{fmtS(d.monto)}</span>
                <button style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'13px',padding:'4px'}} onClick={()=>eliminarItem('deudas',d.id,d.descripcion)}>✕</button>
              </div>
            ))}
          </div>
          <div style={{...S.card,background:'rgba(245,166,35,0.06)',border:'1px solid rgba(245,166,35,0.15)'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'14px',fontWeight:700}}>
              <span>Total deuda registrada</span>
              <span style={{fontFamily:'monospace',color:C.red}}>{fmtS(totalDeudas)}</span>
            </div>
          </div>
        </div>
      )}

      {/* P&L */}
      {tab === 'pl' && (
        <div className="fomo-content" style={S.page}>
          <div style={S.sec}>P&L del mes — {new Date().toLocaleString('es-AR',{month:'long',year:'numeric'})}</div>
          <div style={S.card}>
            {[
              {l:'Ventas acumuladas', v:datosDia.ventas_acumuladas_mes, c:'#3ddc84'},
              {l:'CMV estimado (61.2%)', v:-cmv, c:'#ff5050'},
            ].map((r,i)=>(
              <div key={i} style={S.row}><span style={{color:C.label,fontSize:'12px'}}>{r.l}</span><span style={{fontFamily:'monospace',fontSize:'12px',color:r.c}}>{fmt(r.v)}</span></div>
            ))}
            <div style={{...S.row,fontWeight:700,fontSize:'13px',borderTop:'1px solid rgba(255,255,255,0.13)',marginTop:'4px',paddingTop:'10px'}}>
              <span>Margen bruto</span><span style={{fontFamily:'monospace',color:mb>0?'#3ddc84':'#ff5050'}}>{fmt(mb)}</span>
            </div>
            {[
              {l:'Sueldos', v:-9340241},
              {l:'Alquileres', v:-6033219},
              {l:'Inversor (1.500 USD)', v:-2160000},
              {l:'Santander + ARCA + otros', v:-2628220},
            ].map((r,i)=>(
              <div key={i} style={S.row}><span style={{color:C.label,fontSize:'12px'}}>{r.l}</span><span style={{fontFamily:'monospace',fontSize:'12px',color:C.red}}>{fmt(r.v)}</span></div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:'14px',background:'rgba(245,166,35,0.06)',margin:'4px -13px -13px',padding:'12px 13px',borderRadius:'0 0 12px 12px'}}>
              <span>Resultado neto est.</span><span style={{fontFamily:'monospace',color:neto>0?'#3ddc84':'#ff5050'}}>{fmt(neto)}</span>
            </div>
          </div>

          <div style={S.sec}>Margen por categoría (estimado)</div>
          <div style={S.card}>
            {[
              {cat:'Celulares', pct:'14-18%', color:C.blue, nota:'Volumen alto, margen bajo'},
              {cat:'Accesorios (fundas, templados)', pct:'74-89%', color:C.green, nota:'El negocio rentable'},
              {cat:'Electrónica (auriculares, etc)', pct:'55-60%', color:C.accent, nota:'Margen intermedio'},
              {cat:'Servicio técnico', pct:'100%', color:C.green, nota:'Sin costo de mercadería'},
            ].map((r,i)=>(
              <div key={i} style={{...S.row,...(i===3?{borderBottom:'none'}:{})}}>
                <div><div style={{fontSize:'12px',marginBottom:'2px'}}>{r.cat}</div><div style={{fontSize:'10px',color:C.muted}}>{r.nota}</div></div>
                <span style={{fontFamily:'monospace',fontSize:'13px',fontWeight:700,color:r.color}}>{r.pct}</span>
              </div>
            ))}
          </div>

          <div style={S.sec}>Stock valorizado</div>
          <div style={S.card}>
            {stock.map((s,i)=>(
              <div key={i} style={{...S.row,...(i===stock.length-1?{borderBottom:'none'}:{})}}>
                <div><div style={{fontSize:'12px'}}>{s.descripcion||s.categoria}</div><div style={{fontSize:'10px',color:C.label,fontFamily:'monospace'}}>{s.cantidad} uds · {fmtS(s.costo_unitario)} c/u</div></div>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:C.blue}}>{fmtS(s.cantidad*s.costo_unitario)}</span>
              </div>
            ))}
            <div style={{...S.row,borderBottom:'none',fontWeight:700,fontSize:'13px',borderTop:'1px solid rgba(255,255,255,0.13)',marginTop:'4px',paddingTop:'10px'}}>
              <span>Stock total valorizado</span><span style={{fontFamily:'monospace',color:C.blue}}>{fmtS(stockValor)}</span>
            </div>
          </div>

          <div style={S.sec}>Proveedores</div>
          <div style={S.card}>
            {proveedores.map((p,i)=>(
              <div key={i} style={{...S.row,...(i===proveedores.length-1?{borderBottom:'none'}:{})}}>
                <span style={{fontSize:'12px',color:C.label}}>{p.nombre}</span>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:C.red}}>{fmtS(p.deuda_actual)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MÁS */}
      {tab === 'mas' && (
        <div className="fomo-content" style={S.page}>
          <div style={S.sec}>Historial de cambios</div>
          <div style={S.card}>
            {historial.map((h,i)=>(
              <div key={i} style={{...S.row,...(i===historial.length-1?{borderBottom:'none'}:{})}}>
                <div style={{flex:1}}>
                  <span style={{fontSize:'11px',color:C.accent,fontWeight:600}}>{h.usuario_nombre} </span>
                  <span style={{fontSize:'11px',color:C.label}}>{h.descripcion}</span>
                </div>
                <span style={{fontSize:'9px',color:C.muted,fontFamily:'monospace',flexShrink:0,marginLeft:'8px'}}>{new Date(h.created_at).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
              </div>
            ))}
            {historial.length===0 && <p style={{fontSize:'12px',color:C.muted,textAlign:'center',padding:'12px 0'}}>Sin historial</p>}
          </div>

          <div style={S.sec}>Mi cuenta</div>
          <div style={S.card}>
            <div style={S.row}><span style={{color:C.label,fontSize:'12px'}}>Usuario</span><span style={{fontSize:'12px',fontFamily:'monospace',color:C.accent}}>{usuario?.nombre}</span></div>
            <div style={{...S.row,borderBottom:'none'}}><span style={{color:C.label,fontSize:'12px'}}>Rol</span><span style={{fontSize:'11px',fontFamily:'monospace',background:'rgba(91,159,255,0.15)',color:C.blue,padding:'2px 8px',borderRadius:'4px'}}>{usuario?.rol}</span></div>
          </div>

          <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,80,80,0.3)',color:C.red,marginTop:'8px'}} onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      )}

      {/* MODAL VENCIMIENTO */}
      {modal === 'venc' && (
        <div className="fomo-modal-wrap" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:300,display:'flex',alignItems:'flex-end'}} onClick={e=>{if(e.target===e.currentTarget)setModal('')}}>
          <div className="fomo-modal-inner" style={{background:C.card,borderRadius:'16px 16px 0 0',padding:'20px 16px 36px',width:'100%',borderTop:'1px solid rgba(255,255,255,0.13)'}}>
            <h3 style={{fontSize:'15px',fontWeight:700,marginBottom:'14px',color:C.text}}>Nuevo vencimiento</h3>
            {[
              {label:'Fecha', type:'date', key:'fecha'},
              {label:'Descripción', type:'text', key:'descripcion', placeholder:'ej: Cheque MACRO'},
              {label:'Monto ($)', type:'number', key:'monto', placeholder:'0'},
            ].map(f=>(
              <div key={f.key} style={{marginBottom:'9px'}}>
                <label style={S.label}>{f.label}</label>
                <input type={f.type} inputMode={f.type==='number'?'numeric':undefined} style={S.inp}
                  placeholder={f.placeholder||''}
                  value={fVenc[f.key]} onChange={e=>setFVenc({...fVenc,[f.key]:e.target.value})}/>
              </div>
            ))}
            <div style={{marginBottom:'9px'}}>
              <label style={S.label}>Tipo</label>
              <select style={S.sel} value={fVenc.tipo} onChange={e=>setFVenc({...fVenc,tipo:e.target.value})}>
                <option value="cheque">Cheque físico</option>
                <option value="echeq">E-cheq (cheque electrónico)</option>
                <option value="prestamo">Préstamo a cobrar</option>
                <option value="banco">Banco / Préstamo</option>
                <option value="impuesto">Impuesto / AFIP</option>
                <option value="sueldo">Sueldo</option>
                <option value="servicio">Servicio</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'8px'}}>
              <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label}} onClick={()=>setModal('')}>Cancelar</button>
              <button style={S.btn} onClick={agregarVencimiento}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEUDA */}
      {modal === 'deuda' && (
        <div className="fomo-modal-wrap" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:300,display:'flex',alignItems:'flex-end'}} onClick={e=>{if(e.target===e.currentTarget)setModal('')}}>
          <div className="fomo-modal-inner" style={{background:C.card,borderRadius:'16px 16px 0 0',padding:'20px 16px 36px',width:'100%',borderTop:'1px solid rgba(255,255,255,0.13)'}}>
            <h3 style={{fontSize:'15px',fontWeight:700,marginBottom:'14px',color:C.text}}>Nueva deuda</h3>
            {[
              {label:'Descripción', type:'text', key:'descripcion', placeholder:'ej: Tarjeta VISA Macro'},
              {label:'Monto ($)', type:'number', key:'monto', placeholder:'0'},
            ].map(f=>(
              <div key={f.key} style={{marginBottom:'9px'}}>
                <label style={S.label}>{f.label}</label>
                <input type={f.type} inputMode={f.type==='number'?'numeric':undefined} style={S.inp}
                  placeholder={f.placeholder}
                  value={fDeuda[f.key]} onChange={e=>setFDeuda({...fDeuda,[f.key]:e.target.value})}/>
              </div>
            ))}
            <div style={{marginBottom:'9px'}}>
              <label style={S.label}>Tipo</label>
              <select style={S.sel} value={fDeuda.tipo} onChange={e=>setFDeuda({...fDeuda,tipo:e.target.value})}>
                <option value="tarjeta">Tarjeta de crédito</option>
                <option value="banco">Préstamo bancario</option>
                <option value="proveedor">Proveedor</option>
                <option value="impuesto">Impuesto / AFIP</option>
                <option value="personal">Crédito personal</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'8px'}}>
              <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label}} onClick={()=>setModal('')}>Cancelar</button>
              <button style={S.btn} onClick={agregarDeuda}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAV (solo mobile) */}
      <nav className="fomo-bottom-nav" style={{position:'fixed',bottom:0,left:0,right:0,background:C.card,borderTop:`1px solid ${C.cardBorder}`,zIndex:200}}>
        {navItems.map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)}
            style={{flex:1,padding:'12px 4px 10px',display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',cursor:'pointer',fontSize:'10px',fontWeight:700,letterSpacing:'.05em',color:tab===n.id?C.accent:C.muted,textTransform:'uppercase',border:'none',background:'none',fontFamily:"'Syne',sans-serif",transition:'color .15s'}}>
            <span style={{fontSize:'18px',lineHeight:1}}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      </div>{/* end fomo-main */}
      </div>{/* end fomo-desktop-layout */}
    </div>
  )
}
