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

  async function guardarDatos() {
    setSaving(true)
    const supabase = getSupabase()
    const { error } = await supabase.from('datos_diarios').upsert({
      ...datosDia, fecha: hoyStr(),
      usuario_nombre: usuario?.nombre,
      updated_at: new Date().toISOString()
    }, { onConflict: 'fecha' })
    if (!error) {
      await logH('UPDATE', `Actualizó datos del día — caja: ${fmtS(datosDia.efectivo + datosDia.transferencias + datosDia.saldo_banco)}`)
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
    await supabase.from('gastos').insert({...fGasto, monto: parseFloat(fGasto.monto), fecha: hoyStr(), usuario_nombre: usuario?.nombre})
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
    const tipos = {'cheque_efectivo':'Cheque → Efectivo','echeq_efectivo':'E-cheq → Efectivo','banco_efectivo':'Banco → Efectivo','efectivo_banco':'Efectivo → Banco','transferencia_efectivo':'Transferencia → Efectivo'}
    const tipoLabel = tipos[fCambio.tipo] || fCambio.tipo
    const desc = `Cambio: ${tipoLabel} | Original: ${fmt(orig)} | Recibido: ${fmt(recib)}${descuento > 0 ? ` | Descuento: ${fmt(descuento)}` : ''}${fCambio.descripcion ? ` — ${fCambio.descripcion}` : ''}`
    await supabase.from('gastos').insert({descripcion: desc, monto: descuento > 0 ? descuento : 0, fecha: hoyStr(), categoria: 'cambio', usuario_nombre: usuario?.nombre})
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

  const S = {
    page: {padding:'14px 14px 80px',fontFamily:"'Syne',sans-serif"},
    sec: {fontSize:'10px',fontWeight:700,letterSpacing:'.14em',color:'#3a3a38',textTransform:'uppercase',margin:'18px 0 10px'},
    card: {background:'#141416',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'13px',marginBottom:'10px'},
    inp: {width:'100%',background:'#1c1c20',border:'1px solid rgba(255,255,255,0.13)',borderRadius:'8px',color:'#eeecea',fontFamily:'DM Mono,monospace',fontSize:'16px',padding:'11px 12px',outline:'none',boxSizing:'border-box'},
    sel: {width:'100%',background:'#1c1c20',border:'1px solid rgba(255,255,255,0.13)',borderRadius:'8px',color:'#7a7876',fontFamily:'DM Mono,monospace',fontSize:'15px',padding:'11px 12px',outline:'none',boxSizing:'border-box'},
    btn: {width:'100%',background:'#f5a623',color:'#000',border:'none',borderRadius:'10px',padding:'13px',fontSize:'14px',fontWeight:700,fontFamily:"'Syne',sans-serif",cursor:'pointer'},
    row: {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,0.07)',fontSize:'12px'},
    label: {fontSize:'11px',color:'#7a7876',display:'block',marginBottom:'7px',fontWeight:600},
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#0c0c0e',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <p style={{color:'#f5a623',fontFamily:'monospace',fontSize:'13px'}}>Cargando FOMO...</p>
    </div>
  )

  return (
    <div style={{background:'#0c0c0e',minHeight:'100vh',color:'#eeecea'}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <div style={{padding:'14px 16px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'#0c0c0e',position:'sticky',top:0,zIndex:100}}>
        <div style={{fontSize:'19px',fontWeight:800,letterSpacing:'-.5px'}}>FO<span style={{color:'#f5a623'}}>MO</span></div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          {msg && <span style={{fontSize:'11px',color:'#3ddc84',fontFamily:'monospace'}}>{msg}</span>}
          <span style={{fontSize:'10px',color:'#7a7876',background:'#1c1c20',padding:'5px 10px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.07)',fontFamily:'monospace'}}>{fechaLabel()}</span>
          <span style={{fontSize:'10px',color:'#f5a623',fontFamily:'monospace',cursor:'pointer'}} onClick={logout}>salir</span>
        </div>
      </div>

      {/* ALERTAS */}
      {tab === 'hoy' && (
        <div style={{padding:'10px 14px 0'}}>
          {vencimientos.filter(v => diasHasta(v.fecha) === 0).length > 0 && (
            <div style={{background:'rgba(255,80,80,0.12)',border:'1px solid rgba(255,80,80,0.2)',borderRadius:'10px',padding:'11px 13px',fontSize:'12px',color:'#ff8080',marginBottom:'8px',lineHeight:1.5}}>
              <strong>HOY vencen: </strong>{vencimientos.filter(v=>diasHasta(v.fecha)===0).map(v=>v.descripcion).join(', ')} — {fmt(vencimientos.filter(v=>diasHasta(v.fecha)===0).reduce((s,v)=>s+v.monto,0))}
            </div>
          )}
          {vencimientos.filter(v => diasHasta(v.fecha) === 1).length > 0 && (
            <div style={{background:'rgba(245,166,35,0.12)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:'10px',padding:'11px 13px',fontSize:'12px',color:'#f5c06a',marginBottom:'8px',lineHeight:1.5}}>
              <strong>Mañana vencen: </strong>{vencimientos.filter(v=>diasHasta(v.fecha)===1).map(v=>v.descripcion).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* HOY */}
      {tab === 'hoy' && (
        <div style={S.page}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'9px',marginBottom:'14px'}}>
            {[
              {label:'VENTAS HOY',val:ventasHoy>0?fmtS(ventasHoy):'—',color:colorVentas,sub:`${pctObj}% del objetivo`,prog:pctObj},
              {label:'CAJA TOTAL',val:fmtS(cajaTotal),color:colorCaja,sub:'efectivo + banco',prog:0},
              {label:'VENCE 7 DÍAS',val:fmtS(tv7),color:'#ff5050',sub:`${v7.length} obligacion(es)`,prog:0},
              {label:'MES ACTUAL',val:fmtS(datosDia.ventas_acumuladas_mes),color:'#5b9fff',sub:`${new Date().getDate()} días`,prog:0},
            ].map((k,i) => (
              <div key={i} style={{...S.card,position:'relative',overflow:'hidden',paddingTop:'15px'}}>
                <div style={{position:'absolute',top:0,left:0,right:0,height:'2px',background:k.color}}/>
                <div style={{fontSize:'10px',color:'#7a7876',marginBottom:'6px',fontWeight:600,letterSpacing:'.04em'}}>{k.label}</div>
                <div style={{fontSize:'21px',fontWeight:700,fontFamily:'DM Mono,monospace',letterSpacing:'-1px',color:k.color,lineHeight:1}}>{k.val}</div>
                <div style={{fontSize:'10px',color:'#7a7876',marginTop:'5px',fontFamily:'monospace'}}>{k.sub}</div>
                {k.prog > 0 && <div style={{background:'#1c1c20',borderRadius:'3px',height:'3px',marginTop:'8px',overflow:'hidden'}}><div style={{height:'100%',borderRadius:'3px',background:k.color,width:k.prog+'%'}}/></div>}
              </div>
            ))}
          </div>

          <div style={S.sec}>Detalle de cobros de hoy</div>
          <div style={S.card}>
            {[
              {label:'Efectivo', val:datosDia.efectivo},
              {label:'Transferencias', val:datosDia.transferencias},
              {label:'Cheques / E-cheq recibidos', val:datosDia.cheque_recibido},
              {label:'Tarjeta (pendiente acred.)', val:datosDia.tarjeta_pendiente, color:'#f5a623'},
            ].map((r,i) => (
              <div key={i} style={{...S.row,...(i===3?{borderBottom:'none'}:{})}}>
                <span style={{color:'#7a7876'}}>{r.label}</span>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:r.color||'#eeecea'}}>{fmt(r.val||0)}</span>
              </div>
            ))}
            <div style={{...S.row,borderBottom:'none',fontWeight:700,fontSize:'13px',paddingTop:'12px',borderTop:'1px solid rgba(255,255,255,0.13)',marginTop:'4px'}}>
              <span>Total cobrado hoy</span>
              <span style={{fontFamily:'monospace',color:'#3ddc84'}}>{fmt(ventasHoy)}</span>
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
                <span style={{color:'#7a7876',fontSize:'12px'}}>{r.l}</span>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:r.c}}>{fmt(r.v||0)}</span>
              </div>
            ))}
            <div style={{...S.row,fontWeight:700,fontSize:'13px',borderTop:'1px solid rgba(255,255,255,0.13)',marginTop:'4px',paddingTop:'10px'}}>
              <span>Total disponible</span>
              <span style={{fontFamily:'monospace',color:disponibleTotal>2e6?'#3ddc84':'#f5a623'}}>{fmt(disponibleTotal)}</span>
            </div>
            <div style={S.row}><span style={{color:'#7a7876',fontSize:'12px'}}>Vence próx. 15 días</span><span style={{fontFamily:'monospace',fontSize:'12px',color:'#ff5050'}}>−{fmt(tv15)}</span></div>
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
                  <span style={{fontSize:'11px',color:'#f5a623',fontWeight:600}}>{h.usuario_nombre} </span>
                  <span style={{fontSize:'11px',color:'#7a7876'}}>{h.descripcion}</span>
                </div>
                <span style={{fontSize:'10px',color:'#3a3a38',fontFamily:'monospace',flexShrink:0,marginLeft:'8px'}}>{new Date(h.created_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span>
              </div>
            ))}
            {historial.length === 0 && <p style={{fontSize:'12px',color:'#3a3a38',textAlign:'center',padding:'12px 0'}}>Sin cambios hoy</p>}
          </div>
        </div>
      )}

      {/* CARGAR */}
      {tab === 'cargar' && (
        <div style={S.page}>
          <div style={S.sec}>Cobros del día — {fechaLabel()}</div>
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
              {f.hint && <p style={{fontSize:'10px',color:'#3a3a38',marginTop:'5px',fontFamily:'monospace'}}>{f.hint}</p>}
            </div>
          ))}
          <div style={S.card}>
            <label style={S.label}>Notas del día (opcional)</label>
            <input type="text" style={S.inp} placeholder="ej: día lento, falta stock..."
              value={datosDia.notas||''} onChange={e => setDatosDia({...datosDia, notas:e.target.value})}/>
          </div>
          <button style={S.btn} onClick={guardarDatos} disabled={saving}>
            {saving ? 'Guardando...' : `Guardar — ${usuario?.nombre}`}
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
            <button style={{...S.btn,marginTop:'12px',background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:'#eeecea'}} onClick={agregarGasto}>
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
                      <div style={{fontSize:'10px',color:'#3a3a38',fontFamily:'monospace',marginTop:'2px'}}>{g.usuario_nombre}</div>
                    </div>
                    <span style={{fontFamily:'monospace',fontSize:'12px',color:'#ff5050'}}>{fmt(g.monto)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* PAGOS */}
      {tab === 'pagos' && (
        <div style={S.page}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
            <div style={S.sec}>Vencimientos a pagar</div>
            <button style={{fontSize:'11px',color:'#f5a623',background:'none',border:'none',cursor:'pointer',fontFamily:"'Syne',sans-serif",fontWeight:700,padding:'4px 8px'}} onClick={()=>setModal('venc')}>+ Nuevo</button>
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
                    <div style={{fontSize:'10px',color:'#7a7876',fontFamily:'monospace'}}>{v.fecha.split('-').reverse().join('/')} · {v.usuario_nombre||'sistema'}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontFamily:'monospace',fontSize:'12px',color:'#ff5050',marginBottom:'3px'}}>{fmtS(v.monto)}</div>
                    <span style={{fontSize:'9px',fontWeight:700,padding:'2px 6px',borderRadius:'4px',background:col+'22',color:col,fontFamily:'monospace'}}>{badge}</span>
                  </div>
                  <button style={{background:'none',border:'none',color:'#3ddc84',cursor:'pointer',fontSize:'16px',padding:'4px'}} onClick={()=>marcarPagado(v.id, v.descripcion)}>✓</button>
                </div>
              )
            })}
            {vencimientos.length === 0 && <p style={{fontSize:'12px',color:'#3a3a38',textAlign:'center',padding:'20px'}}>Sin vencimientos pendientes</p>}
          </div>

          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px',marginTop:'4px'}}>
            <div style={S.sec}>Deudas registradas</div>
            <button style={{fontSize:'11px',color:'#f5a623',background:'none',border:'none',cursor:'pointer',fontFamily:"'Syne',sans-serif",fontWeight:700,padding:'4px 8px'}} onClick={()=>setModal('deuda')}>+ Nueva</button>
          </div>
          <div style={{...S.card,padding:0,overflow:'hidden'}}>
            {deudas.map((d,i) => (
              <div key={i} style={{padding:'11px 13px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:'8px'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'12px',marginBottom:'3px'}}>{d.descripcion} {tipoBadge(d.tipo)}</div>
                  <div style={{fontSize:'10px',color:'#3a3a38',fontFamily:'monospace'}}>{d.usuario_nombre||'sistema'}</div>
                </div>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:'#ff5050'}}>{fmtS(d.monto)}</span>
                <button style={{background:'none',border:'none',color:'#3a3a38',cursor:'pointer',fontSize:'13px',padding:'4px'}} onClick={()=>eliminarItem('deudas',d.id,d.descripcion)}>✕</button>
              </div>
            ))}
          </div>
          <div style={{...S.card,background:'rgba(245,166,35,0.06)',border:'1px solid rgba(245,166,35,0.15)'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'14px',fontWeight:700}}>
              <span>Total deuda registrada</span>
              <span style={{fontFamily:'monospace',color:'#ff5050'}}>{fmtS(totalDeudas)}</span>
            </div>
          </div>
        </div>
      )}

      {/* P&L */}
      {tab === 'pl' && (
        <div style={S.page}>
          <div style={S.sec}>P&L del mes — {new Date().toLocaleString('es-AR',{month:'long',year:'numeric'})}</div>
          <div style={S.card}>
            {[
              {l:'Ventas acumuladas', v:datosDia.ventas_acumuladas_mes, c:'#3ddc84'},
              {l:'CMV estimado (61.2%)', v:-cmv, c:'#ff5050'},
            ].map((r,i)=>(
              <div key={i} style={S.row}><span style={{color:'#7a7876',fontSize:'12px'}}>{r.l}</span><span style={{fontFamily:'monospace',fontSize:'12px',color:r.c}}>{fmt(r.v)}</span></div>
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
              <div key={i} style={S.row}><span style={{color:'#7a7876',fontSize:'12px'}}>{r.l}</span><span style={{fontFamily:'monospace',fontSize:'12px',color:'#ff5050'}}>{fmt(r.v)}</span></div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:'14px',background:'rgba(245,166,35,0.06)',margin:'4px -13px -13px',padding:'12px 13px',borderRadius:'0 0 12px 12px'}}>
              <span>Resultado neto est.</span><span style={{fontFamily:'monospace',color:neto>0?'#3ddc84':'#ff5050'}}>{fmt(neto)}</span>
            </div>
          </div>

          <div style={S.sec}>Margen por categoría (estimado)</div>
          <div style={S.card}>
            {[
              {cat:'Celulares', pct:'14-18%', color:'#5b9fff', nota:'Volumen alto, margen bajo'},
              {cat:'Accesorios (fundas, templados)', pct:'74-89%', color:'#3ddc84', nota:'El negocio rentable'},
              {cat:'Electrónica (auriculares, etc)', pct:'55-60%', color:'#f5a623', nota:'Margen intermedio'},
              {cat:'Servicio técnico', pct:'100%', color:'#3ddc84', nota:'Sin costo de mercadería'},
            ].map((r,i)=>(
              <div key={i} style={{...S.row,...(i===3?{borderBottom:'none'}:{})}}>
                <div><div style={{fontSize:'12px',marginBottom:'2px'}}>{r.cat}</div><div style={{fontSize:'10px',color:'#3a3a38'}}>{r.nota}</div></div>
                <span style={{fontFamily:'monospace',fontSize:'13px',fontWeight:700,color:r.color}}>{r.pct}</span>
              </div>
            ))}
          </div>

          <div style={S.sec}>Stock valorizado</div>
          <div style={S.card}>
            {stock.map((s,i)=>(
              <div key={i} style={{...S.row,...(i===stock.length-1?{borderBottom:'none'}:{})}}>
                <div><div style={{fontSize:'12px'}}>{s.descripcion||s.categoria}</div><div style={{fontSize:'10px',color:'#7a7876',fontFamily:'monospace'}}>{s.cantidad} uds · {fmtS(s.costo_unitario)} c/u</div></div>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:'#5b9fff'}}>{fmtS(s.cantidad*s.costo_unitario)}</span>
              </div>
            ))}
            <div style={{...S.row,borderBottom:'none',fontWeight:700,fontSize:'13px',borderTop:'1px solid rgba(255,255,255,0.13)',marginTop:'4px',paddingTop:'10px'}}>
              <span>Stock total valorizado</span><span style={{fontFamily:'monospace',color:'#5b9fff'}}>{fmtS(stockValor)}</span>
            </div>
          </div>

          <div style={S.sec}>Proveedores</div>
          <div style={S.card}>
            {proveedores.map((p,i)=>(
              <div key={i} style={{...S.row,...(i===proveedores.length-1?{borderBottom:'none'}:{})}}>
                <span style={{fontSize:'12px',color:'#7a7876'}}>{p.nombre}</span>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:'#ff5050'}}>{fmtS(p.deuda_actual)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MÁS */}
      {tab === 'mas' && (
        <div style={S.page}>
          <div style={S.sec}>Historial de cambios</div>
          <div style={S.card}>
            {historial.map((h,i)=>(
              <div key={i} style={{...S.row,...(i===historial.length-1?{borderBottom:'none'}:{})}}>
                <div style={{flex:1}}>
                  <span style={{fontSize:'11px',color:'#f5a623',fontWeight:600}}>{h.usuario_nombre} </span>
                  <span style={{fontSize:'11px',color:'#7a7876'}}>{h.descripcion}</span>
                </div>
                <span style={{fontSize:'9px',color:'#3a3a38',fontFamily:'monospace',flexShrink:0,marginLeft:'8px'}}>{new Date(h.created_at).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
              </div>
            ))}
            {historial.length===0 && <p style={{fontSize:'12px',color:'#3a3a38',textAlign:'center',padding:'12px 0'}}>Sin historial</p>}
          </div>

          <div style={S.sec}>Mi cuenta</div>
          <div style={S.card}>
            <div style={S.row}><span style={{color:'#7a7876',fontSize:'12px'}}>Usuario</span><span style={{fontSize:'12px',fontFamily:'monospace',color:'#f5a623'}}>{usuario?.nombre}</span></div>
            <div style={{...S.row,borderBottom:'none'}}><span style={{color:'#7a7876',fontSize:'12px'}}>Rol</span><span style={{fontSize:'11px',fontFamily:'monospace',background:'rgba(91,159,255,0.15)',color:'#5b9fff',padding:'2px 8px',borderRadius:'4px'}}>{usuario?.rol}</span></div>
          </div>

          <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,80,80,0.3)',color:'#ff5050',marginTop:'8px'}} onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      )}

      {/* MODAL VENCIMIENTO */}
      {modal === 'venc' && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:300,display:'flex',alignItems:'flex-end'}}>
          <div style={{background:'#141416',borderRadius:'16px 16px 0 0',padding:'20px 16px 36px',width:'100%',borderTop:'1px solid rgba(255,255,255,0.13)'}}>
            <h3 style={{fontSize:'15px',fontWeight:700,marginBottom:'14px',color:'#eeecea'}}>Nuevo vencimiento</h3>
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
              <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:'#7a7876'}} onClick={()=>setModal('')}>Cancelar</button>
              <button style={S.btn} onClick={agregarVencimiento}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEUDA */}
      {modal === 'deuda' && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:300,display:'flex',alignItems:'flex-end'}}>
          <div style={{background:'#141416',borderRadius:'16px 16px 0 0',padding:'20px 16px 36px',width:'100%',borderTop:'1px solid rgba(255,255,255,0.13)'}}>
            <h3 style={{fontSize:'15px',fontWeight:700,marginBottom:'14px',color:'#eeecea'}}>Nueva deuda</h3>
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
              <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:'#7a7876'}} onClick={()=>setModal('')}>Cancelar</button>
              <button style={S.btn} onClick={agregarDeuda}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'#141416',borderTop:'1px solid rgba(255,255,255,0.13)',display:'flex',zIndex:200}}>
        {[
          {id:'hoy',icon:'◉',label:'HOY'},
          {id:'cargar',icon:'＋',label:'CARGAR'},
          {id:'pagos',icon:'⚡',label:'PAGOS'},
          {id:'pl',icon:'≋',label:'P&L'},
          {id:'mas',icon:'···',label:'MÁS'},
        ].map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)}
            style={{flex:1,padding:'11px 4px',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',cursor:'pointer',fontSize:'9px',fontWeight:700,letterSpacing:'.06em',color:tab===n.id?'#f5a623':'#3a3a38',textTransform:'uppercase',border:'none',background:'none',fontFamily:"'Syne',sans-serif"}}>
            <span style={{fontSize:'17px',lineHeight:1}}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
