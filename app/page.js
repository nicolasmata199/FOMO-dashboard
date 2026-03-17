'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, logHistorial } from '../lib/supabase'

const OBJ_DIA = 937500
const CMV_R = 0.612
const FIJOS = 9340241+6033219+2160000+1788634+139586+200000+306130+69449+500000

function fmt(n){const s='$'+Math.abs(Math.round(n)).toLocaleString('es-AR');return n<0?'−'+s:s}
function fms(n){const a=Math.abs(n);if(a>=1e6)return(n<0?'−':'')+'$'+(a/1e6).toFixed(1)+'M';if(a>=1000)return(n<0?'−':'')+'$'+(a/1000).toFixed(0)+'K';return fmt(n)}
function dh(s){const h=new Date();h.setHours(0,0,0,0);const d=new Date(s+'T12:00:00');return Math.round((d-h)/86400000)}
function hoyS(){return new Date().toISOString().split('T')[0]}
function tipoBadge(t){
  const m={cheque:'#f5a623',banco:'#5b9fff',impuesto:'#ff5050',sueldo:'#ff5050',servicio:'#7a7876',tarjeta:'#f5a623',proveedor:'#7a7876',personal:'#5b9fff',stock:'#3ddc84',alquiler:'#5b9fff',otro:'#7a7876'}
  const l={cheque:'CHQ',banco:'BCO',impuesto:'AFIP',sueldo:'SUE',servicio:'SVC',tarjeta:'TRJ',proveedor:'PRV',personal:'CRED',stock:'STK',alquiler:'ALQ',otro:'OTRO'}
  const col=m[t]||'#7a7876'
  return `<span style="display:inline-block;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:${col}22;color:${col};font-family:DM Mono,monospace">${l[t]||t.toUpperCase()}</span>`
}

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState('hoy')
  const [loading, setLoading] = useState(true)

  // Data
  const [datosDia, setDatosDia] = useState({efectivo:0,transferencias:0,tarjeta_pendiente:0,cheque_recibido:0,saldo_banco:0,ventas_acumuladas_mes:15000000,notas:''})
  const [vencimientos, setVencimientos] = useState([])
  const [deudas, setDeudas] = useState([])
  const [gastos, setGastos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [stock, setStock] = useState([])
  const [historial, setHistorial] = useState([])

  // Forms
  const [nuevoVenc, setNuevoVenc] = useState({fecha:'',descripcion:'',monto:'',tipo:'cheque'})
  const [nuevaDeuda, setNuevaDeuda] = useState({descripcion:'',monto:'',tipo:'tarjeta'})
  const [nuevoGasto, setNuevoGasto] = useState({descripcion:'',monto:'',categoria:'stock'})
  const [modal, setModal] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  // Ventas mes anterior (simulado por ahora)
  const ventasMesAnterior = 49426669

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setUser(session.user)
      cargarTodo(session.user)
    })
  }, [])

  async function cargarTodo(u) {
    setLoading(true)
    const [dd, venc, deu, gas, prov, st, hist] = await Promise.all([
      supabase.from('datos_diarios').select('*').eq('fecha', hoyS()).single(),
      supabase.from('vencimientos').select('*').eq('pagado', false).order('fecha'),
      supabase.from('deudas').select('*').eq('activa', true).order('created_at'),
      supabase.from('gastos').select('*').eq('fecha', hoyS()).order('created_at', {ascending:false}),
      supabase.from('proveedores').select('*').order('nombre'),
      supabase.from('stock').select('*').order('categoria'),
      supabase.from('historial').select('*').order('created_at', {ascending:false}).limit(30),
    ])
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    if (prof) setProfile(prof)
    if (dd.data) setDatosDia(dd.data)
    if (venc.data) setVencimientos(venc.data)
    if (deu.data) setDeudas(deu.data)
    if (gas.data) setGastos(gas.data)
    if (prov.data) setProveedores(prov.data)
    if (st.data) setStock(st.data)
    if (hist.data) setHistorial(hist.data)
    setLoading(false)
  }

  async function guardarDia() {
    setGuardando(true)
    const nombre = profile?.nombre || user?.email || 'Usuario'
    const existe = datosDia.id
    if (existe) {
      await supabase.from('datos_diarios').update({...datosDia, updated_at: new Date().toISOString(), usuario_nombre: nombre}).eq('id', datosDia.id)
      await logHistorial('datos_diarios', 'UPDATE', 'Actualizó datos del día', nombre)
    } else {
      await supabase.from('datos_diarios').insert({...datosDia, fecha: hoyS(), usuario_nombre: nombre})
      await logHistorial('datos_diarios', 'INSERT', 'Cargó datos del día', nombre)
    }
    setGuardando(false)
    showMsg('✓ Datos guardados')
  }

  async function agregarVenc() {
    if (!nuevoVenc.fecha || !nuevoVenc.descripcion || !nuevoVenc.monto) return
    const nombre = profile?.nombre || user?.email || 'Usuario'
    await supabase.from('vencimientos').insert({...nuevoVenc, monto: parseFloat(nuevoVenc.monto), usuario_nombre: nombre})
    await logHistorial('vencimientos', 'INSERT', `Agregó vencimiento: ${nuevoVenc.descripcion}`, nombre)
    setNuevoVenc({fecha:'',descripcion:'',monto:'',tipo:'cheque'})
    setModal(null)
    cargarTodo(user)
    showMsg('✓ Vencimiento agregado')
  }

  async function marcarPagado(id, desc) {
    const nombre = profile?.nombre || user?.email || 'Usuario'
    await supabase.from('vencimientos').update({pagado: true, fecha_pago: hoyS()}).eq('id', id)
    await logHistorial('vencimientos', 'UPDATE', `Marcó como pagado: ${desc}`, nombre)
    cargarTodo(user)
    showMsg('✓ Marcado como pagado')
  }

  async function agregarDeuda() {
    if (!nuevaDeuda.descripcion || !nuevaDeuda.monto) return
    const nombre = profile?.nombre || user?.email || 'Usuario'
    await supabase.from('deudas').insert({...nuevaDeuda, monto: parseFloat(nuevaDeuda.monto), usuario_nombre: nombre})
    await logHistorial('deudas', 'INSERT', `Agregó deuda: ${nuevaDeuda.descripcion}`, nombre)
    setNuevaDeuda({descripcion:'',monto:'',tipo:'tarjeta'})
    setModal(null)
    cargarTodo(user)
    showMsg('✓ Deuda agregada')
  }

  async function agregarGasto() {
    if (!nuevoGasto.descripcion || !nuevoGasto.monto) return
    const nombre = profile?.nombre || user?.email || 'Usuario'
    await supabase.from('gastos').insert({...nuevoGasto, monto: parseFloat(nuevoGasto.monto), fecha: hoyS(), usuario_nombre: nombre})
    await logHistorial('gastos', 'INSERT', `Registró gasto: ${nuevoGasto.descripcion} $${nuevoGasto.monto}`, nombre)
    setNuevoGasto({descripcion:'',monto:'',categoria:'stock'})
    setModal(null)
    cargarTodo(user)
    showMsg('✓ Gasto registrado')
  }

  async function guardarStock(item) {
    const nombre = profile?.nombre || user?.email || 'Usuario'
    await supabase.from('stock').update({...item, updated_at: new Date().toISOString(), usuario_nombre: nombre}).eq('id', item.id)
    await logHistorial('stock', 'UPDATE', `Actualizó stock: ${item.categoria}`, nombre)
    showMsg('✓ Stock actualizado')
  }

  async function guardarProveedor(item) {
    const nombre = profile?.nombre || user?.email || 'Usuario'
    await supabase.from('proveedores').update({...item, updated_at: new Date().toISOString(), usuario_nombre: nombre}).eq('id', item.id)
    await logHistorial('proveedores', 'UPDATE', `Actualizó proveedor: ${item.nombre}`, nombre)
    showMsg('✓ Proveedor actualizado')
  }

  function showMsg(m) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Calculos
  const cajaInmediata = (datosDia.efectivo||0) + (datosDia.transferencias||0) + (datosDia.saldo_banco||0)
  const cajaTotal = cajaInmediata + (datosDia.tarjeta_pendiente||0) + (datosDia.cheque_recibido||0)
  const ventasHoy = (datosDia.efectivo||0) + (datosDia.transferencias||0) + (datosDia.cheque_recibido||0)
  const pctObj = ventasHoy > 0 ? Math.min(100, Math.round(ventasHoy/OBJ_DIA*100)) : 0
  const colVentas = pctObj>=100?'#3ddc84':pctObj>=70?'#f5a623':'#ff5050'
  const v7 = vencimientos.filter(v => { const d=dh(v.fecha); return d>=0&&d<=7 })
  const tv7 = v7.reduce((s,v)=>s+v.monto,0)
  const v15 = vencimientos.filter(v => { const d=dh(v.fecha); return d>=0&&d<=15 })
  const tv15 = v15.reduce((s,v)=>s+v.monto,0)
  const posNeta = cajaTotal - tv15
  const vmes = datosDia.ventas_acumuladas_mes||0
  const cmv = vmes * CMV_R
  const mb = vmes - cmv
  const neto = mb - FIJOS
  const totalDeuda = deudas.reduce((s,d)=>s+d.monto,0)
  const totalStock = stock.reduce((s,st)=>s+(st.cantidad*st.costo_unitario),0)
  const mbCelulares = vmes * 0.56 * (1 - CMV_R * 0.56/0.56)
  const mbAccesorios = vmes * 0.38 * 0.78
  const variacionMes = vmes > 0 ? Math.round((vmes / ventasMesAnterior - 1) * 100) : 0

  const alertas = []
  const h0 = vencimientos.filter(v=>dh(v.fecha)===0)
  const h1 = vencimientos.filter(v=>dh(v.fecha)===1)
  if (h0.length) alertas.push({tipo:'red',txt:`HOY vencen: ${h0.map(v=>v.descripcion).join(', ')} — ${fmt(h0.reduce((s,v)=>s+v.monto,0))}`})
  if (h1.length) alertas.push({tipo:'red',txt:`Mañana vencen: ${h1.map(v=>v.descripcion).join(', ')} — ${fmt(h1.reduce((s,v)=>s+v.monto,0))}`})
  if (cajaTotal < 1000000 && ventasHoy > 0) alertas.push({tipo:'red',txt:`Caja baja: ${fmt(cajaTotal)} disponible`})
  if (!h0.length&&!h1.length&&v7.length) alertas.push({tipo:'amber',txt:`${v7.length} vencimientos esta semana — ${fms(tv7)} total`})

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0c0c0e',color:'#f5a623',fontFamily:'Syne,sans-serif',fontSize:'16px',fontWeight:700}}>Cargando FOMO...</div>

  return (
    <div style={S.wrap}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logo}>FO<span style={{color:'#f5a623'}}>MO</span></div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          <div style={S.userBadge}>{profile?.nombre || user?.email?.split('@')[0] || 'Usuario'}</div>
          <button onClick={cerrarSesion} style={S.logoutBtn}>Salir</button>
        </div>
      </div>

      {/* TOAST */}
      {msg && <div style={S.toast}>{msg}</div>}

      {/* MODAL */}
      {modal && (
        <div style={S.modalBg} onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}>
          <div style={S.modal}>
            {modal==='venc' && <>
              <div style={S.modalTitle}>Nuevo vencimiento</div>
              <label style={S.label}>Fecha</label>
              <input style={S.minput} type="date" value={nuevoVenc.fecha} onChange={e=>setNuevoVenc({...nuevoVenc,fecha:e.target.value})} />
              <label style={S.label}>Descripción</label>
              <input style={S.minput} type="text" value={nuevoVenc.descripcion} onChange={e=>setNuevoVenc({...nuevoVenc,descripcion:e.target.value})} placeholder="ej: Cheque proveedor" />
              <label style={S.label}>Monto ($)</label>
              <input style={S.minput} type="number" value={nuevoVenc.monto} onChange={e=>setNuevoVenc({...nuevoVenc,monto:e.target.value})} placeholder="0" inputMode="numeric" />
              <label style={S.label}>Tipo</label>
              <select style={S.minput} value={nuevoVenc.tipo} onChange={e=>setNuevoVenc({...nuevoVenc,tipo:e.target.value})}>
                <option value="cheque">Cheque</option><option value="banco">Banco/Préstamo</option>
                <option value="impuesto">Impuesto/AFIP</option><option value="sueldo">Sueldo</option>
                <option value="servicio">Servicio</option><option value="otro">Otro</option>
              </select>
              <div style={S.modalBtns}>
                <button style={S.btnCancel} onClick={()=>setModal(null)}>Cancelar</button>
                <button style={S.btnConfirm} onClick={agregarVenc}>Agregar</button>
              </div>
            </>}
            {modal==='deuda' && <>
              <div style={S.modalTitle}>Nueva deuda</div>
              <label style={S.label}>Descripción</label>
              <input style={S.minput} type="text" value={nuevaDeuda.descripcion} onChange={e=>setNuevaDeuda({...nuevaDeuda,descripcion:e.target.value})} placeholder="ej: Tarjeta VISA" />
              <label style={S.label}>Monto ($)</label>
              <input style={S.minput} type="number" value={nuevaDeuda.monto} onChange={e=>setNuevaDeuda({...nuevaDeuda,monto:e.target.value})} placeholder="0" inputMode="numeric" />
              <label style={S.label}>Tipo</label>
              <select style={S.minput} value={nuevaDeuda.tipo} onChange={e=>setNuevaDeuda({...nuevaDeuda,tipo:e.target.value})}>
                <option value="tarjeta">Tarjeta de crédito</option><option value="banco">Préstamo bancario</option>
                <option value="proveedor">Proveedor</option><option value="impuesto">Impuesto</option>
                <option value="personal">Crédito personal</option><option value="otro">Otro</option>
              </select>
              <div style={S.modalBtns}>
                <button style={S.btnCancel} onClick={()=>setModal(null)}>Cancelar</button>
                <button style={S.btnConfirm} onClick={agregarDeuda}>Agregar</button>
              </div>
            </>}
            {modal==='gasto' && <>
              <div style={S.modalTitle}>Registrar gasto</div>
              <label style={S.label}>Descripción</label>
              <input style={S.minput} type="text" value={nuevoGasto.descripcion} onChange={e=>setNuevoGasto({...nuevoGasto,descripcion:e.target.value})} placeholder="ej: Pago proveedor fundas" />
              <label style={S.label}>Monto ($)</label>
              <input style={S.minput} type="number" value={nuevoGasto.monto} onChange={e=>setNuevoGasto({...nuevoGasto,monto:e.target.value})} placeholder="0" inputMode="numeric" />
              <label style={S.label}>Categoría</label>
              <select style={S.minput} value={nuevoGasto.categoria} onChange={e=>setNuevoGasto({...nuevoGasto,categoria:e.target.value})}>
                <option value="stock">Stock/Mercadería</option><option value="sueldo">Sueldo</option>
                <option value="alquiler">Alquiler</option><option value="banco">Banco/Financiero</option>
                <option value="impuesto">Impuesto</option><option value="servicio">Servicio</option>
                <option value="otro">Otro</option>
              </select>
              <div style={S.modalBtns}>
                <button style={S.btnCancel} onClick={()=>setModal(null)}>Cancelar</button>
                <button style={S.btnConfirm} onClick={agregarGasto}>Registrar</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* PAGES */}
      <div style={{display:page==='hoy'?'block':'none',padding:'14px'}}>
        {alertas.map((a,i)=>(
          <div key={i} style={{...S.alert, background:a.tipo==='red'?'rgba(255,80,80,0.12)':'rgba(245,166,35,0.12)', borderColor:a.tipo==='red'?'rgba(255,80,80,0.25)':'rgba(245,166,35,0.25)', color:a.tipo==='red'?'#ff8080':'#f5c06a'}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:a.tipo==='red'?'#ff5050':'#f5a623',flexShrink:0,marginTop:3}}></div>
            <div dangerouslySetInnerHTML={{__html:a.txt}} />
          </div>
        ))}

        <div style={S.grid2}>
          <div style={{...S.mcard,'--top':'#3ddc84'}}>
            <div style={S.mlabel}>VENTAS HOY</div>
            <div style={{...S.mvalue,color:colVentas}}>{ventasHoy>0?fms(ventasHoy):'—'}</div>
            <div style={S.msub}>{ventasHoy>0?`${pctObj}% del objetivo`:'cargar datos'}</div>
            <div style={S.progBg}><div style={{...S.progFill,width:pctObj+'%',background:colVentas}}></div></div>
          </div>
          <div style={{...S.mcard,'--top':'#f5a623'}}>
            <div style={S.mlabel}>CAJA TOTAL</div>
            <div style={{...S.mvalue,color:cajaTotal>3e6?'#3ddc84':cajaTotal>1e6?'#f5a623':'#ff5050'}}>{fms(cajaTotal)}</div>
            <div style={S.msub}>efec+transf+banco</div>
          </div>
          <div style={{...S.mcard,'--top':'#ff5050'}}>
            <div style={S.mlabel}>VENCE 7 DÍAS</div>
            <div style={{...S.mvalue,color:'#ff5050'}}>{fms(tv7)}</div>
            <div style={S.msub}>{v7.length} obligacion(es)</div>
          </div>
          <div style={{...S.mcard,'--top':'#5b9fff'}}>
            <div style={S.mlabel}>MES ACTUAL</div>
            <div style={{...S.mvalue,color:'#5b9fff'}}>{fms(vmes)}</div>
            <div style={S.msub}><span style={{color:variacionMes>=0?'#3ddc84':'#ff5050'}}>{variacionMes>=0?'+':''}{variacionMes}%</span> vs mes ant.</div>
          </div>
        </div>

        <div style={S.sec}>Posición de caja</div>
        <div style={S.plCard}>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Efectivo en caja</span><span style={{...S.monoSm,color:'#3ddc84'}}>{fmt(datosDia.efectivo||0)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Transferencias recibidas</span><span style={{...S.monoSm,color:'#3ddc84'}}>{fmt(datosDia.transferencias||0)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Saldo banco</span><span style={{...S.monoSm,color:'#3ddc84'}}>{fmt(datosDia.saldo_banco||0)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Tarjeta pendiente acreditación</span><span style={{...S.monoSm,color:'#f5a623'}}>{fmt(datosDia.tarjeta_pendiente||0)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Cheque recibido</span><span style={{...S.monoSm,color:'#f5a623'}}>{fmt(datosDia.cheque_recibido||0)}</span></div>
          <div style={{...S.plRow,...S.plSub}}><span>Total disponible</span><span style={{...S.monoSm,color:cajaTotal>2e6?'#3ddc84':'#f5a623'}}>{fmt(cajaTotal)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Vence próx. 15 días</span><span style={{...S.monoSm,color:'#ff5050'}}>−{fmt(tv15)}</span></div>
          <div style={{...S.plRow,...S.plTot}}><span>Posición neta 15d</span><span style={{...S.monoSm,color:posNeta>0?'#3ddc84':'#ff5050'}}>{fmt(posNeta)}</span></div>
        </div>

        <div style={S.sec}>Margen por categoría (mes)</div>
        <div style={S.plCard}>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Celulares (~56% ventas × 38% margen)</span><span style={{...S.monoSm,color:'#5b9fff'}}>{fms(vmes*0.56*0.388)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Accesorios (~38% ventas × 78% margen)</span><span style={{...S.monoSm,color:'#3ddc84'}}>{fms(vmes*0.38*0.78)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Electrónica + otros</span><span style={{...S.monoSm,color:'#f5a623'}}>{fms(vmes*0.06*0.55)}</span></div>
          <div style={{...S.plRow,...S.plSub}}><span>Margen bruto total est.</span><span style={{...S.monoSm,color:mb>0?'#3ddc84':'#ff5050'}}>{fmt(mb)}</span></div>
        </div>
      </div>

      {/* PAGE CARGAR */}
      <div style={{display:page==='cargar'?'block':'none',padding:'14px'}}>
        <div style={S.sec}>Datos del día — {new Date().toLocaleDateString('es-AR')}</div>
        {[
          {key:'efectivo',label:'Efectivo en caja ($)',hint:'Billetes en la caja física'},
          {key:'transferencias',label:'Transferencias recibidas ($)',hint:'Total cobrado por transferencia bancaria'},
          {key:'cheque_recibido',label:'Cheques recibidos ($)',hint:'Cheques de clientes recibidos hoy'},
          {key:'tarjeta_pendiente',label:'Tarjeta pendiente de acreditación ($)',hint:'Lo que el banco todavía no acreditó — lo cargás vos'},
          {key:'saldo_banco',label:'Saldo en banco ($)',hint:'Saldo real en cuenta bancaria ahora'},
          {key:'ventas_acumuladas_mes',label:'Ventas acumuladas del mes ($)',hint:'Total vendido desde el 1 del mes hasta hoy'},
        ].map(f=>(
          <div key={f.key} style={S.icard}>
            <label style={S.label}>{f.label}</label>
            <input style={S.input} type="number" value={datosDia[f.key]||''} onChange={e=>setDatosDia({...datosDia,[f.key]:parseFloat(e.target.value)||0})} placeholder="0" inputMode="numeric" />
            <div style={S.hint}>{f.hint}</div>
          </div>
        ))}
        <div style={S.icard}>
          <label style={S.label}>Notas del día (opcional)</label>
          <input style={S.input} type="text" value={datosDia.notas||''} onChange={e=>setDatosDia({...datosDia,notas:e.target.value})} placeholder="ej: Vendimos mucho iPhone hoy" />
        </div>
        <button style={S.saveFab} onClick={guardarDia} disabled={guardando}>{guardando?'Guardando...':'Guardar datos del día'}</button>
        <div style={{height:8}}/>
        <button style={{...S.saveFab,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:'#7a7876'}} onClick={()=>setModal('gasto')}>+ Registrar gasto del día</button>
      </div>

      {/* PAGE PAGOS */}
      <div style={{display:page==='venc'?'block':'none',padding:'14px'}}>
        <div style={S.sec}>Vencimientos a pagar</div>
        <div style={S.tcard}>
          <div style={S.tcHead}>
            <div style={S.tcTitle}>Obligaciones</div>
            <button style={S.tcAdd} onClick={()=>setModal('venc')}>+ Nuevo</button>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Fecha','Descripción','Monto',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {[...vencimientos].sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(v=>{
                  const d=dh(v.fecha)
                  const bColor=d<=0?'#ff5050':d<=1?'#ff5050':d<=7?'#f5a623':'#5b9fff'
                  const bTxt=d<0?'PASADO':d===0?'HOY':d===1?'MAÑ':d+'d'
                  return <tr key={v.id}>
                    <td style={S.td}><span style={{fontFamily:'DM Mono,monospace',fontSize:'11px'}}>{v.fecha.split('-').reverse().join('/')}</span> <span style={{...S.bdg,background:bColor+'22',color:bColor}}>{bTxt}</span></td>
                    <td style={S.td}><span dangerouslySetInnerHTML={{__html:v.descripcion+' '+tipoBadge(v.tipo)}}/></td>
                    <td style={{...S.td,color:'#ff5050',fontFamily:'DM Mono,monospace',fontSize:'11px',textAlign:'right'}}>{fms(v.monto)}</td>
                    <td style={S.td}><button onClick={()=>marcarPagado(v.id,v.descripcion)} style={{background:'#3ddc8422',color:'#3ddc84',border:'none',borderRadius:'5px',padding:'3px 7px',fontSize:'10px',fontWeight:700,cursor:'pointer',fontFamily:'Syne,sans-serif'}}>✓</button></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={S.sec}>Deudas registradas</div>
        <div style={S.tcard}>
          <div style={S.tcHead}>
            <div style={S.tcTitle}>Pasivos — {fms(totalDeuda)}</div>
            <button style={S.tcAdd} onClick={()=>setModal('deuda')}>+ Nueva</button>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Descripción','Tipo','Monto'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {deudas.map(d=>(
                <tr key={d.id}>
                  <td style={S.td}>{d.descripcion}</td>
                  <td style={S.td} dangerouslySetInnerHTML={{__html:tipoBadge(d.tipo)}}/>
                  <td style={{...S.td,color:'#ff5050',fontFamily:'DM Mono,monospace',fontSize:'11px',textAlign:'right'}}>{fms(d.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.sec}>Gastos de hoy</div>
        <div style={S.tcard}>
          <div style={S.tcHead}>
            <div style={S.tcTitle}>Registrados hoy</div>
            <button style={S.tcAdd} onClick={()=>setModal('gasto')}>+ Agregar</button>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Descripción','Cat.','Monto'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {gastos.length===0?<tr><td colSpan={3} style={{...S.td,color:'#3a3a38',textAlign:'center',padding:'16px'}}>Sin gastos hoy</td></tr>:
              gastos.map(g=>(
                <tr key={g.id}>
                  <td style={S.td}>{g.descripcion}</td>
                  <td style={S.td} dangerouslySetInnerHTML={{__html:tipoBadge(g.categoria)}}/>
                  <td style={{...S.td,color:'#ff5050',fontFamily:'DM Mono,monospace',fontSize:'11px',textAlign:'right'}}>{fms(g.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGE P&L */}
      <div style={{display:page==='flujo'?'block':'none',padding:'14px'}}>
        <div style={S.sec}>P&L del mes</div>
        <div style={S.plCard}>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Ventas acumuladas</span><span style={{...S.monoSm,color:'#3ddc84'}}>{fmt(vmes)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>CMV estimado (61.2%)</span><span style={{...S.monoSm,color:'#ff5050'}}>−{fmt(cmv)}</span></div>
          <div style={{...S.plRow,...S.plSub}}><span>Margen bruto</span><span style={{...S.monoSm,color:mb>0?'#3ddc84':'#ff5050'}}>{fmt(mb)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Sueldos equipo</span><span style={{...S.monoSm,color:'#ff5050'}}>−{fmt(9340241)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Alquileres (3 suc.)</span><span style={{...S.monoSm,color:'#ff5050'}}>−{fmt(6033219)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Inversor (1.500 USD)</span><span style={{...S.monoSm,color:'#ff5050'}}>−{fmt(2160000)}</span></div>
          <div style={S.plRow}><span style={{color:'#7a7876'}}>Santander + ARCA + otros</span><span style={{...S.monoSm,color:'#ff5050'}}>−{fmt(2628220)}</span></div>
          <div style={{...S.plRow,...S.plTot}}><span>Resultado neto est.</span><span style={{...S.monoSm,color:neto>0?'#3ddc84':'#ff5050'}}>{fmt(neto)}</span></div>
        </div>

        <div style={S.sec}>Stock valorizado</div>
        <div style={S.tcard}>
          <div style={S.tcHead}>
            <div style={S.tcTitle}>Inventario — {fms(totalStock)}</div>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Categoría','Cant.','Costo unit.','Total'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {stock.map(st=>(
                <tr key={st.id}>
                  <td style={S.td}>{st.categoria.replace('_',' ')}</td>
                  <td style={{...S.td,textAlign:'center'}}>
                    <input type="number" value={st.cantidad} onChange={e=>setStock(stock.map(s=>s.id===st.id?{...s,cantidad:parseInt(e.target.value)||0}:s))} onBlur={()=>guardarStock(stock.find(s=>s.id===st.id))} style={{width:'50px',background:'#1c1c20',border:'1px solid rgba(255,255,255,0.13)',borderRadius:'5px',color:'#eeecea',fontFamily:'DM Mono,monospace',fontSize:'12px',padding:'4px 6px',textAlign:'center'}} inputMode="numeric" />
                  </td>
                  <td style={{...S.td,fontFamily:'DM Mono,monospace',fontSize:'11px',textAlign:'right'}}>{fms(st.costo_unitario)}</td>
                  <td style={{...S.td,color:'#5b9fff',fontFamily:'DM Mono,monospace',fontSize:'11px',textAlign:'right'}}>{fms(st.cantidad*st.costo_unitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.sec}>Proveedores</div>
        <div style={S.tcard}>
          <div style={S.tcHead}><div style={S.tcTitle}>Deuda por proveedor</div></div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Proveedor','Deuda actual'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {proveedores.map(p=>(
                <tr key={p.id}>
                  <td style={S.td}>{p.nombre}</td>
                  <td style={{...S.td,textAlign:'right'}}>
                    <input type="number" value={p.deuda_actual} onChange={e=>setProveedores(proveedores.map(pr=>pr.id===p.id?{...pr,deuda_actual:parseFloat(e.target.value)||0}:pr))} onBlur={()=>guardarProveedor(proveedores.find(pr=>pr.id===p.id))} style={{width:'110px',background:'#1c1c20',border:'1px solid rgba(255,255,255,0.13)',borderRadius:'5px',color:'#ff5050',fontFamily:'DM Mono,monospace',fontSize:'12px',padding:'4px 8px',textAlign:'right'}} inputMode="numeric" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGE HISTORIAL */}
      <div style={{display:page==='hist'?'block':'none',padding:'14px'}}>
        <div style={S.sec}>Historial de cambios</div>
        <div style={S.tcard}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Fecha/Hora','Usuario','Acción'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {historial.length===0?<tr><td colSpan={3} style={{...S.td,color:'#3a3a38',textAlign:'center',padding:'16px'}}>Sin registros</td></tr>:
              historial.map(h=>(
                <tr key={h.id}>
                  <td style={{...S.td,fontFamily:'DM Mono,monospace',fontSize:'10px',color:'#7a7876',whiteSpace:'nowrap'}}>{new Date(h.created_at).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{...S.td,color:'#f5a623',fontSize:'11px',fontWeight:700}}>{h.usuario_nombre||'—'}</td>
                  <td style={{...S.td,fontSize:'11px'}}>{h.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <nav style={S.nav}>
        {[
          {id:'hoy',icon:'◉',label:'HOY'},
          {id:'cargar',icon:'＋',label:'CARGAR'},
          {id:'venc',icon:'⚡',label:'PAGOS'},
          {id:'flujo',icon:'≋',label:'P&L'},
          {id:'hist',icon:'☰',label:'LOG'},
        ].map(n=>(
          <button key={n.id} style={{...S.navBtn,color:page===n.id?'#f5a623':'#7a7876'}} onClick={()=>setPage(n.id)}>
            <span style={{fontSize:'17px',lineHeight:1}}>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

const S = {
  wrap:{minHeight:'100vh',background:'#0c0c0e',color:'#eeecea',fontFamily:'Syne,sans-serif',paddingBottom:'76px'},
  header:{padding:'13px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'#0c0c0e',position:'sticky',top:0,zIndex:100},
  logo:{fontSize:'18px',fontWeight:800,letterSpacing:'-.5px'},
  userBadge:{fontFamily:'DM Mono,monospace',fontSize:'10px',color:'#7a7876',background:'#1c1c20',padding:'5px 10px',borderRadius:'6px',border:'1px solid rgba(255,255,255,0.07)'},
  logoutBtn:{background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',color:'#7a7876',fontSize:'10px',padding:'5px 9px',cursor:'pointer',fontFamily:'Syne,sans-serif',fontWeight:600},
  toast:{position:'fixed',top:'70px',left:'50%',transform:'translateX(-50%)',background:'#3ddc84',color:'#000',padding:'10px 20px',borderRadius:'8px',fontSize:'13px',fontWeight:700,fontFamily:'Syne,sans-serif',zIndex:500,whiteSpace:'nowrap'},
  alert:{borderRadius:'10px',padding:'11px 13px',fontSize:'12px',display:'flex',gap:'9px',alignItems:'flex-start',marginBottom:'8px',lineHeight:1.5,border:'1px solid'},
  grid2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'9px',marginBottom:'14px'},
  mcard:{background:'#141416',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'13px',position:'relative',overflow:'hidden',borderTop:'2px solid var(--top)'},
  mlabel:{fontSize:'10px',color:'#7a7876',marginBottom:'6px',fontWeight:600,letterSpacing:'.04em'},
  mvalue:{fontSize:'20px',fontWeight:700,fontFamily:'DM Mono,monospace',letterSpacing:'-1px',lineHeight:1},
  msub:{fontSize:'10px',color:'#7a7876',marginTop:'5px',fontFamily:'DM Mono,monospace'},
  progBg:{background:'#1c1c20',borderRadius:'3px',height:'3px',marginTop:'8px',overflow:'hidden'},
  progFill:{height:'100%',borderRadius:'3px',transition:'width .4s'},
  sec:{fontSize:'10px',fontWeight:700,letterSpacing:'.14em',color:'#3a3a38',textTransform:'uppercase',margin:'18px 0 10px'},
  plCard:{background:'#141416',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',overflow:'hidden',marginBottom:'10px'},
  plRow:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 13px',borderBottom:'1px solid rgba(255,255,255,0.07)',fontSize:'12px'},
  plSub:{fontWeight:700,fontSize:'13px',borderTop:'1px solid rgba(255,255,255,0.13)',background:'rgba(255,255,255,0.02)'},
  plTot:{background:'rgba(245,166,35,0.06)',fontWeight:700,fontSize:'13px'},
  monoSm:{fontFamily:'DM Mono,monospace',fontSize:'11px'},
  icard:{background:'#141416',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'13px',marginBottom:'9px'},
  label:{fontSize:'11px',color:'#7a7876',display:'block',marginBottom:'7px',fontWeight:600},
  input:{width:'100%',background:'#1c1c20',border:'1px solid rgba(255,255,255,0.13)',borderRadius:'8px',color:'#eeecea',fontFamily:'DM Mono,monospace',fontSize:'16px',padding:'11px 12px',outline:'none',boxSizing:'border-box'},
  hint:{fontSize:'10px',color:'#3a3a38',marginTop:'5px',fontFamily:'DM Mono,monospace'},
  saveFab:{width:'100%',background:'#f5a623',color:'#000',border:'none',padding:'14px',borderRadius:'12px',fontSize:'14px',fontWeight:700,fontFamily:'Syne,sans-serif',cursor:'pointer',marginTop:'14px',letterSpacing:'.02em',boxSizing:'border-box'},
  tcard:{background:'#141416',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',overflow:'hidden',marginBottom:'10px'},
  tcHead:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 13px',borderBottom:'1px solid rgba(255,255,255,0.07)'},
  tcTitle:{fontSize:'12px',fontWeight:700},
  tcAdd:{fontSize:'11px',color:'#f5a623',background:'none',border:'none',cursor:'pointer',fontFamily:'Syne,sans-serif',fontWeight:700,padding:'4px 8px'},
  th:{fontSize:'9px',fontWeight:700,letterSpacing:'.08em',color:'#3a3a38',textTransform:'uppercase',padding:'8px 13px',borderBottom:'1px solid rgba(255,255,255,0.07)',textAlign:'left'},
  td:{padding:'10px 13px',fontSize:'11px',borderBottom:'1px solid rgba(255,255,255,0.07)',verticalAlign:'middle'},
  bdg:{display:'inline-block',fontSize:'9px',fontWeight:700,padding:'2px 6px',borderRadius:'4px',fontFamily:'DM Mono,monospace'},
  nav:{position:'fixed',bottom:0,left:0,right:0,background:'#141416',borderTop:'1px solid rgba(255,255,255,0.13)',display:'flex',zIndex:200,paddingBottom:'env(safe-area-inset-bottom)'},
  navBtn:{flex:1,padding:'11px 4px',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',cursor:'pointer',fontSize:'9px',fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',border:'none',background:'none',fontFamily:'Syne,sans-serif',transition:'color .15s'},
  modalBg:{display:'flex',position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:300,alignItems:'flex-end'},
  modal:{background:'#141416',borderRadius:'16px 16px 0 0',padding:'20px 16px 40px',width:'100%',borderTop:'1px solid rgba(255,255,255,0.13)',maxHeight:'90vh',overflowY:'auto'},
  modalTitle:{fontSize:'15px',fontWeight:700,marginBottom:'14px'},
  minput:{width:'100%',background:'#1c1c20',border:'1px solid rgba(255,255,255,0.13)',borderRadius:'8px',color:'#eeecea',fontFamily:'DM Mono,monospace',fontSize:'16px',padding:'12px',outline:'none',marginBottom:'9px',boxSizing:'border-box'},
  modalBtns:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'6px'},
  btnCancel:{padding:'13px',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.13)',background:'none',color:'#7a7876',fontFamily:'Syne,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'},
  btnConfirm:{padding:'13px',borderRadius:'10px',border:'none',background:'#f5a623',color:'#000',fontFamily:'Syne,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'},
}
