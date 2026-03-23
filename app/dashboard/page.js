'use client'
import { useEffect, useState, useRef } from 'react'
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
  const [y,m,d] = f.split('-').map(Number)
  const fd = new Date(y, m-1, d)
  return Math.round((fd.getTime() - h.getTime()) / 86400000)
}
function fmtInput(n) {
  if (!n) return ''
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function hoyStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function fechaLabel() {
  const d = new Date()
  const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const mes = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${dias[d.getDay()]} ${d.getDate()} ${mes[d.getMonth()]}`
}

function generateGastosFijosRecurrentes(fechaInicioStr, fechaFinStr, vencimientosExistentes) {
  const fijos = [
    {
      dia: 5, descripcion: 'Sueldos', monto: 9340241,
      yaExisteFn: (v, ms) => v.descripcion?.toLowerCase().includes('sueldo') && v.fecha.slice(0,7) === ms,
    },
    {
      dia: 10, descripcion: 'Alquiler Córdoba 695', monto: 4090600,
      yaExisteFn: (v, ms) => v.descripcion?.toLowerCase().includes('alquiler') && v.descripcion?.toLowerCase().includes('695') && v.fecha.slice(0,7) === ms,
    },
    {
      dia: 10, descripcion: 'Alquiler Córdoba 642', monto: 720000,
      yaExisteFn: (v, ms) => v.descripcion?.toLowerCase().includes('alquiler') && v.descripcion?.toLowerCase().includes('642') && v.fecha.slice(0,7) === ms,
    },
    {
      dia: 10, descripcion: 'Alquiler San Juan 655', monto: 1222619,
      yaExisteFn: (v, ms) => v.descripcion?.toLowerCase().includes('alquiler') && v.descripcion?.toLowerCase().includes('san juan') && v.fecha.slice(0,7) === ms,
    },
    {
      dia: 15, descripcion: 'Inversor', monto: 2160000,
      yaExisteFn: (v, ms) => v.descripcion?.toLowerCase().includes('inversor') && v.fecha.slice(0,7) === ms,
    },
  ]
  const [iy,im,id] = fechaInicioStr.split('-').map(Number)
  const [fy,fm,fd] = fechaFinStr.split('-').map(Number)
  const inicio = new Date(iy, im-1, id)
  const fin    = new Date(fy, fm-1, fd)
  const result = []
  let cur = new Date(inicio.getFullYear(), inicio.getMonth(), 1)
  while (cur <= fin) {
    for (const f of fijos) {
      const fecha = new Date(cur.getFullYear(), cur.getMonth(), f.dia)
      if (fecha >= inicio && fecha <= fin) {
        const mesStr = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}`
        const yaExiste = (vencimientosExistentes||[]).some(v => f.yaExisteFn(v, mesStr))
        if (yaExiste) continue
        const y = fecha.getFullYear()
        const m = String(fecha.getMonth()+1).padStart(2,'0')
        const d = String(fecha.getDate()).padStart(2,'0')
        result.push({fecha:`${y}-${m}-${d}`, descripcion:f.descripcion, monto:f.monto, esFijo:true})
      }
    }
    cur.setMonth(cur.getMonth()+1)
  }
  return result
}
const FLUJO_DEFAULT = 500000

export default function Dashboard() {
  const [usuario, setUsuario] = useState(null)
  const [tab, setTab] = useState('hoy')
  const [loading, setLoading] = useState(true)

  const [datosHoy, setDatosHoy] = useState({efectivo:0,transferencias:0,tarjeta_pendiente:0,cheque_recibido:0,saldo_banco:0,ventas_acumuladas_mes:0,ventas_695:0,ventas_642:0,ventas_sanjuan:0,notas:'',tarjeta_acreditada:false,tarjeta_monto_real:0})
  const [fechaDatosHoy, setFechaDatosHoy] = useState(null)
  const [datosDia, setDatosDia] = useState({efectivo:0,transferencias:0,tarjeta_pendiente:0,cheque_recibido:0,saldo_banco:0,ventas_695:0,ventas_642:0,ventas_sanjuan:0,notas:''})
  const [vencimientos, setVencimientos] = useState([])
  const [vencPagados, setVencPagados] = useState([])
  const [deudas, setDeudas] = useState([])
  const [gastos, setGastos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [stock, setStock] = useState([])
  const [historial, setHistorial] = useState([])
  const [historialDias, setHistorialDias] = useState([])
  const [userId, setUserId] = useState(null)
  const [ventasMes, setVentasMes] = useState(0)
  const [diasConDatos, setDiasConDatos] = useState(0)
  const [acumData, setAcumData] = useState({efectivo:0,transferencias:0,saldoBanco:0,gastos:0})
  const [liquidoTotal, setLiquidoTotal] = useState(0)
  const [gastosFlujoData, setGastosFlujoData] = useState([])
  const [tarjetaAcumulada, setTarjetaAcumulada] = useState(0)

  const [fVenc, setFVenc] = useState({fecha:'',descripcion:'',monto:'',tipo:'cheque'})
  const [fDeuda, setFDeuda] = useState({descripcion:'',monto:'',tipo:'tarjeta'})
  const [fechaCarga, setFechaCarga] = useState(hoyStr())
  const [fGasto, setFGasto] = useState({descripcion:'',monto:'',categoria:'stock'})
  const [fCambio, setFCambio] = useState({tipo:'cheque_efectivo',monto_original:'',monto_recibido:'',descripcion:''})
  const [fPagoSucursal, setFPagoSucursal] = useState({sucursal:'695',descripcion:'',monto:'',categoria:'stock'})
  const [fAjuste, setFAjuste] = useState({campo:'efectivo', monto:'', motivo:''})
  const [modal, setModal] = useState('')
  const MP0 = {venc:null,paso:1,opcion:null,montoInput:'',nuevoMonto:'',nuevaFecha:'',medio:null,cuotas:1,cheques:[{monto:'',fecha:''}],interesInput:'0',notaInput:'',subopcionD:null}
  const [modalPago, setModalPago] = useState(MP0)
  const [tarjetaInputShow, setTarjetaInputShow] = useState(false)
  const [tarjetaMontoInput, setTarjetaMontoInput] = useState('')
  const [modalDetalle, setModalDetalle] = useState({tipo:'',open:false})
  const [mostrarPagados, setMostrarPagados] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const lastSaveRef = useRef(0)

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      let { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!profile) {
        const nombre = session.user.email.split('@')[0]
        await supabase.from('profiles').upsert({ id: session.user.id, nombre, rol: 'admin' })
        profile = { id: session.user.id, nombre, rol: 'admin' }
      }
      setUsuario(profile)
      setUserId(session.user.id)
      // Verificar Santander (una sola vez al cargar)
      // Eliminar la cuota incorrecta "7/12 (última)" con fecha 2026-04-01 si existe
      await supabase.from('vencimientos').delete().eq('descripcion','Cuota Santander 7/12 (última)').eq('fecha','2026-04-01')
      const santItems = [
        {descripcion:'Cuota Santander 6/12',fecha:'2026-03-22',monto:1788634,tipo:'banco'},
        {descripcion:'Cuota Santander 7/12',fecha:'2026-04-22',monto:1788634,tipo:'banco'},
        {descripcion:'Cuota Santander 8/12',fecha:'2026-05-22',monto:1788634,tipo:'banco'},
        {descripcion:'Cuota Santander 9/12',fecha:'2026-06-22',monto:1788634,tipo:'banco'},
        {descripcion:'Cuota Santander 10/12',fecha:'2026-07-22',monto:1788634,tipo:'banco'},
        {descripcion:'Cuota Santander 11/12',fecha:'2026-08-22',monto:1788634,tipo:'banco'},
        {descripcion:'Cuota Santander 12/12',fecha:'2026-09-22',monto:1788634,tipo:'banco'},
      ]
      const {data: santExist} = await supabase.from('vencimientos').select('descripcion,fecha').in('descripcion', santItems.map(s=>s.descripcion))
      for (const s of santItems) {
        const existe = santExist?.some(e => e.descripcion === s.descripcion && e.fecha === s.fecha)
        if (!existe) await supabase.from('vencimientos').insert({...s, pagado:false, usuario_nombre:'sistema'})
      }
      await loadAll(session.user.id)
      setLoading(false)
    })
  }, [])

  async function loadAll(uid) {
    const supabase = getSupabase()
    const currentUid = uid || userId
    const inicioMes = new Date(); inicioMes.setDate(1)
    const inicioMesStr = inicioMes.toISOString().split('T')[0]
    const hoyD = new Date(); const hY0=hoyD.getFullYear(),hM0=hoyD.getMonth(),hD0=hoyD.getDate()
    const flIni = new Date(hY0,hM0,hD0-3), flFin = new Date(hY0,hM0,hD0+29)
    const flIniStr = `${flIni.getFullYear()}-${String(flIni.getMonth()+1).padStart(2,'0')}-${String(flIni.getDate()).padStart(2,'0')}`
    const flFinStr = `${flFin.getFullYear()}-${String(flFin.getMonth()+1).padStart(2,'0')}-${String(flFin.getDate()).padStart(2,'0')}`
    const [v, d, g, p, s, h, ddHoy, ddReciente, ddMes, vPagados, ddAcum, gAcum, gFlujo, tPend] = await Promise.all([
      supabase.from('vencimientos').select('*').eq('pagado',false).order('fecha'),
      supabase.from('deudas').select('*').eq('activa',true).order('monto',{ascending:false}),
      supabase.from('gastos').select('*').eq('fecha',hoyStr()).order('created_at',{ascending:false}),
      supabase.from('proveedores').select('*').order('deuda_actual',{ascending:false}),
      supabase.from('stock').select('*').order('categoria'),
      supabase.from('historial').select('*').order('created_at',{ascending:false}).limit(20),
      supabase.from('datos_diarios').select('*').eq('fecha',hoyStr()),
      supabase.from('datos_diarios').select('*').order('fecha',{ascending:false}).limit(30),
      supabase.from('datos_diarios').select('*').gte('fecha',inicioMesStr).order('fecha'),
      supabase.from('vencimientos').select('*').eq('pagado',true).order('fecha_pago',{ascending:false}).limit(30),
      supabase.from('datos_diarios').select('*').lte('fecha',hoyStr()).order('fecha',{ascending:false}),
      supabase.from('gastos').select('monto').lte('fecha',hoyStr()),
      supabase.from('gastos').select('fecha,monto,descripcion,categoria').gte('fecha',flIniStr).lte('fecha',flFinStr),
      supabase.from('datos_diarios').select('tarjeta_pendiente,tarjeta_acreditada').eq('tarjeta_acreditada',false).gt('tarjeta_pendiente',0),
    ])
    if (v.data) setVencimientos(v.data)
    if (d.data) setDeudas(d.data)
    if (g.data) setGastos(g.data)
    if (p.data) setProveedores(p.data)
    if (s.data) setStock(s.data)
    if (h.data) setHistorial(h.data)
    if (ddReciente.data) setHistorialDias(ddReciente.data)
    const rowsRecientes0 = ddReciente.data || []
    if (rowsRecientes0.length > 0) {
      setFechaDatosHoy(rowsRecientes0[0].fecha)
    }
    if (vPagados.data) setVencPagados(vPagados.data)
    if (gFlujo.data) setGastosFlujoData(gFlujo.data)
    const totalTarjetaPendiente = (tPend.data||[]).reduce((s,r) => s+(r.tarjeta_pendiente||0), 0)
    setTarjetaAcumulada(totalTarjetaPendiente)

    // Cálculo de líquido acumulado
    const rowsAcum = ddAcum.data || []
    console.log('[FOMO] ddAcum rows:', rowsAcum.length, ddAcum.error?.message)
    console.log('[FOMO] ddAcum data:', JSON.stringify(rowsAcum))
    const efectivoAcum = rowsAcum.reduce((s,r) => s+(r.efectivo>0?r.efectivo:0), 0)
    const transferAcum = rowsAcum.reduce((s,r) => s+(r.transferencias>0?r.transferencias:0), 0)
    const chequeAcum = rowsAcum.reduce((s,r) => s+(r.cheque_recibido>0?r.cheque_recibido:0), 0)
    const saldoBancoUlt = rowsAcum.reduce((s,r) => s+(r.saldo_banco>0?r.saldo_banco:0), 0)
    const totalGastosAcum = (gAcum.data||[]).reduce((s,r) => s+(r.monto||0), 0)
    const totalLiquido = efectivoAcum + transferAcum + chequeAcum + saldoBancoUlt - totalGastosAcum
    console.log('[FOMO] efectivo_acum:', efectivoAcum)
    console.log('[FOMO] transf_acum:', transferAcum)
    console.log('[FOMO] cheque_acum:', chequeAcum)
    console.log('[FOMO] banco:', saldoBancoUlt)
    console.log('[FOMO] gastos:', totalGastosAcum)
    console.log('[FOMO] totalLiquido:', totalLiquido)
    setAcumData({efectivo:efectivoAcum, transferencias:transferAcum, cheque:chequeAcum, saldoBanco:saldoBancoUlt, gastos:totalGastosAcum})
    setLiquidoTotal(totalLiquido)

    const rowsMes = ddMes.data || []
    const totalVentasMes = rowsMes.reduce((sum,r) => sum+(r.ventas_695||0)+(r.ventas_642||0)+(r.ventas_sanjuan||0), 0)
    setVentasMes(totalVentasMes)
    const diasCon = rowsMes.filter(r => ((r.ventas_695||0)+(r.ventas_642||0)+(r.ventas_sanjuan||0)) > 0).length
    setDiasConDatos(diasCon)

    const rowsHoy = ddHoy.data || []
    const rowsRecientes = ddReciente.data || []
    const mejorVentas = rowsRecientes.find(x => (x.ventas_acumuladas_mes||0) > 0)?.ventas_acumuladas_mes || 0
    if (rowsHoy.length > 0) {
      const r = rowsHoy[0]
      const ventas = (r.ventas_acumuladas_mes||0) > 0 ? r.ventas_acumuladas_mes : mejorVentas
      setDatosHoy({...r, ventas_acumuladas_mes: ventas})
      const tieneDataReal = (r.efectivo||0) > 0 || (r.transferencias||0) > 0 || (r.ventas_695||0) > 0 || (r.ventas_642||0) > 0 || (r.ventas_sanjuan||0) > 0
      setFechaDatosHoy(tieneDataReal ? hoyStr() : (rowsRecientes.length > 0 ? rowsRecientes[0].fecha : hoyStr()))
    } else if (rowsRecientes.length > 0) {
      const r = rowsRecientes.find(x => x.usuario_id === currentUid) || rowsRecientes[0]
      const ventas = (r.ventas_acumuladas_mes||0) > 0 ? r.ventas_acumuladas_mes : mejorVentas
      setDatosHoy({...r, ventas_acumuladas_mes: ventas})
      setFechaDatosHoy(rowsRecientes[0].fecha)  // siempre la fecha más reciente sin importar usuario
    }
  }

  async function logH(accion, descripcion) {
    const supabase = getSupabase()
    await supabase.from('historial').insert({tabla:'general', accion, descripcion, usuario_nombre: usuario?.nombre || 'usuario'})
  }

  async function cargarFecha(fecha) {
    const supabase = getSupabase()
    const {data: conId} = await supabase.from('datos_diarios').select('*').eq('fecha',fecha).order('id',{ascending:false}).limit(1).single()
    const {data: gas} = await supabase.from('gastos').select('*').eq('fecha',fecha).order('created_at',{ascending:false})
    const data = conId
    if (data) setDatosDia(data)
    else setDatosDia({efectivo:0,transferencias:0,tarjeta_pendiente:0,cheque_recibido:0,saldo_banco:0,ventas_695:0,ventas_642:0,ventas_sanjuan:0,notas:''})
    if (gas) setGastos(gas)
  }

  async function guardarDatos() {
    if (saving) return
    const ahora = Date.now()
    if (ahora - lastSaveRef.current < 3000) {
      setMsg('Ya guardado recientemente')
      setTimeout(()=>setMsg(''),2000)
      return
    }
    setSaving(true)
    setTimeout(async () => {
      try {
        lastSaveRef.current = Date.now()
        const supabase = getSupabase()
        const {id:_id, created_at:_ca, ...datosSinMeta} = datosDia
        const {data: rowExist} = await supabase.from('datos_diarios')
          .select('*')
          .eq('fecha', fechaCarga)
          .eq('usuario_id', userId)
          .single()

        let error
        if (rowExist) {
          const {error: e} = await supabase.from('datos_diarios')
            .update({
              ...datosSinMeta,
              usuario_nombre: usuario?.nombre,
              updated_at: new Date().toISOString(),
              saldo_banco: datosDia.saldo_banco || rowExist.saldo_banco,
            })
            .eq('id', rowExist.id)
          error = e
        } else {
          const {error: e} = await supabase.from('datos_diarios')
            .insert({
              ...datosSinMeta,
              fecha: fechaCarga,
              usuario_id: userId,
              usuario_nombre: usuario?.nombre,
              updated_at: new Date().toISOString()
            })
          error = e
        }
        if (error) {
          setMsg('❌ Error: ' + error.message)
          setTimeout(()=>setMsg(''),5000)
        } else {
          const esHoy = fechaCarga === hoyStr()
          await logH(esHoy?'UPDATE':'EDIT', `${esHoy?'Actualizó':'Modificó'} datos del ${fechaCarga}`)
          const savedRow = {...datosSinMeta, fecha:fechaCarga, usuario_id:userId, usuario_nombre:usuario?.nombre}
          if (esHoy || !fechaDatosHoy || fechaCarga >= fechaDatosHoy) {
            setDatosHoy(savedRow)
            setFechaDatosHoy(fechaCarga)
          }
          await loadAll()
          setMsg('✓ Guardado')
          setTimeout(()=>setMsg(''),2000)
        }
      } finally {
        setSaving(false)
      }
    }, 1500)
  }

  async function agregarVencimiento() {
    if (!fVenc.fecha || !fVenc.descripcion || !fVenc.monto) return
    const supabase = getSupabase()
    await supabase.from('vencimientos').insert({...fVenc, monto:parseFloat(fVenc.monto), usuario_nombre:usuario?.nombre})
    await logH('INSERT', `Agregó vencimiento: ${fVenc.descripcion} — ${fmt(parseFloat(fVenc.monto))}`)
    setFVenc({fecha:'',descripcion:'',monto:'',tipo:'cheque'})
    setModal('')
    await loadAll()
  }

  function abrirModalPago(v) {
    setModalPago({...MP0, venc:v, montoInput:String(v.monto)})
    setModal('pago')
  }

  async function confirmarPago() {
    const {venc, opcion, montoInput, nuevoMonto, nuevaFecha, medio, cuotas, cheques, interesInput, notaInput, subopcionD} = modalPago
    if (!venc || !opcion) return
    const supabase = getSupabase()
    const montoPagado = parseFloat(String(montoInput).replace(/\./g,'')) || venc.monto
    const ahora = new Date().toLocaleString('es-AR')

    // Caso especial: solo renegociación de fecha — sin paso 2
    if (opcion === 'fecha') {
      if (!nuevaFecha) return
      await supabase.from('vencimientos').update({fecha:nuevaFecha}).eq('id',venc.id)
      await logH('UPDATE', `Fecha renegociada: ${venc.descripcion} → ${nuevaFecha} — ${usuario?.nombre}`)
      setModal(''); setModalPago(MP0); await loadAll(); return
    }

    // Opcion D: No pude pagar
    if (opcion === 'nopago') {
      if (subopcionD === 'interes') {
        if (!nuevaFecha) return
        const interes = parseFloat(interesInput||0) || 0
        const nuevoMontoCalc = Math.round(venc.monto * (1 + interes/100))
        await supabase.from('vencimientos').update({fecha:nuevaFecha, monto:nuevoMontoCalc}).eq('id',venc.id)
        const interesLabel = interes > 0 ? ` (interés ${interes}%)` : ''
        await logH('UPDATE', `Redefinido: ${venc.descripcion} → ${nuevaFecha} ${fmt(nuevoMontoCalc)}${interesLabel} — ${usuario?.nombre} ${ahora}`)
        setModal(''); setModalPago(MP0); await loadAll(); return
      }
      if (subopcionD === 'deuda') {
        await supabase.from('deudas').insert({descripcion:venc.descripcion, monto:venc.monto, tipo:'impago', activa:true, usuario_nombre:usuario?.nombre})
        await supabase.from('vencimientos').delete().eq('id',venc.id)
        await logH('UPDATE', `Pasado a deuda impaga: ${venc.descripcion} — ${fmt(venc.monto)} — ${usuario?.nombre} ${ahora}`)
        setModal(''); setModalPago(MP0); await loadAll(); return
      }
      return
    }

    if (!medio) return

    // Paso 1: actualizar el vencimiento original
    if (opcion === 'completo') {
      await supabase.from('vencimientos').update({pagado:true, fecha_pago:hoyStr()}).eq('id',venc.id)
    } else if (opcion === 'parcial') {
      const saldoRestante = parseFloat(String(nuevoMonto).replace(/\./g,'')) || Math.max(0, venc.monto - montoPagado)
      await supabase.from('vencimientos').update({monto:saldoRestante, fecha:nuevaFecha||venc.fecha}).eq('id',venc.id)
    }

    // Paso 2: impacto según medio de pago
    if (medio === 'efectivo' || medio === 'transferencia' || medio === 'banco') {
      const campo = medio === 'efectivo' ? 'efectivo' : medio === 'transferencia' ? 'transferencias' : 'saldo_banco'
      const {data: rowHoy} = await supabase.from('datos_diarios').select('*').eq('fecha',hoyStr()).order('id',{ascending:false}).limit(1).single()
      if (rowHoy) {
        await supabase.from('datos_diarios').update({[campo]: (rowHoy[campo]||0) - montoPagado}).eq('id',rowHoy.id)
      } else {
          // No existe registro de hoy — no crear uno vacío, solo loguear
          await logH('UPDATE', `Sin registro de hoy para descontar pago — ${campo}: ${fmt(montoPagado)}`)
      }
    } else if (medio === 'cheque') {
      for (const ch of cheques) {
        const montoChq = parseFloat(String(ch.monto).replace(/\./g,'')) || 0
        if (montoChq > 0 && ch.fecha) {
          await supabase.from('vencimientos').insert({descripcion:`Cheque emitido — ${venc.descripcion}`, monto:montoChq, fecha:ch.fecha, tipo:'cheque', pagado:false, usuario_nombre:usuario?.nombre})
        }
      }
    } else if (medio === 'tarjeta' && cuotas > 1) {
      const montoCuota = Math.round(montoPagado / cuotas)
      const [hy,hm,hd] = hoyStr().split('-').map(Number)
      for (let i = 1; i <= cuotas; i++) {
        const fc = new Date(hy, hm-1, hd + i*30)
        const fs = `${fc.getFullYear()}-${String(fc.getMonth()+1).padStart(2,'0')}-${String(fc.getDate()).padStart(2,'0')}`
        await supabase.from('vencimientos').insert({descripcion:`Cuota tarjeta ${i}/${cuotas} — ${venc.descripcion}`, monto:montoCuota, fecha:fs, tipo:'tarjeta', pagado:false, usuario_nombre:usuario?.nombre})
      }
    }

    const medioLabel = {efectivo:'Efectivo',transferencia:'Transferencia',banco:'Banco',cheque:'Cheque emitido',tarjeta:'Tarjeta'}[medio]
    const cuotasLabel = medio === 'tarjeta' ? ` (${cuotas} cuota${cuotas>1?'s':''})` : ''
    await logH('UPDATE', `Pago: ${venc.descripcion} ${fmt(montoPagado)} via ${medioLabel}${cuotasLabel} — ${usuario?.nombre} ${ahora}`)
    setModal(''); setModalPago(MP0); await loadAll()
  }

  async function acreditarTarjeta() {
    const monto = parseFloat(String(tarjetaMontoInput).replace(/\./g,'')) || 0
    if (!monto) return
    const supabase = getSupabase()
    const hoy = hoyStr()
    const fechaOriginal = fechaDatosHoy || hoy

    // 1. Marcar el día original como acreditado
    const {error: e1} = await supabase.from('datos_diarios')
      .update({ tarjeta_acreditada: true, tarjeta_monto_real: monto })
      .eq('fecha', fechaOriginal)
      .eq('usuario_id', userId)
    if (e1) return

    // 2. Sumar al saldo_banco SOLO si el día original NO es hoy
    //    Si el día original ES hoy, ya está sumado en el mismo registro
    if (fechaOriginal !== hoy) {
      const {data: rowHoy} = await supabase.from('datos_diarios')
        .select('*')
        .eq('fecha', hoy)
        .order('id', {ascending:false})
        .limit(1)
        .single()
      if (rowHoy) {
        await supabase.from('datos_diarios')
          .update({ saldo_banco: (rowHoy.saldo_banco || 0) + monto })
          .eq('id', rowHoy.id)
      } else {
        await supabase.from('datos_diarios')
          .upsert(
            { fecha: hoy, usuario_id: userId, usuario_nombre: usuario?.nombre, saldo_banco: monto },
            { onConflict: 'fecha,usuario_id' }
          )
      }
    } else {
      // El día original es hoy: sumar directamente al saldo_banco de hoy
      const {data: rowHoy} = await supabase.from('datos_diarios')
        .select('*')
        .eq('fecha', hoy)
        .order('id', {ascending:false})
        .limit(1)
        .single()
      if (rowHoy) {
        await supabase.from('datos_diarios')
          .update({ saldo_banco: (rowHoy.saldo_banco || 0) + monto })
          .eq('id', rowHoy.id)
      }
    }

    await logH('UPDATE', `Acreditación tarjeta: ${fmt(monto)} — ${usuario?.nombre} ${new Date().toLocaleString('es-AR')}`)
    await loadAll()
    setTarjetaInputShow(false)
    setTarjetaMontoInput('')
  }

  async function agregarDeuda() {
    if (!fDeuda.descripcion || !fDeuda.monto) return
    const supabase = getSupabase()
    await supabase.from('deudas').insert({...fDeuda, monto:parseFloat(fDeuda.monto), usuario_nombre:usuario?.nombre})
    await logH('INSERT', `Agregó deuda: ${fDeuda.descripcion} — ${fmt(parseFloat(fDeuda.monto))}`)
    setFDeuda({descripcion:'',monto:'',tipo:'tarjeta'})
    setModal('')
    await loadAll()
  }

  async function guardarAjuste() {
    const monto = parseFloat(String(fAjuste.monto).replace(/\./g,''))
    if (!monto || !fAjuste.motivo) return
    const supabase = getSupabase()
    const hoy = hoyStr()
    let {data: rowHoy} = await supabase.from('datos_diarios')
      .select('*')
      .eq('fecha', hoy)
      .order('id', { ascending: false })
      .limit(1)
      .single()
    if (!rowHoy) {
      const {data: nuevo} = await supabase.from('datos_diarios')
        .insert({ fecha: hoy, usuario_id: userId, usuario_nombre: usuario?.nombre || 'usuario' })
        .select('*')
        .single()
      if (!nuevo) { setMsg('✗ Error al crear registro para hoy'); setTimeout(()=>setMsg(''),3000); return }
      rowHoy = nuevo
    }
    await supabase.from('datos_diarios')
      .update({ [fAjuste.campo]: (rowHoy[fAjuste.campo]||0) + monto })
      .eq('id', rowHoy.id)
    await logH('UPDATE', `Ajuste ${fAjuste.campo}: ${monto > 0 ? '+' : ''}${fmt(monto)} — Motivo: ${fAjuste.motivo}`)
    setFAjuste({campo:'efectivo', monto:'', motivo:''})
    setMsg('✓ Ajuste guardado')
    setTimeout(()=>setMsg(''),2000)
    await loadAll()
  }

  async function agregarGasto() {
    if (!fGasto.descripcion || !fGasto.monto) return
    const supabase = getSupabase()
    await supabase.from('gastos').insert({...fGasto, monto:parseFloat(fGasto.monto), fecha:fechaCarga, usuario_nombre:usuario?.nombre})
    await logH('INSERT', `Registró gasto: ${fGasto.descripcion} — ${fmt(parseFloat(fGasto.monto))}`)
    setFGasto({descripcion:'',monto:'',categoria:'stock'})
    await loadAll()
    setMsg('✓ Gasto registrado')
    setTimeout(()=>setMsg(''),2000)
  }

  async function agregarGastoSucursal() {
    if (!fPagoSucursal.descripcion || !fPagoSucursal.monto) return
    const supabase = getSupabase()
    const sucLabels = {'695':'Córdoba 695','642':'Córdoba 642','sanjuan':'San Juan 655'}
    const desc = `[SUC ${sucLabels[fPagoSucursal.sucursal]||fPagoSucursal.sucursal}] ${fPagoSucursal.descripcion}`
    const monto = parseFloat(String(fPagoSucursal.monto).replace(/\./g,''))
    await supabase.from('gastos').insert({descripcion:desc, monto, fecha:fechaCarga, categoria:fPagoSucursal.categoria, usuario_nombre:usuario?.nombre})
    await logH('INSERT', `Pago sucursal ${sucLabels[fPagoSucursal.sucursal]}: ${fPagoSucursal.descripcion} — ${fmt(monto)}`)
    setFPagoSucursal({sucursal:'695',descripcion:'',monto:'',categoria:'stock'})
    await loadAll()
    setMsg('✓ Pago registrado')
    setTimeout(()=>setMsg(''),2000)
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
    await supabase.from('gastos').insert({descripcion:desc, monto:descuento > 0 ? descuento : 0, fecha:fechaCarga, categoria:'cambio', usuario_nombre:usuario?.nombre})
    await logH('INSERT', `Registró cambio: ${tipoLabel} ${fmt(orig)} → ${fmt(recib)}`)
    setFCambio({tipo:'cheque_efectivo',monto_original:'',monto_recibido:'',descripcion:''})
    await loadAll()
    setMsg('✓ Cambio registrado')
    setTimeout(()=>setMsg(''),2000)
  }

  async function eliminarItem(tabla, id, desc) {
    if (!confirm(`¿Eliminar "${desc}"?`)) return
    const supabase = getSupabase()
    await supabase.from(tabla).update({activa:false}).eq('id',id)
    await logH('DELETE', `Eliminó de ${tabla}: ${desc}`)
    await loadAll()
  }

  async function pagarDeuda(deuda) {
    const input = prompt(`Pago parcial — ${deuda.descripcion}\nDeuda actual: ${fmt(deuda.monto)}\n\nMonto pagado hoy:`)
    if (!input) return
    const pago = parseFloat(String(input).replace(/\./g,'').replace(',','.'))
    if (!pago || pago <= 0) return
    const supabase = getSupabase()
    const nuevoMonto = deuda.monto - pago
    if (nuevoMonto <= 0) {
      await supabase.from('deudas').update({ activa: false, monto: 0 }).eq('id', deuda.id)
      await logH('UPDATE', `Deuda saldada: ${deuda.descripcion} — último pago: ${fmt(pago)}`)
    } else {
      await supabase.from('deudas').update({ monto: nuevoMonto }).eq('id', deuda.id)
      await logH('UPDATE', `Pago parcial ${deuda.descripcion}: -${fmt(pago)} → saldo ${fmt(nuevoMonto)}`)
    }
    await loadAll()
  }

  async function logout() {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Calculations
  const totalVentasDia = (datosDia.ventas_695||0) + (datosDia.ventas_642||0) + (datosDia.ventas_sanjuan||0)
  const ventasHoy = (datosHoy.efectivo||0) + (datosHoy.transferencias||0) + (datosHoy.cheque_recibido||0)
  const liquidoHoy = liquidoTotal  // estado directo — no derivado de acumData para evitar renders con snapshot viejo
  const disponibleTotal = liquidoHoy
  const v3 = vencimientos.filter(v => { const d = diasHasta(v.fecha); return d >= 0 && d <= 3 })
  const tv3 = v3.reduce((s,v) => s+v.monto, 0)
  const v7 = vencimientos.filter(v => { const d = diasHasta(v.fecha); return d >= 0 && d <= 7 })
  const tv7 = v7.reduce((s,v) => s+v.monto, 0)
  const v15 = vencimientos.filter(v => { const d = diasHasta(v.fecha); return d >= 0 && d <= 15 })
  const tv15 = v15.reduce((s,v) => s+v.monto, 0)
  const posNeta = disponibleTotal - tv15
  const pctObj = ventasHoy > 0 ? Math.min(100, Math.round(ventasHoy / OBJ_DIA * 100)) : 0
  const cmv = ventasMes * CMV_R
  const mb = ventasMes - cmv
  const neto = mb - FIJOS
  const stockValor = stock.reduce((s,i) => s+(i.cantidad*i.costo_unitario), 0)
  const totalDeudas = deudas.reduce((s,d) => s+d.monto, 0)
  const colorLiquido = liquidoHoy > 3e6 ? '#3ddc84' : liquidoHoy > 1e6 ? '#f5a623' : '#ff5050'
  const colorVentas = pctObj >= 100 ? '#3ddc84' : pctObj >= 70 ? '#f5a623' : '#ff5050'
  const diasDelMes = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()

  // Flujo 33 días (hoy-3 a hoy+29)
  const tablaFlujo = []
  let acumFlujo = liquidoHoy
  const hoyBase = new Date()
  const hY = hoyBase.getFullYear(), hM = hoyBase.getMonth(), hD = hoyBase.getDate()
  const hoyStr0 = `${hY}-${String(hM+1).padStart(2,'0')}-${String(hD).padStart(2,'0')}`
  const ayerDate = new Date(hY, hM, hD - 1)
  const ayerStr = `${ayerDate.getFullYear()}-${String(ayerDate.getMonth()+1).padStart(2,'0')}-${String(ayerDate.getDate()).padStart(2,'0')}`
  const d_m3 = new Date(hY, hM, hD - 3), d_p29 = new Date(hY, hM, hD + 29)
  const flujoInicioStr = `${d_m3.getFullYear()}-${String(d_m3.getMonth()+1).padStart(2,'0')}-${String(d_m3.getDate()).padStart(2,'0')}`
  const flujoFinStr    = `${d_p29.getFullYear()}-${String(d_p29.getMonth()+1).padStart(2,'0')}-${String(d_p29.getDate()).padStart(2,'0')}`
  const gastosFijos = generateGastosFijosRecurrentes(flujoInicioStr, flujoFinStr, vencimientos)
  // Mapa explícito fecha→ventas para lookup sin ambigüedad
  const ventasMap = {}
  historialDias.forEach(d => {
    const total = (d.ventas_695||0)+(d.ventas_642||0)+(d.ventas_sanjuan||0)
    if (total > 0 && total < 5000000) ventasMap[d.fecha] = total
  })
  const todosVencimientosMap = {}
  ;[...vencimientos, ...vencPagados].forEach(v => {
    if (!todosVencimientosMap[v.fecha]) todosVencimientosMap[v.fecha] = []
    todosVencimientosMap[v.fecha].push(v)
  })
  for (let i = -3; i <= 29; i++) {
    const fecha = new Date(hY, hM, hD + i)
    const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`
    const esPasadoOAyer = fechaStr < hoyStr0  // cualquier día antes de hoy
    const esHoy         = fechaStr === hoyStr0
    const esDomingo     = fecha.getDay() === 0
    // REGLA CONTABLE: pasado = hecho real (o $0 si no se cargó). Nunca proyectar el pasado.
    // Solo proyectar desde hoy en adelante.
    let entradas = 0
    if (!esDomingo) {
      const ventasReal = Number(ventasMap[fechaStr] || 0)
      if (ventasReal > 0)       entradas = ventasReal
      else if (esPasadoOAyer)   entradas = 0
      else                      entradas = FLUJO_DEFAULT
    }
    const vencDia = esPasadoOAyer
      ? (todosVencimientosMap[fechaStr] || [])
      : vencimientos.filter(v => v.fecha === fechaStr)
    const fijosDia = gastosFijos.filter(g => g.fecha === fechaStr)
    const gastosDelDia = gastosFlujoData.filter(g => g.fecha === fechaStr)

    const totalVenc    = vencDia.reduce((s,v) => s + Number(v.monto||0), 0)
    const totalFijos   = fijosDia.reduce((s,v) => s + Number(v.monto||0), 0)
    const totalGastos  = gastosDelDia.reduce((s,g) => s + Number(g.monto||0), 0)
    const salidas = totalVenc + totalFijos + totalGastos
    const todasSalidas = [...vencDia.map(v=>({...v,esFijo:false})), ...fijosDia]
    acumFlujo += entradas - salidas
    tablaFlujo.push({
      fechaLabel: fecha.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'}),
      entradas, salidas, vencDia, todasSalidas, gastosDelDia,
      cajaDia: entradas - salidas,
      acumulado: Math.round(acumFlujo),
      esPasado: esPasadoOAyer,
    })
  }
  const diasRojo = tablaFlujo.filter(r => !r.esPasado && r.acumulado < 0).length
  const diasAmarillo = tablaFlujo.filter(r => !r.esPasado && r.acumulado >= 0 && r.acumulado < 1000000).length

  function tipoBadge(t) {
    const m = {cheque:'#f5a623',echeq:'#f5a623',banco:'#5b9fff',impuesto:'#ff5050',sueldo:'#ff5050',servicio:'#7a7876',tarjeta:'#f5a623',proveedor:'#7a7876',personal:'#5b9fff',stock:'#3ddc84',alquiler:'#5b9fff',mercaderia:'#3ddc84',prestamo:'#a78bfa',cambio:'#22d3ee',otro:'#7a7876'}
    const l = {cheque:'CHQ',echeq:'ECHEQ',banco:'BCO',impuesto:'AFIP',sueldo:'SUE',servicio:'SVC',tarjeta:'TRJ',proveedor:'PRV',personal:'CRED',stock:'STK',alquiler:'ALQ',mercaderia:'MERC',prestamo:'PREST',cambio:'CAMBIO',otro:'OTRO'}
    return <span style={{fontSize:'9px',fontWeight:700,padding:'2px 6px',borderRadius:'4px',fontFamily:'monospace',background:(m[t]||'#7a7876')+'22',color:m[t]||'#7a7876'}}>{l[t]||t.toUpperCase()}</span>
  }

  const C = {
    bg: '#13141a', card: '#1c1e26', cardBorder: 'rgba(255,255,255,0.09)',
    inputBg: '#23252f', label: '#8b9099', muted: '#4a4e58', text: '#e8eaf0',
    accent: '#f5e000', green: '#34d399', red: '#f87171', blue: '#60a5fa',
  }
  const S = {
    page: {padding:'16px 16px 90px',fontFamily:"'Syne',sans-serif"},
    sec: {fontSize:'11px',fontWeight:700,letterSpacing:'.12em',color:C.muted,textTransform:'uppercase',margin:'22px 0 12px',marginTop:'28px',paddingTop:'18px',borderTop:'1px solid rgba(255,255,255,0.08)'},
    secVentas: {fontSize:'11px',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#3ddc84',marginBottom:'8px',marginTop:'28px',paddingTop:'18px',borderTop:'1px solid rgba(61,220,132,0.2)'},
    secCaja: {fontSize:'11px',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#5b9fff',marginBottom:'8px',marginTop:'28px',paddingTop:'18px',borderTop:'1px solid rgba(91,159,255,0.2)'},
    secAjuste: {fontSize:'11px',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#a78bfa',marginBottom:'8px',marginTop:'28px',paddingTop:'18px',borderTop:'1px solid rgba(167,139,250,0.2)'},
    secPago: {fontSize:'11px',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#f5a623',marginBottom:'8px',marginTop:'28px',paddingTop:'18px',borderTop:'1px solid rgba(245,166,35,0.2)'},
    secGasto: {fontSize:'11px',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'#ff5050',marginBottom:'8px',marginTop:'28px',paddingTop:'18px',borderTop:'1px solid rgba(255,80,80,0.2)'},
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
    {id:'flujo',icon:'→',label:'FLUJO'},
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
        .fomo-metrics-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; width: 100%; }
        .fomo-metric-card { width: 100%; min-width: 0; min-height: 100px; padding: 16px 12px; position: relative; overflow: visible; box-sizing: border-box; }
        .fomo-metric-value { font-size: clamp(14px, 1.8vw, 26px); line-height: 1.1; font-weight: 800; font-family: 'DM Mono', monospace; letter-spacing: -1px; width: 100%; overflow: visible; white-space: nowrap; }
        .fomo-metric-label { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 8px; }
        .fomo-metric-sub { font-size: 11px; margin-top: 6px; font-family: 'DM Mono', monospace; }
        @keyframes pulse-urgente { 0%,100% { opacity: 1 } 50% { opacity: 0.6 } }
        .venc-urgente { animation: pulse-urgente 1.5s ease-in-out infinite; background: rgba(220,38,38,0.15) !important; }
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
          .fomo-sidebar-logo { font-size: 26px; font-weight: 800; letter-spacing: -1px; padding: 28px 28px 24px; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 12px; }
          .fomo-sidebar-btn { display: flex; align-items: center; gap: 14px; padding: 13px 28px; font-size: 13px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; cursor: pointer; border: none; background: none; font-family: 'Syne', sans-serif; width: 100%; text-align: left; transition: all .15s; position: relative; }
          .fomo-sidebar-btn:hover { background: rgba(255,255,255,0.05); }
          .fomo-sidebar-btn.active { background: rgba(245,166,35,0.08); color: #f5a623 !important; }
          .fomo-sidebar-btn.active::before { content: ''; position: absolute; left: 0; top: 4px; bottom: 4px; width: 3px; background: #f5a623; border-radius: 0 3px 3px 0; }
          .fomo-sidebar-icon { font-size: 20px; width: 26px; text-align: center; }
          .fomo-main { flex: 1; min-width: 0; overflow-y: auto; }
          .fomo-header { padding: 22px 40px !important; }
          .fomo-header-logo { display: none; }
          .fomo-content { max-width: 760px; margin: 0 auto; padding: 28px 40px 60px !important; }
          .fomo-bottom-nav { display: none !important; }
          .fomo-metrics-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 12px !important; }
          .fomo-metric-card { min-height: 100px !important; padding: 16px 12px !important; }
          .fomo-metric-value { font-size: clamp(14px, 1.8vw, 26px) !important; }
          .fomo-metric-label { font-size: 11px !important; }
          .fomo-metric-sub { font-size: 11px !important; }
          .fomo-modal-inner { border-radius: 20px !important; max-width: 500px; margin: auto; }
          .fomo-modal-wrap { align-items: center !important; }
          .fomo-sidebar-user { margin-top: auto; padding: 20px 28px; border-top: 1px solid rgba(255,255,255,0.07); font-size: 12px; color: #8b9099; font-family: monospace; line-height: 1.6; }
          .fomo-card-row { font-size: 14px !important; padding: 13px 0 !important; }
          .fomo-section-title { font-size: 12px !important; margin: 28px 0 14px !important; }
        }
      `}</style>

      <div className="fomo-desktop-layout">

      {/* SIDEBAR */}
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

      {/* BANNER URGENTE */}
      {tab === 'hoy' && v3.length > 0 && (
        <div onClick={()=>setTab('pagos')} style={{background:'#dc2626',color:'#fff',padding:'12px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',letterSpacing:'.02em'}}>
          ⚠ ATENCIÓN: {v3.length} vencimiento(s) en los próximos 3 días — Total: {fmt(tv3)}
          <span style={{marginLeft:'auto',fontSize:'11px',opacity:.8}}>Ver PAGOS →</span>
        </div>
      )}

      {/* ALERTAS HOY */}
      {tab === 'hoy' && (
        <div style={{padding:'12px 16px 0'}}>
          {fechaDatosHoy && fechaDatosHoy !== hoyStr() && (
            <div style={{background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.25)',borderRadius:'12px',padding:'12px 16px',fontSize:'13px',color:C.blue,marginBottom:'10px',fontWeight:500}}>
              📅 Último dato: <strong>{fechaDatosHoy.split('-').reverse().join('/')}</strong> — Todavía no cargaste datos de hoy.
            </div>
          )}
          {vencimientos.filter(v => diasHasta(v.fecha) === 0).length > 0 && (
            <div style={{background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.25)',borderRadius:'12px',padding:'12px 16px',fontSize:'13px',color:'#fca5a5',marginBottom:'10px',lineHeight:1.6,fontWeight:500}}>
              🔴 <strong>HOY vencen:</strong> {vencimientos.filter(v=>diasHasta(v.fecha)===0).map(v=>v.descripcion).join(', ')} — {fmt(vencimientos.filter(v=>diasHasta(v.fecha)===0).reduce((s,v)=>s+v.monto,0))}
            </div>
          )}
          {(() => {
            const manana = vencimientos.filter(v=>diasHasta(v.fecha)===1)
            if (manana.length === 0) return null
            const totalManana = manana.reduce((s,v)=>s+v.monto,0)
            const texto = manana.length === 1
              ? `${manana[0].descripcion} — ${fmt(manana[0].monto)}`
              : `${manana.length} obligaciones — Total: ${fmt(totalManana)}`
            return (
              <div style={{background:'rgba(245,166,35,0.1)',border:'1px solid rgba(245,166,35,0.25)',borderRadius:'12px',padding:'12px 16px',fontSize:'13px',color:'#fcd34d',marginBottom:'10px',lineHeight:1.6,fontWeight:500}}>
                🟡 <strong>Mañana vencen:</strong> {texto}
              </div>
            )
          })()}
        </div>
      )}

      {/* HOY */}
      {tab === 'hoy' && (
        <div className="fomo-content" style={S.page}>
          <div className="fomo-metrics-grid" style={{marginBottom:'14px'}}>
            {[
              {label:'VENTAS HOY',tipo:'ventas',val:fechaDatosHoy===hoyStr()?fmt(ventasHoy):'$0',color:fechaDatosHoy===hoyStr()?colorVentas:C.muted,sub:fechaDatosHoy===hoyStr()?`${pctObj}% del objetivo`:'Sin carga de hoy',prog:fechaDatosHoy===hoyStr()?pctObj:0},
              {label:'LÍQUIDO HOY',tipo:'liquido',val:fmt(liquidoHoy),color:'#4ade80',sub:'efectivo + transf. + banco',prog:0},
              {label:'VENCE 7 DÍAS',tipo:'vence7',val:fmt(tv7),color:C.red,sub:`${v7.length} obligacion(es)`,prog:0},
              {label:'MES ACTUAL',tipo:'mes',val:fmt(ventasMes||datosHoy.ventas_acumuladas_mes||0),color:C.blue,sub:`${new Date().getDate()} días`,prog:0},
            ].map((k,i) => (
              <div key={i} className="fomo-metric-card" style={{background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:'14px',marginBottom:0}}>
                <div style={{position:'absolute',top:0,left:0,right:0,height:'3px',background:k.color,opacity:.9}}/>
                <div className="fomo-metric-label" style={{color:C.label}}>{k.label}</div>
                <div className="fomo-metric-value" style={{color:k.color,cursor:'pointer'}} onClick={()=>setModalDetalle({tipo:k.tipo,open:true})}>{k.val}</div>
                <div className="fomo-metric-sub" style={{color:C.muted}}>{k.sub}</div>
                {k.prog > 0 && <div style={{background:C.inputBg,borderRadius:'4px',height:'4px',marginTop:'10px',overflow:'hidden'}}><div style={{height:'100%',borderRadius:'4px',background:k.color,width:k.prog+'%',transition:'width .4s'}}/></div>}
              </div>
            ))}
          </div>

          <div style={S.sec}>Detalle del último día cargado {fechaDatosHoy && fechaDatosHoy !== hoyStr() ? `(${fechaDatosHoy.split('-').reverse().join('/')})` : ''}</div>
          <div style={S.card}>
            {[
              {label:'Efectivo', val:datosHoy.efectivo||0},
              {label:'Transferencias', val:datosHoy.transferencias||0},
              {label:'Cheques / E-cheq recibidos', val:datosHoy.cheque_recibido||0},
            ].map((r,i) => (
              <div key={i} style={S.row}>
                <span style={{color:C.label}}>{r.label}</span>
                <span style={{fontFamily:'monospace',fontSize:'12px'}}>{fmt(r.val)}</span>
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
              {l:'Efectivo acumulado', v:acumData.efectivo, c:'#3ddc84'},
              {l:'Transferencias acumuladas', v:acumData.transferencias, c:'#3ddc84'},
              {l:'Banco acumulado', v:acumData.saldoBanco, c:'#3ddc84'},
              {l:'Gastos registrados', v:-acumData.gastos, c:C.red},
            ].map((r,i) => (
              <div key={i} style={S.row}>
                <span style={{color:C.label,fontSize:'12px'}}>{r.l}</span>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:r.c}}>{r.v<0?'−'+fmt(-r.v):fmt(r.v)}</span>
              </div>
            ))}
            <div style={{...S.row,fontWeight:700,fontSize:'13px',borderTop:'1px solid rgba(255,255,255,0.13)',marginTop:'4px',paddingTop:'10px'}}>
              <span>TOTAL LÍQUIDO</span>
              <span style={{fontFamily:'monospace',color:liquidoHoy>2e6?'#3ddc84':'#f5a623'}}>{fmt(liquidoHoy)}</span>
            </div>
            <div style={S.row}><span style={{color:C.label,fontSize:'12px'}}>Vence próx. 15 días</span><span style={{fontFamily:'monospace',fontSize:'12px',color:C.red}}>−{fmt(tv15)}</span></div>
            <div style={{...S.row,borderBottom:'none',fontWeight:700,fontSize:'14px',background:'rgba(245,166,35,0.06)',margin:'4px -13px -13px',padding:'12px 13px',borderRadius:'0 0 12px 12px'}}>
              <span>Posición neta 15d</span>
              <span style={{fontFamily:'monospace',color:posNeta>0?'#3ddc84':'#ff5050'}}>{fmt(posNeta)}</span>
            </div>
          </div>

          {/* Tarjeta pendiente — card separada */}
          {tarjetaAcumulada > 0 && (
            <div style={{...S.card,border:'1px solid rgba(245,166,35,0.35)',background:'rgba(245,166,35,0.05)'}}>
              {tarjetaAcumulada <= 0 ? (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'13px',color:C.muted}}>Tarjeta — todo acreditado</span>
                  <span style={{fontFamily:'monospace',fontSize:'13px',color:C.muted}}>✓</span>
                </div>
              ) : (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:tarjetaInputShow?'12px':'0'}}>
                    <div>
                      <div style={{fontSize:'12px',color:C.accent,fontWeight:700,marginBottom:'2px'}}>Tarjeta pendiente acreditación</div>
                      <div style={{fontFamily:'monospace',fontSize:'16px',fontWeight:700,color:C.accent}}>{fmt(tarjetaAcumulada)}</div>
                      <div style={{fontSize:'11px',color:C.muted}}>Acumulado de días sin acreditar</div>
                    </div>
                    {!tarjetaInputShow && (
                      <button onClick={()=>{setTarjetaInputShow(true);setTarjetaMontoInput(String(datosHoy.tarjeta_pendiente))}}
                        style={{background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.35)',borderRadius:'8px',color:C.green,cursor:'pointer',fontSize:'13px',padding:'8px 14px',fontWeight:700,flexShrink:0}}>
                        ✓ Acreditó
                      </button>
                    )}
                  </div>
                  {tarjetaInputShow && (
                    <div>
                      <label style={S.label}>Monto real recibido (con comisiones)</label>
                      <input type="text" inputMode="numeric" style={{...S.inp,marginBottom:'10px'}}
                        value={tarjetaMontoInput}
                        onChange={e=>setTarjetaMontoInput(e.target.value.replace(/[^\d]/g,''))}/>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'9px'}}>
                        <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label}} onClick={()=>setTarjetaInputShow(false)}>Cancelar</button>
                        <button style={S.btn} onClick={acreditarTarjeta}>Confirmar</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div style={S.sec}>Últimos cambios del equipo</div>
          <div style={S.card}>
            {historial.slice(0,5).map((h,i) => (
              <div key={i} style={{...S.row,...(i===4?{borderBottom:'none'}:{})}}>
                <div>
                  <span style={{fontSize:'11px',color:C.label}}>{h.descripcion}</span>
                  <div style={{fontSize:'10px',color:C.muted,marginTop:'2px'}}>{h.usuario_nombre}</div>
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
            <div style={S.secVentas}>Datos del día</div>
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
          ].map(f => (
            <div key={f.key} style={S.card}>
              <label style={S.label}>{f.label}</label>
              <input type="text" inputMode="numeric" style={S.inp}
                value={fmtInput(datosDia[f.key])}
                placeholder="0"
                onChange={e => setDatosDia({...datosDia, [f.key]: parseFloat(e.target.value.replace(/\./g,''))||0})}
              />
              {f.hint && <p style={{fontSize:'10px',color:C.muted,marginTop:'5px',fontFamily:'monospace'}}>{f.hint}</p>}
            </div>
          ))}

          {/* Ventas por sucursal */}
          <div style={S.secVentas}>Ventas del día por sucursal</div>
          <div style={S.card}>
            {[
              {label:'Ventas Córdoba 695 — hoy ($)', key:'ventas_695'},
              {label:'Ventas Córdoba 642 — hoy ($)', key:'ventas_642'},
              {label:'Ventas San Juan 655 — hoy ($)', key:'ventas_sanjuan'},
            ].map(f => (
              <div key={f.key} style={{marginBottom:'12px'}}>
                <label style={S.label}>{f.label}</label>
                <input type="text" inputMode="numeric" style={S.inp}
                  value={fmtInput(datosDia[f.key])}
                  placeholder="0"
                  onChange={e => setDatosDia({...datosDia, [f.key]: parseFloat(e.target.value.replace(/\./g,''))||0})}
                />
              </div>
            ))}
            <div style={{background:C.inputBg,borderRadius:'10px',padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'13px',color:C.label,fontWeight:600}}>Total del día</span>
              <span style={{fontFamily:'DM Mono,monospace',fontSize:'16px',fontWeight:700,color:C.green}}>{fmt(totalVentasDia)}</span>
            </div>
            {(datosDia.ventas_695||0) === 0 && (datosDia.ventas_642||0) === 0 && (datosDia.ventas_sanjuan||0) > 0 && (
              <p style={{fontSize:'10px',color:C.muted,marginTop:'8px',fontFamily:'monospace'}}>Ventas cargadas como San Juan (migración anterior)</p>
            )}
          </div>

          <div style={S.card}>
            <label style={S.label}>Notas del día (opcional)</label>
            <input type="text" style={S.inp} placeholder="ej: día lento, falta stock..."
              value={datosDia.notas||''} onChange={e => setDatosDia({...datosDia, notas:e.target.value})}/>
          </div>
          <div style={S.secAjuste}>Ajuste de caja</div>
          <div style={S.card}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'9px',marginBottom:'10px'}}>
              <div>
                <label style={S.label}>Campo a ajustar</label>
                <select style={S.sel} value={fAjuste.campo} onChange={e=>setFAjuste({...fAjuste,campo:e.target.value})}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencias">Transferencias</option>
                  <option value="saldo_banco">Banco</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Monto (positivo o negativo)</label>
                <input type="text" inputMode="numeric" style={S.inp} placeholder="ej: -5000"
                  value={fAjuste.monto} onChange={e=>setFAjuste({...fAjuste,monto:e.target.value.replace(/[^\d\-]/g,'')})}/>
              </div>
            </div>
            <label style={S.label}>Motivo (obligatorio)</label>
            <input type="text" style={{...S.inp,marginBottom:'10px'}} placeholder="ej: Corrección error de carga"
              value={fAjuste.motivo} onChange={e=>setFAjuste({...fAjuste,motivo:e.target.value})}/>
            <button style={{...S.btn,background:'transparent',border:'1px solid rgba(167,139,250,0.4)',color:'#a78bfa'}} onClick={guardarAjuste}>
              Aplicar ajuste
            </button>
          </div>

          <button style={{...S.btn, background: fechaCarga !== hoyStr() ? C.inputBg : C.accent, color: fechaCarga !== hoyStr() ? C.accent : '#000', border: fechaCarga !== hoyStr() ? `2px solid ${C.accent}` : 'none'}} onClick={guardarDatos} disabled={saving}>
            {saving ? 'Guardando...' : fechaCarga !== hoyStr() ? `✏️ Guardar modificación del ${fechaCarga.split('-').reverse().join('/')}` : `Guardar — ${usuario?.nombre}`}
          </button>

          {/* Pago de sucursal */}
          <div style={S.secPago}>Registrar pago de sucursal</div>
          <div style={S.card}>
            <div style={{marginBottom:'10px'}}>
              <label style={S.label}>Sucursal</label>
              <select style={S.sel} value={fPagoSucursal.sucursal} onChange={e=>setFPagoSucursal({...fPagoSucursal,sucursal:e.target.value})}>
                <option value="695">Córdoba 695</option>
                <option value="642">Córdoba 642</option>
                <option value="sanjuan">San Juan 655</option>
              </select>
            </div>
            <div style={{marginBottom:'10px'}}>
              <label style={S.label}>Descripción</label>
              <input type="text" style={S.inp} placeholder="ej: Pago proveedor fundas"
                value={fPagoSucursal.descripcion} onChange={e=>setFPagoSucursal({...fPagoSucursal,descripcion:e.target.value})}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'9px',marginBottom:'10px'}}>
              <div>
                <label style={S.label}>Monto ($)</label>
                <input type="text" inputMode="numeric" style={S.inp} placeholder="0"
                  value={fPagoSucursal.monto ? fmtInput(parseFloat(String(fPagoSucursal.monto).replace(/\./g,''))||0) : ''}
                  onChange={e=>setFPagoSucursal({...fPagoSucursal,monto:e.target.value.replace(/\./g,'')})}/>
              </div>
              <div>
                <label style={S.label}>Categoría</label>
                <select style={S.sel} value={fPagoSucursal.categoria} onChange={e=>setFPagoSucursal({...fPagoSucursal,categoria:e.target.value})}>
                  <option value="stock">Stock</option>
                  <option value="servicio">Servicio</option>
                  <option value="otro">Gasto operativo</option>
                  <option value="cambio">Otro</option>
                </select>
              </div>
            </div>
            <button style={{...S.btn,background:'transparent',border:'1px solid rgba(96,165,250,0.4)',color:C.blue}} onClick={agregarGastoSucursal}>
              + Registrar pago sucursal
            </button>
          </div>

          <div style={S.secGasto}>Registrar gasto del día</div>
          <div style={S.card}>
            <label style={S.label}>Descripción</label>
            <input type="text" style={{...S.inp,marginBottom:'10px'}} placeholder="ej: Pago proveedor fundas"
              value={fGasto.descripcion} onChange={e=>setFGasto({...fGasto,descripcion:e.target.value})}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'9px'}}>
              <div>
                <label style={S.label}>Monto ($)</label>
                <input type="text" inputMode="numeric" style={S.inp} placeholder="0"
                  value={fGasto.monto ? fmtInput(parseFloat(fGasto.monto)||0) : ''}
                  onChange={e=>setFGasto({...fGasto,monto:e.target.value.replace(/\./g,'')})}/>
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
                  <option value="ajuste_caja">Ajuste de caja</option>
                  <option value="ajuste_contable">Ajuste contable</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
            <button style={{...S.btn,marginTop:'12px',background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.text}} onClick={agregarGasto}>
              + Registrar gasto
            </button>
          </div>

          <div style={S.secCaja}>Registrar cambio de dinero</div>
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
                <input type="text" inputMode="numeric" style={S.inp} placeholder="0"
                  value={fCambio.monto_original ? fmtInput(parseFloat(fCambio.monto_original)||0) : ''}
                  onChange={e=>setFCambio({...fCambio,monto_original:e.target.value.replace(/\./g,'')})}/>
              </div>
              <div>
                <label style={S.label}>Lo que recibís ($)</label>
                <input type="text" inputMode="numeric" style={S.inp} placeholder="0"
                  value={fCambio.monto_recibido ? fmtInput(parseFloat(fCambio.monto_recibido)||0) : ''}
                  onChange={e=>setFCambio({...fCambio,monto_recibido:e.target.value.replace(/\./g,'')})}/>
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
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
            <div style={S.sec}>Vencimientos a pagar</div>
            <button style={{fontSize:'12px',color:C.accent,background:'rgba(245,224,0,0.08)',border:`1px solid rgba(245,224,0,0.25)`,borderRadius:'8px',cursor:'pointer',fontFamily:"'Syne',sans-serif",fontWeight:700,padding:'7px 14px'}} onClick={()=>setModal('venc')}>+ Nuevo</button>
          </div>
          <div style={{...S.card,padding:0,overflow:'hidden'}}>
            {vencimientos.map((v,i) => {
              const d = diasHasta(v.fecha)
              const col = d < 0 ? '#4a4e58' : d === 0 ? '#f87171' : d <= 3 ? '#f87171' : d <= 7 ? '#f5a623' : C.blue
              const badge = d < 0 ? 'VENCIDO' : d === 0 ? 'HOY' : d === 1 ? 'MAÑANA' : `${d} días`
              const urgente = d >= 0 && d <= 3
              return (
                <div key={i} className={urgente ? 'venc-urgente' : ''}
                  style={{padding:'16px 18px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:'12px'}}>
                  <div style={{width:'4px',alignSelf:'stretch',borderRadius:'4px',background:col,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px',color:C.text}}>{v.descripcion}</div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                      {tipoBadge(v.tipo)}
                      <span style={{fontSize:'11px',color:C.muted,fontFamily:'monospace'}}>{v.fecha.split('-').reverse().join('/')}</span>
                      <span style={{fontSize:'11px',color:C.muted}}>· {v.usuario_nombre||'sistema'}</span>
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontFamily:'DM Mono,monospace',fontSize:'15px',fontWeight:600,color:C.red,marginBottom:'5px'}}>{fmt(v.monto)}</div>
                    <span style={{fontSize:'10px',fontWeight:700,padding:'3px 8px',borderRadius:'6px',background:col+'22',color:col,fontFamily:'monospace'}}>{badge}</span>
                  </div>
                  <button style={{background:'rgba(52,211,153,0.1)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:'8px',color:C.green,cursor:'pointer',fontSize:'14px',padding:'7px 12px',fontWeight:700,flexShrink:0}} onClick={()=>abrirModalPago(v)}>✓ Pagar</button>
                </div>
              )
            })}
            {vencimientos.length === 0 && <p style={{fontSize:'13px',color:C.muted,textAlign:'center',padding:'28px'}}>Sin vencimientos pendientes</p>}
          </div>

          {/* Pagados colapsable */}
          {vencPagados.length > 0 && (
            <div style={{marginTop:'8px'}}>
              <button style={{background:'none',border:'none',color:C.muted,fontSize:'11px',fontWeight:700,cursor:'pointer',letterSpacing:'.1em',textTransform:'uppercase',padding:'8px 0',display:'flex',alignItems:'center',gap:'6px'}}
                onClick={()=>setMostrarPagados(!mostrarPagados)}>
                {mostrarPagados ? '▲' : '▼'} Pagos registrados ({vencPagados.length})
              </button>
              {mostrarPagados && (
                <div style={{...S.card,padding:0,overflow:'hidden',opacity:.7}}>
                  {vencPagados.map((v,i) => (
                    <div key={i} style={{padding:'12px 18px',borderBottom:i<vencPagados.length-1?`1px solid ${C.cardBorder}`:'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:'13px',color:C.muted}}>{v.descripcion}</div>
                        <div style={{fontSize:'10px',color:C.muted,fontFamily:'monospace'}}>{v.fecha_pago||v.fecha}</div>
                      </div>
                      <span style={{fontFamily:'monospace',fontSize:'13px',color:C.muted}}>{fmt(v.monto)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {deudas.filter(d=>d.tipo==='impago').length > 0 && (
            <>
              <div style={{...S.sec,color:'#fb923c'}}>Deudas impagas</div>
              <div style={{...S.card,padding:0,overflow:'hidden'}}>
                {deudas.filter(d=>d.tipo==='impago').map((d,i) => (
                  <div key={i} style={{padding:'16px 18px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:'12px',background:'rgba(251,146,60,0.04)'}}>
                    <div style={{width:'4px',alignSelf:'stretch',borderRadius:'4px',background:'#fb923c',flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px',color:'#fb923c'}}>⚠ {d.descripcion}</div>
                      <div style={{fontSize:'11px',color:C.muted,fontFamily:'monospace'}}>sin fecha · {d.usuario_nombre}</div>
                    </div>
                    <span style={{fontFamily:'DM Mono,monospace',fontSize:'15px',fontWeight:600,color:'#fb923c',flexShrink:0}}>{fmt(d.monto)}</span>
                    <button style={{background:'rgba(74,222,128,0.08)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:'8px',color:'#4ade80',cursor:'pointer',fontSize:'13px',padding:'7px 11px',flexShrink:0}} onClick={()=>pagarDeuda(d)}>$ Pagar</button>
                    <button style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:'8px',color:C.muted,cursor:'pointer',fontSize:'13px',padding:'7px 11px',flexShrink:0}} onClick={()=>eliminarItem('deudas',d.id,d.descripcion)}>✕</button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px',marginTop:'8px'}}>
            <div style={S.sec}>Deudas registradas</div>
            <button style={{fontSize:'12px',color:C.accent,background:'rgba(245,224,0,0.08)',border:`1px solid rgba(245,224,0,0.25)`,borderRadius:'8px',cursor:'pointer',fontFamily:"'Syne',sans-serif",fontWeight:700,padding:'7px 14px'}} onClick={()=>setModal('deuda')}>+ Nueva</button>
          </div>
          <div style={{...S.card,padding:0,overflow:'hidden'}}>
            {deudas.filter(d=>d.tipo!=='impago').map((d,i) => (
              <div key={i} style={{padding:'16px 18px',borderBottom:`1px solid ${C.cardBorder}`,display:'flex',alignItems:'center',gap:'12px'}}>
                <div style={{width:'4px',alignSelf:'stretch',borderRadius:'4px',background:C.red,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'14px',fontWeight:600,marginBottom:'4px',color:C.text}}>{d.descripcion}</div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    {tipoBadge(d.tipo)}
                    <span style={{fontSize:'11px',color:C.muted}}>{d.usuario_nombre||'sistema'}</span>
                  </div>
                </div>
                <span style={{fontFamily:'DM Mono,monospace',fontSize:'15px',fontWeight:600,color:C.red,flexShrink:0}}>{fmt(d.monto)}</span>
                <button style={{background:'rgba(74,222,128,0.08)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:'8px',color:'#4ade80',cursor:'pointer',fontSize:'13px',padding:'7px 11px',flexShrink:0}} onClick={()=>pagarDeuda(d)}>$ Pagar</button>
                <button style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:'8px',color:C.muted,cursor:'pointer',fontSize:'13px',padding:'7px 11px',flexShrink:0}} onClick={()=>eliminarItem('deudas',d.id,d.descripcion)}>✕</button>
              </div>
            ))}
            {deudas.length === 0 && <p style={{fontSize:'13px',color:C.muted,textAlign:'center',padding:'28px'}}>Sin deudas registradas</p>}
          </div>
          <div style={{...S.card,background:'rgba(248,113,113,0.06)',border:`1px solid rgba(248,113,113,0.2)`,marginTop:'4px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'14px',fontWeight:700,color:C.label}}>Total deuda registrada</span>
              <span style={{fontFamily:'DM Mono,monospace',fontSize:'18px',fontWeight:800,color:C.red}}>{fmt(totalDeudas)}</span>
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
              {l:'Ventas acumuladas', v:ventasMes, c:'#3ddc84'},
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
          <div style={{fontSize:'11px',color:C.muted,fontFamily:'monospace',marginBottom:'16px',padding:'0 2px'}}>
            ⚠ Proyección parcial — {diasConDatos} de {diasDelMes} días del mes con datos cargados. Los gastos fijos reflejan el mes completo.
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

          <div style={S.sec}>Comparación con meses anteriores</div>
          <div style={S.card}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',paddingBottom:'10px',marginBottom:'6px',borderBottom:`1px solid ${C.cardBorder}`}}>
              <span style={{fontSize:'10px',fontWeight:700,color:C.muted,textTransform:'uppercase'}}>Concepto</span>
              <span style={{fontSize:'10px',fontWeight:700,color:C.muted,textTransform:'uppercase',textAlign:'right'}}>Feb 2026</span>
              <span style={{fontSize:'10px',fontWeight:700,color:C.muted,textTransform:'uppercase',textAlign:'right'}}>Ene 2026</span>
            </div>
            {[
              {l:'Ventas', feb:49426669, ene:53733339},
              {l:'Margen bruto', feb:17223112, ene:20874994},
              {l:'Resultado neto', feb:-4149593, ene:-1114097},
            ].map((r,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',padding:'9px 0',borderBottom:i<2?`1px solid ${C.cardBorder}`:'none'}}>
                <span style={{fontSize:'12px',color:C.label}}>{r.l}</span>
                <span style={{fontFamily:'monospace',fontSize:'12px',textAlign:'right',color:r.feb<0?C.red:C.green}}>{fmt(r.feb)}</span>
                <span style={{fontFamily:'monospace',fontSize:'12px',textAlign:'right',color:r.ene<0?C.red:C.green}}>{fmt(r.ene)}</span>
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

      {/* FLUJO */}
      {tab === 'flujo' && (
        <div className="fomo-content" style={S.page}>
          <div style={S.sec}>Proyección de caja — 30 días</div>
          <div style={{...S.card,background:'rgba(96,165,250,0.06)',border:'1px solid rgba(96,165,250,0.2)',marginBottom:'16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'11px',color:C.muted,textTransform:'uppercase',fontWeight:700,letterSpacing:'.08em',marginBottom:'4px'}}>Caja de arranque</div>
                <div style={{fontFamily:'DM Mono,monospace',fontSize:'22px',fontWeight:800,color:C.blue}}>{fmt(liquidoHoy)}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:'11px',color:C.muted,marginBottom:'4px'}}>Estimado diario</div>
                <div style={{fontFamily:'monospace',fontSize:'15px',color:C.accent}}>{fmt(FLUJO_DEFAULT)}</div>
                <div style={{fontSize:'10px',color:C.muted,fontFamily:'monospace'}}>valor por defecto</div>
              </div>
            </div>
          </div>

          <div style={{background:'rgba(245,166,35,0.06)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:'12px',padding:'10px 14px',marginBottom:'14px',fontSize:'11px',color:C.muted,fontFamily:'monospace',lineHeight:1.6}}>
            ℹ Las entradas usan {fmt(FLUJO_DEFAULT)}/día como estimado. Los días pasados muestran ventas reales si fueron cargadas.
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontFamily:'DM Mono,monospace',fontSize:'12px'}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.cardBorder}`}}>
                  {['Fecha','Entradas est.','Salidas prog.','Neto del día','Acumulado'].map((h,i)=>(
                    <th key={i} style={{padding:'8px 6px',color:C.muted,fontWeight:700,fontSize:'10px',textTransform:'uppercase',textAlign:i===0?'left':'right',letterSpacing:'.06em'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tablaFlujo.map((r,i)=>{
                  const bg = r.esPasado ? 'rgba(255,255,255,0.02)' : (r.acumulado < 0 ? 'rgba(220,38,38,0.15)' : r.acumulado < 1000000 ? 'rgba(245,166,35,0.1)' : 'transparent')
                  return (
                    <tr key={i} style={{borderBottom:`1px solid ${C.cardBorder}`,background:bg,opacity:r.esPasado?0.5:1}}>
                      <td style={{padding:'9px 6px',color:C.label}}>{r.fechaLabel}</td>
                      <td style={{padding:'9px 6px',textAlign:'right',color:C.green}}>{fmt(r.entradas)}</td>
                      <td style={{padding:'9px 6px',textAlign:'right',color:r.salidas>0?C.red:C.muted,fontSize:'11px',verticalAlign:'top'}}>
                        {r.salidas > 0 ? (
                          <div>
                            <div style={{fontWeight:700}}>−{fmt(r.salidas)}</div>
                            {r.todasSalidas.slice(0,2).map((v,j)=>(
                              <div key={j} style={{fontSize:'10px',color:C.muted,marginTop:'1px',textAlign:'right'}}>{v.descripcion.length>16?v.descripcion.slice(0,16)+'…':v.descripcion}</div>
                            ))}
                            {r.gastosDelDia.slice(0,2).map((g,j)=>(
                              <div key={`g${j}`} style={{fontSize:'10px',color:'#f97316',marginTop:'1px',textAlign:'right'}}>{g.descripcion.length>16?g.descripcion.slice(0,16)+'…':g.descripcion}</div>
                            ))}
                            {(r.todasSalidas.length + r.gastosDelDia.length) > 4 && <div style={{fontSize:'10px',color:C.muted}}>+{r.todasSalidas.length+r.gastosDelDia.length-4} más</div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{padding:'9px 6px',textAlign:'right',color:r.cajaDia>=0?C.green:C.red,verticalAlign:'top'}}>{r.cajaDia>=0?'+':''}{fmt(r.cajaDia)}</td>
                      <td style={{padding:'9px 6px',textAlign:'right',fontWeight:700,color:r.acumulado<0?C.red:r.acumulado<1000000?C.accent:C.green}}>{fmt(r.acumulado)}</td>
                    </tr>
                  )
                })}
                {deudas.filter(d=>d.tipo==='impago').map((d,i)=>(
                  <tr key={`deuda-${i}`} style={{borderBottom:`1px solid rgba(251,146,60,0.2)`,background:'rgba(251,146,60,0.06)'}}>
                    <td colSpan={5} style={{padding:'9px 8px',color:'#fb923c',fontFamily:'DM Mono,monospace',fontSize:'11px',fontWeight:600}}>
                      ⚠ DEUDA PENDIENTE: {d.descripcion} — {fmt(d.monto)} (sin fecha)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{...S.card,marginTop:'16px'}}>
            <div style={{...S.row}}>
              <span style={{color:C.label,fontSize:'13px'}}>Saldo proyectado en 30 días</span>
              <span style={{fontFamily:'monospace',fontWeight:700,fontSize:'14px',color:(tablaFlujo[tablaFlujo.length-1]?.acumulado||0)>0?C.green:C.red}}>{fmt(tablaFlujo[tablaFlujo.length-1]?.acumulado||0)}</span>
            </div>
            <div style={{...S.row}}>
              <span style={{color:C.red,fontSize:'12px'}}>Días en rojo</span>
              <span style={{fontFamily:'monospace',color:C.red,fontWeight:700}}>{diasRojo}</span>
            </div>
            <div style={{...S.row,borderBottom:'none'}}>
              <span style={{color:C.accent,fontSize:'12px'}}>Días en amarillo</span>
              <span style={{fontFamily:'monospace',color:C.accent,fontWeight:700}}>{diasAmarillo}</span>
            </div>
          </div>
          <div style={{fontSize:'11px',color:C.muted,fontFamily:'monospace',marginTop:'10px',padding:'11px 14px',background:C.card,borderRadius:'12px',border:`1px solid ${C.cardBorder}`,lineHeight:2}}>
            <span style={{color:C.green}}>●</span> Verde = acumulado {'>'} $1.000.000&nbsp;&nbsp;
            <span style={{color:C.accent}}>●</span> Amarillo = acumulado entre $0 y $1.000.000&nbsp;&nbsp;
            <span style={{color:C.red}}>●</span> Rojo = acumulado negativo
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
                <input type={f.type==='number'?'text':f.type} inputMode={f.type==='number'?'numeric':undefined} style={S.inp}
                  placeholder={f.placeholder||''}
                  value={f.type==='number' ? (fVenc[f.key] ? fmtInput(parseFloat(fVenc[f.key])||0) : '') : fVenc[f.key]}
                  onChange={e=>setFVenc({...fVenc,[f.key]: f.type==='number' ? e.target.value.replace(/\./g,'') : e.target.value})}/>
              </div>
            ))}
            <div style={{marginBottom:'9px'}}>
              <label style={S.label}>Tipo</label>
              <select style={S.sel} value={fVenc.tipo} onChange={e=>setFVenc({...fVenc,tipo:e.target.value})}>
                <option value="cheque">Cheque físico</option>
                <option value="echeq">E-cheq</option>
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
                <input type={f.type==='number'?'text':f.type} inputMode={f.type==='number'?'numeric':undefined} style={S.inp}
                  placeholder={f.placeholder}
                  value={f.type==='number' ? (fDeuda[f.key] ? fmtInput(parseFloat(fDeuda[f.key])||0) : '') : fDeuda[f.key]}
                  onChange={e=>setFDeuda({...fDeuda,[f.key]: f.type==='number' ? e.target.value.replace(/\./g,'') : e.target.value})}/>
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

      {/* MODAL PAGO */}
      {modal === 'pago' && modalPago.venc && (
        <div className="fomo-modal-wrap" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}} onClick={e=>{if(e.target===e.currentTarget){setModal('');setModalPago(MP0)}}}>
          <div style={{background:C.card,borderRadius:'20px',padding:'24px 20px',width:'100%',maxWidth:'460px',border:'1px solid rgba(255,255,255,0.13)',maxHeight:'90vh',overflowY:'auto'}}>
            {/* Header */}
            <div style={{marginBottom:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <h3 style={{fontSize:'15px',fontWeight:700,color:C.text,margin:0}}>Registrar pago</h3>
                <span style={{fontSize:'11px',color:C.muted,fontFamily:'monospace',background:C.inputBg,padding:'3px 8px',borderRadius:'6px'}}>
                  {modalPago.paso === 1 ? 'Paso 1 — Tipo' : 'Paso 2 — Medio'}
                </span>
              </div>
              <p style={{fontSize:'12px',color:C.muted,marginTop:'4px',fontFamily:'monospace'}}>{modalPago.venc.descripcion} — {fmt(modalPago.venc.monto)}</p>
            </div>

            {/* PASO 1: selector tipo */}
            {modalPago.paso === 1 && !modalPago.opcion && (
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {[
                  {id:'completo',label:'Pago completo',desc:'Marcar como pagado',color:'rgba(52,211,153,0.12)',border:'rgba(52,211,153,0.3)',tc:C.green},
                  {id:'parcial',label:'Pago parcial',desc:'Pagar una parte, actualizar saldo y fecha',color:'rgba(245,166,35,0.08)',border:'rgba(245,166,35,0.3)',tc:C.accent},
                  {id:'fecha',label:'Renegocié la fecha',desc:'Solo mover la fecha, sin pago',color:'rgba(96,165,250,0.08)',border:'rgba(96,165,250,0.25)',tc:C.blue},
                  {id:'nopago',label:'No pude pagar',desc:'Redefinir con interés o pasar a deuda impaga',color:'rgba(248,113,113,0.08)',border:'rgba(248,113,113,0.25)',tc:C.red},
                ].map(op=>(
                  <button key={op.id} onClick={()=>setModalPago({...modalPago,opcion:op.id})}
                    style={{background:op.color,border:`1px solid ${op.border}`,borderRadius:'12px',padding:'14px 16px',cursor:'pointer',textAlign:'left',width:'100%'}}>
                    <div style={{fontSize:'14px',fontWeight:700,color:op.tc,marginBottom:'2px'}}>{op.label}</div>
                    <div style={{fontSize:'11px',color:C.muted}}>{op.desc}</div>
                  </button>
                ))}
                <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:C.muted,marginTop:'4px'}} onClick={()=>{setModal('');setModalPago(MP0)}}>Cancelar</button>
              </div>
            )}

            {/* PASO 1: formulario completo */}
            {modalPago.paso === 1 && modalPago.opcion === 'completo' && (
              <div>
                <div style={{marginBottom:'12px'}}>
                  <label style={S.label}>Monto pagado ($)</label>
                  <input type="text" inputMode="numeric" style={S.inp}
                    value={fmtInput(parseFloat(String(modalPago.montoInput).replace(/\./g,''))||0)}
                    onChange={e=>setModalPago({...modalPago,montoInput:e.target.value.replace(/\./g,'')})}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label}} onClick={()=>setModalPago({...modalPago,opcion:null})}>← Volver</button>
                  <button style={S.btn} onClick={()=>setModalPago({...modalPago,paso:2})}>Continuar →</button>
                </div>
              </div>
            )}

            {/* PASO 1: formulario parcial */}
            {modalPago.paso === 1 && modalPago.opcion === 'parcial' && (
              <div>
                <div style={{marginBottom:'10px'}}>
                  <label style={S.label}>Monto pagado hoy ($)</label>
                  <input type="text" inputMode="numeric" style={S.inp}
                    value={fmtInput(parseFloat(String(modalPago.montoInput).replace(/\./g,''))||0)}
                    onChange={e=>setModalPago({...modalPago,montoInput:e.target.value.replace(/\./g,'')})}/>
                </div>
                <div style={{marginBottom:'10px'}}>
                  <label style={S.label}>Saldo restante ($)</label>
                  <input type="text" inputMode="numeric" style={S.inp}
                    value={fmtInput(parseFloat(String(modalPago.nuevoMonto).replace(/\./g,''))||Math.max(0,modalPago.venc.monto-(parseFloat(String(modalPago.montoInput).replace(/\./g,''))||0)))}
                    onChange={e=>setModalPago({...modalPago,nuevoMonto:e.target.value.replace(/\./g,'')})}/>
                </div>
                <div style={{marginBottom:'12px'}}>
                  <label style={S.label}>Nueva fecha de vencimiento</label>
                  <input type="date" style={{...S.inp,fontSize:'14px'}} value={modalPago.nuevaFecha} onChange={e=>setModalPago({...modalPago,nuevaFecha:e.target.value})}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label}} onClick={()=>setModalPago({...modalPago,opcion:null})}>← Volver</button>
                  <button style={{...S.btn,background:'rgba(245,166,35,0.15)',border:'1px solid rgba(245,166,35,0.4)',color:C.accent}} onClick={()=>setModalPago({...modalPago,paso:2})}>Continuar →</button>
                </div>
              </div>
            )}

            {/* PASO 1: renegociar fecha — sin paso 2 */}
            {modalPago.paso === 1 && modalPago.opcion === 'fecha' && (
              <div>
                <div style={{marginBottom:'12px'}}>
                  <label style={S.label}>Nueva fecha de vencimiento</label>
                  <input type="date" style={{...S.inp,fontSize:'14px'}} value={modalPago.nuevaFecha} onChange={e=>setModalPago({...modalPago,nuevaFecha:e.target.value})}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label}} onClick={()=>setModalPago({...modalPago,opcion:null})}>← Volver</button>
                  <button style={{...S.btn,background:'rgba(96,165,250,0.12)',border:'1px solid rgba(96,165,250,0.3)',color:C.blue}} onClick={confirmarPago}>✓ Actualizar fecha</button>
                </div>
              </div>
            )}

            {/* PASO 1: no pude pagar — elegir sub-opción */}
            {modalPago.paso === 1 && modalPago.opcion === 'nopago' && !modalPago.subopcionD && (
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                <p style={{fontSize:'12px',color:C.muted,fontFamily:'monospace',marginBottom:'4px'}}>¿Qué querés hacer con este vencimiento?</p>
                <button onClick={()=>setModalPago({...modalPago,subopcionD:'interes'})}
                  style={{background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,0.3)',borderRadius:'12px',padding:'14px 16px',cursor:'pointer',textAlign:'left',width:'100%'}}>
                  <div style={{fontSize:'14px',fontWeight:700,color:C.accent,marginBottom:'2px'}}>Redefinir con interés</div>
                  <div style={{fontSize:'11px',color:C.muted}}>Nueva fecha + interés opcional. Actualiza el vencimiento.</div>
                </button>
                <button onClick={()=>setModalPago({...modalPago,subopcionD:'deuda'})}
                  style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.3)',borderRadius:'12px',padding:'14px 16px',cursor:'pointer',textAlign:'left',width:'100%'}}>
                  <div style={{fontSize:'14px',fontWeight:700,color:C.red,marginBottom:'2px'}}>Pasar a deuda</div>
                  <div style={{fontSize:'11px',color:C.muted}}>Elimina de vencimientos activos y lo registra como deuda impaga.</div>
                </button>
                <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label,marginTop:'4px'}} onClick={()=>setModalPago({...modalPago,opcion:null})}>← Volver</button>
              </div>
            )}

            {/* PASO 1: D1 — redefinir con interés */}
            {modalPago.paso === 1 && modalPago.opcion === 'nopago' && modalPago.subopcionD === 'interes' && (
              <div>
                <div style={{marginBottom:'10px'}}>
                  <label style={S.label}>Nueva fecha de vencimiento</label>
                  <input type="date" style={{...S.inp,fontSize:'14px'}} value={modalPago.nuevaFecha} onChange={e=>setModalPago({...modalPago,nuevaFecha:e.target.value})}/>
                </div>
                <div style={{marginBottom:'12px'}}>
                  <label style={S.label}>Interés (%) — dejar en 0 para sin interés</label>
                  <input type="text" inputMode="decimal" style={S.inp} placeholder="0"
                    value={modalPago.interesInput}
                    onChange={e=>setModalPago({...modalPago,interesInput:e.target.value.replace(/[^\d.]/g,'')})}/>
                </div>
                {parseFloat(modalPago.interesInput||0) > 0 && (
                  <div style={{background:C.inputBg,borderRadius:'8px',padding:'10px 12px',marginBottom:'12px',fontSize:'12px',fontFamily:'monospace',color:C.accent}}>
                    Nuevo monto: {fmt(Math.round(modalPago.venc.monto * (1 + parseFloat(modalPago.interesInput||0)/100)))}
                    {' '}({fmt(modalPago.venc.monto)} + {modalPago.interesInput}%)
                  </div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label}} onClick={()=>setModalPago({...modalPago,subopcionD:null})}>← Volver</button>
                  <button style={{...S.btn,background:'rgba(245,166,35,0.15)',border:'1px solid rgba(245,166,35,0.4)',color:C.accent}} onClick={confirmarPago}>✓ Actualizar</button>
                </div>
              </div>
            )}

            {/* PASO 1: D2 — pasar a deuda */}
            {modalPago.paso === 1 && modalPago.opcion === 'nopago' && modalPago.subopcionD === 'deuda' && (
              <div>
                <div style={{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:'10px',padding:'12px 14px',marginBottom:'12px',fontSize:'12px',color:C.red,fontFamily:'monospace'}}>
                  {modalPago.venc.descripcion} — {fmt(modalPago.venc.monto)}<br/>
                  <span style={{color:C.muted}}>Se eliminará de vencimientos y aparecerá como deuda impaga sin fecha.</span>
                </div>
                <div style={{marginBottom:'12px'}}>
                  <label style={S.label}>Nota (opcional)</label>
                  <input type="text" style={S.inp} placeholder="ej: no pudimos pagar este mes"
                    value={modalPago.notaInput}
                    onChange={e=>setModalPago({...modalPago,notaInput:e.target.value})}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label}} onClick={()=>setModalPago({...modalPago,subopcionD:null})}>← Volver</button>
                  <button style={{...S.btn,background:'rgba(248,113,113,0.15)',border:'1px solid rgba(248,113,113,0.4)',color:C.red}} onClick={confirmarPago}>Pasar a deuda</button>
                </div>
              </div>
            )}

            {/* PASO 2: selector medio de pago */}
            {modalPago.paso === 2 && !modalPago.medio && (
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                <p style={{fontSize:'12px',color:C.muted,fontFamily:'monospace',marginBottom:'4px'}}>¿Cómo pagás {fmt(parseFloat(String(modalPago.montoInput).replace(/\./g,''))||modalPago.venc.monto)}?</p>
                {[
                  {id:'efectivo',label:'Efectivo',desc:'Descuenta del efectivo de hoy',icon:'💵'},
                  {id:'transferencia',label:'Transferencia',desc:'Descuenta de las transferencias de hoy',icon:'📲'},
                  {id:'banco',label:'Banco',desc:'Débito directo de cuenta bancaria',icon:'🏦'},
                  {id:'cheque',label:'Cheque emitido',desc:'Sin impacto hoy — aparece en FLUJO',icon:'📝'},
                  {id:'tarjeta',label:'Tarjeta',desc:'Sin impacto hoy — cuotas en FLUJO',icon:'💳'},
                ].map(op=>(
                  <button key={op.id} onClick={()=>setModalPago({...modalPago,medio:op.id})}
                    style={{display:'flex',alignItems:'center',gap:'12px',background:C.inputBg,border:`1px solid ${C.cardBorder}`,borderRadius:'12px',padding:'13px 16px',cursor:'pointer',textAlign:'left',width:'100%'}}>
                    <span style={{fontSize:'20px'}}>{op.icon}</span>
                    <div>
                      <div style={{fontSize:'14px',fontWeight:700,color:C.text,marginBottom:'1px'}}>{op.label}</div>
                      <div style={{fontSize:'11px',color:C.muted}}>{op.desc}</div>
                    </div>
                  </button>
                ))}
                <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.1)',color:C.muted,marginTop:'4px'}} onClick={()=>setModalPago({...modalPago,paso:1,medio:null})}>← Volver</button>
              </div>
            )}

            {/* PASO 2: efectivo / transferencia / banco — confirmar */}
            {modalPago.paso === 2 && (modalPago.medio==='efectivo'||modalPago.medio==='transferencia'||modalPago.medio==='banco') && (
              <div>
                <div style={{background:C.inputBg,borderRadius:'12px',padding:'14px 16px',marginBottom:'16px'}}>
                  <div style={{fontSize:'12px',color:C.muted,marginBottom:'4px'}}>Impacto inmediato en caja</div>
                  <div style={{fontSize:'14px',fontWeight:700,color:C.red}}>
                    −{fmt(parseFloat(String(modalPago.montoInput).replace(/\./g,''))||modalPago.venc.monto)}
                    <span style={{fontWeight:400,color:C.muted,fontSize:'12px',marginLeft:'8px'}}>
                      de {modalPago.medio==='efectivo'?'Efectivo':modalPago.medio==='transferencia'?'Transferencias':'Saldo banco'}
                    </span>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label}} onClick={()=>setModalPago({...modalPago,medio:null})}>← Volver</button>
                  <button style={S.btn} onClick={confirmarPago}>✓ Confirmar pago</button>
                </div>
              </div>
            )}

            {/* PASO 2: cheque emitido */}
            {modalPago.paso === 2 && modalPago.medio === 'cheque' && (
              <div>
                <div style={{marginBottom:'14px'}}>
                  <label style={S.label}>¿Cuántos cheques?</label>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {[1,2,3].map(n=>(
                      <button key={n} onClick={()=>setModalPago({...modalPago,cheques:Array.from({length:n},()=>({monto:'',fecha:''}))})}
                        style={{padding:'8px 18px',borderRadius:'8px',border:'1px solid',fontSize:'14px',fontWeight:700,cursor:'pointer',
                          borderColor:modalPago.cheques.length===n?C.green:'rgba(255,255,255,0.15)',
                          background:modalPago.cheques.length===n?'rgba(52,211,153,0.15)':C.inputBg,
                          color:modalPago.cheques.length===n?C.green:C.label}}>
                        {n}
                      </button>
                    ))}
                    <button onClick={()=>setModalPago({...modalPago,cheques:[...modalPago.cheques,{monto:'',fecha:''}]})}
                      style={{padding:'8px 16px',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.15)',background:C.inputBg,color:C.label,fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
                      +
                    </button>
                  </div>
                </div>
                {modalPago.cheques.map((ch,j)=>(
                  <div key={j} style={{background:C.inputBg,borderRadius:'10px',padding:'12px',marginBottom:'8px'}}>
                    <div style={{fontSize:'11px',color:C.accent,fontWeight:700,marginBottom:'8px'}}>Cheque {j+1}</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                      <div>
                        <label style={{...S.label,marginBottom:'4px'}}>Monto ($)</label>
                        <input type="text" inputMode="numeric" style={{...S.inp,fontSize:'14px'}}
                          value={ch.monto?fmtInput(parseFloat(String(ch.monto).replace(/\./g,''))||0):''}
                          placeholder="0"
                          onChange={e=>{const nc=[...modalPago.cheques]; nc[j]={...nc[j],monto:e.target.value.replace(/\./g,'')}; setModalPago({...modalPago,cheques:nc})}}/>
                      </div>
                      <div>
                        <label style={{...S.label,marginBottom:'4px'}}>Fecha cobro</label>
                        <input type="date" style={{...S.inp,fontSize:'13px'}}
                          value={ch.fecha}
                          onChange={e=>{const nc=[...modalPago.cheques]; nc[j]={...nc[j],fecha:e.target.value}; setModalPago({...modalPago,cheques:nc})}}/>
                      </div>
                    </div>
                  </div>
                ))}
                {(() => {
                  const totalChq = modalPago.cheques.reduce((s,c)=>s+(parseFloat(String(c.monto).replace(/\./g,''))||0),0)
                  const esperado = parseFloat(String(modalPago.montoInput).replace(/\./g,''))||modalPago.venc.monto
                  const diff = totalChq - esperado
                  return totalChq > 0 && (
                    <div style={{fontSize:'11px',fontFamily:'monospace',padding:'8px 12px',borderRadius:'8px',marginBottom:'12px',
                      background:Math.abs(diff)<1?'rgba(52,211,153,0.1)':'rgba(245,166,35,0.1)',
                      color:Math.abs(diff)<1?C.green:C.accent}}>
                      Total cheques: {fmt(totalChq)} / Esperado: {fmt(esperado)}
                      {Math.abs(diff)>=1 && ` (diferencia: ${diff>0?'+':''}${fmt(diff)})`}
                    </div>
                  )
                })()}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label}} onClick={()=>setModalPago({...modalPago,medio:null})}>← Volver</button>
                  <button style={S.btn} onClick={confirmarPago}>✓ Emitir cheques</button>
                </div>
              </div>
            )}

            {/* PASO 2: tarjeta en cuotas */}
            {modalPago.paso === 2 && modalPago.medio === 'tarjeta' && (
              <div>
                <div style={{marginBottom:'16px'}}>
                  <label style={S.label}>Cantidad de cuotas</label>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {[1,3,6,9,12].map(n=>(
                      <button key={n} onClick={()=>setModalPago({...modalPago,cuotas:n})}
                        style={{padding:'10px 16px',borderRadius:'8px',border:'1px solid',fontSize:'14px',fontWeight:700,cursor:'pointer',flex:1,
                          borderColor:modalPago.cuotas===n?C.accent:'rgba(255,255,255,0.15)',
                          background:modalPago.cuotas===n?'rgba(245,224,0,0.12)':C.inputBg,
                          color:modalPago.cuotas===n?C.accent:C.label}}>
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const total = parseFloat(String(modalPago.montoInput).replace(/\./g,''))||modalPago.venc.monto
                  const cuota = Math.round(total / modalPago.cuotas)
                  const [hy,hm,hd] = hoyStr().split('-').map(Number)
                  return (
                    <div style={{background:C.inputBg,borderRadius:'10px',padding:'12px',marginBottom:'16px',fontSize:'12px',fontFamily:'monospace'}}>
                      {modalPago.cuotas===1 ? (
                        <div style={{color:C.green}}>Pago único — sin vencimientos futuros</div>
                      ) : (
                        <>
                          <div style={{color:C.muted,marginBottom:'6px'}}>{modalPago.cuotas} cuotas de {fmt(cuota)}</div>
                          {Array.from({length:Math.min(modalPago.cuotas,3)},(_,i)=>{
                            const fc=new Date(hy,hm-1,hd+(i+1)*30)
                            return <div key={i} style={{color:C.label,lineHeight:1.8}}>→ {fc.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'})} — {fmt(cuota)}</div>
                          })}
                          {modalPago.cuotas>3 && <div style={{color:C.muted}}>… y {modalPago.cuotas-3} cuotas más</div>}
                        </>
                      )}
                    </div>
                  )
                })()}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <button style={{...S.btn,background:'transparent',border:'1px solid rgba(255,255,255,0.13)',color:C.label}} onClick={()=>setModalPago({...modalPago,medio:null})}>← Volver</button>
                  <button style={S.btn} onClick={confirmarPago}>✓ Confirmar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {modalDetalle.open && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}} onClick={()=>setModalDetalle({tipo:'',open:false})}>
          <div style={{background:C.card,borderRadius:'16px',padding:'20px',width:'100%',maxWidth:'340px',border:'1px solid rgba(255,255,255,0.12)'}} onClick={e=>e.stopPropagation()}>
            {modalDetalle.tipo==='liquido' && <>
              <div style={{fontWeight:700,fontSize:'14px',marginBottom:'16px',fontFamily:"'Syne',sans-serif"}}>Posición de caja</div>
              {[
                {l:'Efectivo acumulado', v:acumData.efectivo, c:'#3ddc84'},
                {l:'Transferencias acumuladas', v:acumData.transferencias, c:'#3ddc84'},
                {l:'Saldo banco', v:acumData.saldoBanco, c:'#3ddc84'},
                {l:'Gastos', v:-acumData.gastos, c:C.red},
              ].map((r,i)=>(
                <div key={i} style={S.row}><span style={{color:C.label,fontSize:'13px'}}>{r.l}</span><span style={{fontFamily:'monospace',fontSize:'13px',color:r.c}}>{r.v<0?'−'+fmt(-r.v):fmt(r.v)}</span></div>
              ))}
            </>}
            {modalDetalle.tipo==='ventas' && <>
              <div style={{fontWeight:700,fontSize:'14px',marginBottom:'16px',fontFamily:"'Syne',sans-serif"}}>Ventas de hoy</div>
              {[
                {l:'Sucursal 695', v:datosHoy.ventas_695||0},
                {l:'Sucursal 642', v:datosHoy.ventas_642||0},
                {l:'San Juan', v:datosHoy.ventas_sanjuan||0},
              ].map((r,i)=>(
                <div key={i} style={S.row}><span style={{color:C.label,fontSize:'13px'}}>{r.l}</span><span style={{fontFamily:'monospace',fontSize:'13px'}}>{fmt(r.v)}</span></div>
              ))}
            </>}
            {modalDetalle.tipo==='mes' && <>
              <div style={{fontWeight:700,fontSize:'14px',marginBottom:'16px',fontFamily:"'Syne',sans-serif"}}>Ventas del mes por sucursal</div>
              {(()=>{
                const mesStr=hoyStr().slice(0,7)
                return [
                  {l:'Sucursal 695', v:(historialDias||[]).filter(r=>r.fecha?.startsWith(mesStr)).reduce((s,r)=>s+(r.ventas_695||0),0)},
                  {l:'Sucursal 642', v:(historialDias||[]).filter(r=>r.fecha?.startsWith(mesStr)).reduce((s,r)=>s+(r.ventas_642||0),0)},
                  {l:'San Juan', v:(historialDias||[]).filter(r=>r.fecha?.startsWith(mesStr)).reduce((s,r)=>s+(r.ventas_sanjuan||0),0)},
                ].map((r,i)=>(
                  <div key={i} style={S.row}><span style={{color:C.label,fontSize:'13px'}}>{r.l}</span><span style={{fontFamily:'monospace',fontSize:'13px'}}>{fmt(r.v)}</span></div>
                ))
              })()}
            </>}
            {modalDetalle.tipo==='vence7' && <>
              <div style={{fontWeight:700,fontSize:'14px',marginBottom:'16px',fontFamily:"'Syne',sans-serif"}}>Vencimientos próximos 7 días</div>
              {v7.map((v,i)=>(
                <div key={i} style={S.row}><span style={{color:C.label,fontSize:'13px'}}>{v.descripcion} <span style={{color:C.muted,fontSize:'11px'}}>{v.fecha.split('-').reverse().join('/')}</span></span><span style={{fontFamily:'monospace',fontSize:'13px',color:C.red}}>{fmt(v.monto)}</span></div>
              ))}
              {v7.length===0 && <p style={{color:C.muted,fontSize:'13px',textAlign:'center',padding:'12px 0'}}>Sin vencimientos</p>}
            </>}
            <button style={{...S.btn,marginTop:'18px'}} onClick={()=>setModalDetalle({tipo:'',open:false})}>Cerrar</button>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav className="fomo-bottom-nav" style={{position:'fixed',bottom:0,left:0,right:0,background:C.card,borderTop:`1px solid ${C.cardBorder}`,zIndex:200}}>
        {navItems.map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)}
            style={{flex:1,padding:'10px 2px 8px',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',cursor:'pointer',fontSize:'9px',fontWeight:700,letterSpacing:'.05em',color:tab===n.id?C.accent:C.muted,textTransform:'uppercase',border:'none',background:'none',fontFamily:"'Syne',sans-serif",transition:'color .15s'}}>
            <span style={{fontSize:'16px',lineHeight:1}}>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      </div>
      </div>
    </div>
  )
}
