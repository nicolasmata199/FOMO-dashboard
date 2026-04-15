'use client'
import { useState, useEffect } from 'react'
import { getSupabase } from '../../lib/supabase'

const sb = getSupabase()

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
  orange: '#e3b341',
  blue:   '#58a6ff',
}

const SUCURSALES = ['695', '642', 'sanjuan', 'redes']

const fmt = (n) =>
  '$' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const TABS = [
  { id: 'stock',     label: 'Stock actual' },
  { id: 'ingreso',   label: 'Ingreso' },
  { id: 'ajustes',   label: 'Ajustes' },
  { id: 'faltantes', label: 'Faltantes' },
]

export default function StockPage() {
  const [usuario, setUsuario]           = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [tab, setTab]                   = useState('stock')
  const [sucursal, setSucursal]         = useState('695')

  // ── Stock actual ─────────────────────────────────────────────────────────
  const [celulares, setCelulares]       = useState([])
  const [accesorios, setAccesorios]     = useState([])
  const [loadingStock, setLoadingStock] = useState(false)

  // ── Ingreso ──────────────────────────────────────────────────────────────
  const [tipoIngreso, setTipoIngreso]   = useState('accesorio')
  // celular
  const [ingImei, setIngImei]           = useState('')
  const [ingModelo, setIngModelo]       = useState('')
  const [ingMarca, setIngMarca]         = useState('')
  const [ingColor, setIngColor]         = useState('')
  const [ingCondicion, setIngCondicion] = useState('nuevo')
  const [ingCosto, setIngCosto]         = useState('')
  const [ingPrecio, setIngPrecio]       = useState('')
  const [ingBateria, setIngBateria]     = useState('')
  const [ingSuc, setIngSuc]             = useState('695')
  // accesorio — tabla bulk
  const newRow = () => ({ _id: Math.random(), nombre: '', categoria: '', costo: '', precio: '', minimo: '', q695: '', q642: '', qsj: '' })
  const [rows, setRows]                 = useState(() => Array.from({ length: 5 }, newRow))
  const [savingIng, setSavingIng]       = useState(false)
  const [ingMsg, setIngMsg]             = useState(null)
  const [pasteHint, setPasteHint]       = useState(false)
  // catálogo para autocompletado
  const [catalogo, setCatalogo]         = useState([]) // [{nombre, categoria, costo_ars, precio_lista_ars, stock_minimo}]
  const [suggestions, setSuggestions]   = useState({}) // _id → [matches]
  const [openSug, setOpenSug]           = useState(null) // _id con dropdown abierto

  // ── Ajustes ──────────────────────────────────────────────────────────────
  const [ajSucursal, setAjSucursal]     = useState('695')
  const [ajAccesorios, setAjAccesorios] = useState([])
  const [ajDelta, setAjDelta]           = useState({}) // id → delta numérico
  const [ajMotivo, setAjMotivo]         = useState('')
  const [loadingAj, setLoadingAj]       = useState(false)
  const [savingAj, setSavingAj]         = useState(false)
  const [ajMsg, setAjMsg]               = useState(null)
  const [movimientos, setMovimientos]   = useState([])

  // ── Faltantes ────────────────────────────────────────────────────────────
  const [faltSuc, setFaltSuc]           = useState('695')
  const [faltCels, setFaltCels]         = useState([])
  const [faltAccs, setFaltAccs]         = useState([])
  const [conteo, setConteo]             = useState({})
  const [loadingFalt, setLoadingFalt]   = useState(false)
  const [savingFalt, setSavingFalt]     = useState(false)
  const [faltMsg, setFaltMsg]           = useState(null)
  const [historial, setHistorial]       = useState([])

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/pos/login'; return }
      sb.from('usuarios_fomo').select('*').eq('id', session.user.id).single()
        .then(({ data }) => {
          if (!data || data.rol === 'vendedora') { window.location.href = '/pos'; return }
          setUsuario(data)
          setCheckingAuth(false)
        })
    })
  }, [])

  useEffect(() => {
    if (!checkingAuth) cargarStock(sucursal)
  }, [sucursal, checkingAuth])

  // cargar catálogo de accesorios para autocompletado
  useEffect(() => {
    if (tab === 'ingreso' && tipoIngreso === 'accesorio') {
      sb.from('accesorios').select('nombre,categoria,costo_ars,precio_lista_ars,stock_minimo').eq('activo', true).order('nombre')
        .then(({ data }) => {
          if (!data) return
          // deduplicar por nombre (quedarse con el primero)
          const seen = new Set()
          const unique = data.filter(a => { if (seen.has(a.nombre)) return false; seen.add(a.nombre); return true })
          setCatalogo(unique)
        })
    }
  }, [tab, tipoIngreso])

  // ── Cargar stock ──────────────────────────────────────────────────────────
  async function cargarStock(suc) {
    setLoadingStock(true)
    const [{ data: cels }, { data: accs }] = await Promise.all([
      sb.from('existencias').select('*').eq('sucursal', suc).eq('estado_stock', 'disponible').order('fecha_ingreso', { ascending: false }),
      sb.from('accesorios').select('*').eq('sucursal', suc).eq('activo', true).order('nombre'),
    ])
    setCelulares(cels || [])
    setAccesorios(accs || [])
    setLoadingStock(false)
  }

  // ── Cargar ajustes ────────────────────────────────────────────────────────
  async function cargarAjustes(suc) {
    setLoadingAj(true)
    const [{ data: accs }, { data: movs }] = await Promise.all([
      sb.from('accesorios').select('*').eq('sucursal', suc).eq('activo', true).order('nombre'),
      sb.from('movimientos_stock').select('*').eq('sucursal', suc).eq('tipo', 'ajuste').order('fecha', { ascending: false }).limit(20),
    ])
    setAjAccesorios(accs || [])
    setAjDelta({})
    setMovimientos(movs || [])
    setLoadingAj(false)
  }

  // ── Cargar faltantes ──────────────────────────────────────────────────────
  async function cargarFaltantes(suc) {
    setLoadingFalt(true)
    const [{ data: cels }, { data: accs }, { data: hist }] = await Promise.all([
      sb.from('existencias').select('imei,modelo,marca,color').eq('sucursal', suc).eq('estado_stock', 'disponible'),
      sb.from('accesorios').select('id,nombre,categoria,stock_actual,stock_minimo').eq('sucursal', suc).eq('activo', true),
      sb.from('control_faltantes').select('*').eq('sucursal', suc).order('fecha', { ascending: false }).limit(10),
    ])
    setFaltCels(cels || [])
    setFaltAccs(accs || [])
    setHistorial(hist || [])
    const init = {}
    ;(cels || []).forEach(c => { init[c.imei] = '1' })
    ;(accs || []).forEach(a => { init[a.id] = String(a.stock_actual || 0) })
    setConteo(init)
    setLoadingFalt(false)
  }

  // ── Guardar ingreso celular ────────────────────────────────────────────────
  async function guardarCelular() {
    if (!ingImei || !ingModelo) return
    setSavingIng(true); setIngMsg(null)
    const { error } = await sb.from('existencias').insert({
      imei: ingImei.trim(),
      modelo: ingModelo.trim(),
      marca: ingMarca.trim() || null,
      color: ingColor.trim() || null,
      estado_equipo: ingCondicion,
      estado_stock: 'disponible',
      costo_ars: ingCosto ? parseFloat(ingCosto) : null,
      precio_venta_ars: ingPrecio ? parseFloat(ingPrecio) : null,
      bateria_pct: ingBateria ? parseInt(ingBateria) : null,
      sucursal: ingSuc,
      fecha_ingreso: new Date().toISOString().split('T')[0],
    })
    if (!error) {
      await sb.from('movimientos_stock').insert({
        tipo: 'ingreso', producto_tipo: 'celular',
        producto_descripcion: `${ingMarca} ${ingModelo}`.trim(),
        imei: ingImei.trim(), sucursal: ingSuc,
        cantidad_antes: 0, cantidad_despues: 1, diferencia: 1,
        motivo: 'Ingreso de mercadería',
        usuario_id: usuario.id, usuario_nombre: usuario.nombre,
      })
    }
    setSavingIng(false)
    if (error) { setIngMsg({ ok: false, text: 'Error: ' + error.message }); return }
    setIngMsg({ ok: true, text: `✓ ${ingModelo} ingresado en sucursal ${ingSuc.toUpperCase()}` })
    setIngImei(''); setIngModelo(''); setIngMarca(''); setIngColor('')
    setIngCosto(''); setIngPrecio(''); setIngBateria(''); setIngCondicion('nuevo')
    if (ingSuc === sucursal) cargarStock(sucursal)
  }

  // ── Paste desde Excel ─────────────────────────────────────────────────────
  function handlePaste(e) {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\t')) return
    e.preventDefault()
    const lines = text.trim().split('\n').filter(l => l.trim())
    const parsed = lines.map(line => {
      const c = line.split('\t')
      return {
        _id: Math.random(),
        nombre:    c[0]?.trim() || '',
        categoria: c[1]?.trim() || '',
        costo:     c[2]?.trim().replace(/[$.]/g, '').replace(',', '.') || '',
        precio:    c[3]?.trim().replace(/[$.]/g, '').replace(',', '.') || '',
        minimo:    c[4]?.trim() || '',
        q695:      c[5]?.trim() || '',
        q642:      c[6]?.trim() || '',
        qsj:       c[7]?.trim() || '',
      }
    })
    // rellenar hasta mínimo 3 filas vacías al final
    const extras = Array.from({ length: 3 }, newRow)
    setRows([...parsed, ...extras])
    setPasteHint(false)
  }

  function updateRow(id, field, val) {
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: val } : r))
    // si es el campo nombre, filtrar sugerencias
    if (field === 'nombre') {
      if (val.trim().length < 2) { setSuggestions(p => ({ ...p, [id]: [] })); setOpenSug(null); return }
      const q = val.toLowerCase()
      const matches = catalogo.filter(a => a.nombre.toLowerCase().includes(q)).slice(0, 6)
      setSuggestions(p => ({ ...p, [id]: matches }))
      setOpenSug(matches.length > 0 ? id : null)
    }
  }

  function selectSuggestion(rowId, item) {
    setRows(prev => prev.map(r => {
      if (r._id !== rowId) return r
      const costoSistema = item.costo_ars ? String(item.costo_ars) : ''
      const precioSistema = item.precio_lista_ars ? String(item.precio_lista_ars) : ''
      return {
        ...r,
        nombre:        item.nombre,
        categoria:     item.categoria || r.categoria,
        costo:         costoSistema,
        precio:        precioSistema,
        minimo:        item.stock_minimo != null ? String(item.stock_minimo) : r.minimo,
        // guardar valores del sistema para detectar cambios
        _costoSistema: costoSistema,
        _precioSistema: precioSistema,
        _updateCosto:  false,
        _updatePrecio: false,
      }
    }))
    setSuggestions(p => ({ ...p, [rowId]: [] }))
    setOpenSug(null)
  }

  function addRows(n = 5) {
    setRows(prev => [...prev, ...Array.from({ length: n }, newRow)])
  }

  function removeRow(id) {
    setRows(prev => prev.filter(r => r._id !== id))
  }

  // ── Guardar ingreso accesorios bulk ───────────────────────────────────────
  async function guardarAccesorios() {
    const validas = rows.filter(r => r.nombre.trim() && (parseInt(r.q695)||0) + (parseInt(r.q642)||0) + (parseInt(r.qsj)||0) > 0)
    if (validas.length === 0) return
    setSavingIng(true); setIngMsg(null)

    let ok = 0, errores = 0
    for (const row of validas) {
      const byQty = { '695': parseInt(row.q695)||0, '642': parseInt(row.q642)||0, 'sanjuan': parseInt(row.qsj)||0 }
      for (const [suc, qty] of Object.entries(byQty)) {
        if (qty <= 0) continue
        const { data: existente } = await sb.from('accesorios')
          .select('*').eq('nombre', row.nombre.trim()).eq('sucursal', suc).eq('activo', true).maybeSingle()

        let error, antes = 0, despues = qty
        if (existente) {
          antes = existente.stock_actual || 0
          despues = antes + qty
          const updates = { stock_actual: despues }
          if (row._updateCosto && row.costo)   updates.costo_ars = parseFloat(row.costo)
          if (row._updatePrecio && row.precio)  updates.precio_lista_ars = parseFloat(row.precio)
          const { error: e } = await sb.from('accesorios').update(updates).eq('id', existente.id)
          error = e
        } else {
          const { error: e } = await sb.from('accesorios').insert({
            nombre: row.nombre.trim(),
            categoria: row.categoria.trim() || null,
            stock_actual: qty,
            stock_minimo: row.minimo ? parseInt(row.minimo) : 0,
            costo_ars: row.costo ? parseFloat(row.costo) : null,
            precio_lista_ars: row.precio ? parseFloat(row.precio) : null,
            sucursal: suc, activo: true,
          })
          error = e
        }
        if (!error) {
          await sb.from('movimientos_stock').insert({
            tipo: 'ingreso', producto_tipo: 'accesorio',
            producto_descripcion: row.nombre.trim(),
            sucursal: suc, cantidad_antes: antes, cantidad_despues: despues, diferencia: qty,
            motivo: 'Ingreso de mercadería',
            usuario_id: usuario.id, usuario_nombre: usuario.nombre,
          })
          ok++
        } else { errores++ }
      }
    }

    setSavingIng(false)
    if (errores > 0) {
      setIngMsg({ ok: false, text: `${ok} guardados, ${errores} con error` })
    } else {
      setIngMsg({ ok: true, text: `✓ ${validas.length} producto(s) ingresado(s) correctamente` })
      setRows(Array.from({ length: 5 }, newRow))
    }
    cargarStock(sucursal)
  }

  // ── Guardar ajuste ────────────────────────────────────────────────────────
  async function guardarAjuste() {
    const cambios = ajAccesorios.filter(a => ajDelta[a.id] && ajDelta[a.id] !== 0)
    if (cambios.length === 0 || !ajMotivo.trim()) return
    setSavingAj(true); setAjMsg(null)

    for (const acc of cambios) {
      const delta = ajDelta[acc.id]
      const { data: row } = await sb.from('accesorios').select('*').eq('id', acc.id).single()
      if (!row) continue
      const antes = row.stock_actual || 0
      const despues = Math.max(0, antes + delta)
      await sb.from('accesorios').update({ stock_actual: despues }).eq('id', acc.id)
      await sb.from('movimientos_stock').insert({
        tipo: 'ajuste', producto_tipo: 'accesorio',
        producto_descripcion: acc.nombre,
        accesorio_id: acc.id, sucursal: ajSucursal,
        cantidad_antes: antes, cantidad_despues: despues, diferencia: delta,
        motivo: ajMotivo.trim(),
        usuario_id: usuario.id, usuario_nombre: usuario.nombre,
      })
    }

    setSavingAj(false)
    setAjMsg({ ok: true, text: `✓ ${cambios.length} ajuste(s) guardado(s)` })
    setAjMotivo('')
    cargarAjustes(ajSucursal)
  }

  // ── Guardar control de faltantes ──────────────────────────────────────────
  async function guardarFaltantes() {
    setSavingFalt(true); setFaltMsg(null)
    const diferencias = []
    faltCels.forEach(c => {
      if (conteo[c.imei] === '0')
        diferencias.push({ tipo: 'celular', descripcion: `${c.marca || ''} ${c.modelo}`.trim(), imei: c.imei, sistema: 1, fisico: 0, diferencia: -1 })
    })
    faltAccs.forEach(a => {
      const sistema = a.stock_actual || 0
      const fisico = parseInt(conteo[a.id] ?? String(sistema))
      if (fisico !== sistema)
        diferencias.push({ tipo: 'accesorio', descripcion: a.nombre, accesorio_id: a.id, sistema, fisico, diferencia: fisico - sistema })
    })
    const { error } = await sb.from('control_faltantes').insert({
      sucursal: faltSuc,
      fecha: new Date().toISOString().split('T')[0],
      usuario_id: usuario.id, usuario_nombre: usuario.nombre,
      total_celulares_sistema: faltCels.length,
      total_accesorios_sistema: faltAccs.reduce((s, a) => s + (a.stock_actual || 0), 0),
      diferencias, hay_faltantes: diferencias.length > 0,
    })
    setSavingFalt(false)
    if (error) { setFaltMsg({ ok: false, text: 'Error: ' + error.message }); return }
    setFaltMsg({ ok: diferencias.length === 0, text: diferencias.length === 0 ? '✓ Sin faltantes — control guardado' : `⚠ ${diferencias.length} diferencia(s) detectada(s)` })
    cargarFaltantes(faltSuc)
  }

  if (checkingAuth) return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: C.text2, fontSize: 14 }}>Verificando acceso...</div>
    </div>
  )

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'DM Mono', monospace" }}>

      {/* Header */}
      <div style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: C.accent }}>
          FOMO OS <span style={{ fontSize: 13, fontWeight: 400, color: C.text2 }}>/ Stock</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 12, color: C.text2 }}>{usuario?.nombre}</div>
          <a href="/pos" style={{ fontSize: 12, color: C.blue, textDecoration: 'none' }}>← POS</a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bg2, padding: '0 20px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => {
            setTab(t.id)
            if (t.id === 'faltantes') cargarFaltantes(faltSuc)
            if (t.id === 'ajustes') cargarAjustes(ajSucursal)
          }} style={{
            background: 'none', border: 'none', color: tab === t.id ? C.accent : C.text2,
            borderBottom: tab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
            padding: '14px 20px', cursor: 'pointer', fontSize: 15, fontWeight: tab === t.id ? 700 : 400,
            fontFamily: "'Syne', sans-serif", whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>

        {/* ══ STOCK ACTUAL ══════════════════════════════════════════════════ */}
        {tab === 'stock' && (
          <div>
            <SucursalSelector value={sucursal} onChange={setSucursal} />
            {loadingStock ? <Loading /> : (
              <>
                <SeccionLabel text={`CELULARES DISPONIBLES — ${celulares.length} unidades`} />
                {celulares.length === 0
                  ? <Empty text="Sin celulares en stock" />
                  : celulares.map(c => (
                    <Card key={c.imei} style={{ marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{c.modelo}</div>
                        <div style={{ fontSize: 13, color: C.text2, marginTop: 2 }}>
                          IMEI: {c.imei}{c.color ? ` · ${c.color}` : ''}{c.estado_equipo !== 'nuevo' ? ` · ${c.estado_equipo}` : ''}{c.bateria_pct ? ` · 🔋${c.bateria_pct}%` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{fmt(c.precio_venta_ars)}</div>
                        {c.costo_ars && <div style={{ fontSize: 12, color: C.text2 }}>Costo: {fmt(c.costo_ars)}</div>}
                      </div>
                    </Card>
                  ))
                }

                <div style={{ marginTop: 24 }} />
                <SeccionLabel text="ACCESORIOS" />
                {accesorios.length === 0
                  ? <Empty text="Sin accesorios en stock" />
                  : accesorios.map(a => {
                    const stock = a.stock_actual || 0
                    const negativo = stock < 0
                    const bajo = !negativo && stock <= (a.stock_minimo || 0)
                    const borderColor = negativo ? C.red : bajo ? C.orange : C.border
                    const stockColor = negativo ? C.red : bajo ? C.orange : C.green
                    return (
                      <Card key={a.id} style={{ marginBottom: 6, borderColor }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{a.nombre}</div>
                          <div style={{ fontSize: 13, color: C.text2, marginTop: 2 }}>
                            {a.categoria || ''}
                            {negativo && <span style={{ color: C.red, marginLeft: 8 }}>⚠ stock negativo — cargar mercaderia</span>}
                            {bajo && !negativo && <span style={{ color: C.orange, marginLeft: 8 }}>⚠ stock bajo</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: stockColor }}>{stock}</div>
                          <div style={{ fontSize: 12, color: C.text2 }}>min: {a.stock_minimo || 0}</div>
                        </div>
                      </Card>
                    )
                  })
                }
              </>
            )}
          </div>
        )}

        {/* ══ INGRESO ═══════════════════════════════════════════════════════ */}
        {tab === 'ingreso' && (
          <div style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {['accesorio', 'celular'].map(t => (
                <button key={t} onClick={() => { setTipoIngreso(t); setIngMsg(null) }} style={{
                  background: tipoIngreso === t ? C.accent : C.bg3,
                  color: tipoIngreso === t ? '#000' : C.text2,
                  border: `1px solid ${tipoIngreso === t ? C.accent : C.border}`,
                  borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif",
                }}>{t === 'celular' ? '📱 Celular' : '🎧 Accesorio'}</button>
              ))}
            </div>

            {tipoIngreso === 'accesorio' ? (
              <div onPaste={handlePaste}>
                {/* Instrucciones paste */}
                <div style={{ marginBottom: 14, padding: '10px 14px', background: C.bg3, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, color: C.text2, lineHeight: 1.6 }}>
                  <strong style={{ color: C.text }}>Dos formas de cargar:</strong><br />
                  <span style={{ color: C.accent }}>1. Tipear directo</span> en la tabla de abajo.<br />
                  <span style={{ color: C.accent }}>2. Pegar desde Excel</span> — copiá el rango y pegá acá (Ctrl+V). Orden de columnas: <code style={{ background: C.bg4, padding: '1px 5px', borderRadius: 4 }}>Nombre | Categoría | Costo | Precio | Mín | 695 | 642 | SJ</code>
                </div>

                {/* Tabla */}
                <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.bg4 }}>
                        {['Nombre *', 'Categoría', 'Costo', 'Precio venta', 'Mín', '695', '642', 'SJ', ''].map((h, i) => (
                          <th key={i} style={{ padding: '7px 6px', color: C.text2, fontWeight: 600, textAlign: i >= 5 && i <= 7 ? 'center' : 'left', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row._id} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '3px 4px', minWidth: 180, position: 'relative' }}>
                            <input
                              value={row.nombre}
                              onChange={e => updateRow(row._id, 'nombre', e.target.value)}
                              onBlur={() => setTimeout(() => { setOpenSug(null) }, 150)}
                              placeholder="Nombre del producto"
                              style={{ ...cellInp, borderColor: openSug === row._id ? C.blue : 'transparent' }}
                            />
                            {openSug === row._id && (suggestions[row._id] || []).length > 0 && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: C.bg4, border: `1px solid ${C.blue}`, borderRadius: 7, minWidth: 220, boxShadow: '0 4px 16px rgba(0,0,0,.5)', overflow: 'hidden' }}>
                                <div style={{ fontSize: 10, color: C.text2, padding: '5px 10px', borderBottom: `1px solid ${C.border}` }}>Productos existentes — seleccioná para autocompletar</div>
                                {(suggestions[row._id] || []).map((item, i) => (
                                  <div key={i} onMouseDown={() => selectSuggestion(row._id, item)} style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12, color: C.text, borderBottom: `1px solid ${C.border}` }}
                                    onMouseEnter={e => e.currentTarget.style.background = C.bg3}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <div style={{ fontWeight: 700 }}>{item.nombre}</div>
                                    <div style={{ fontSize: 10, color: C.text2 }}>{item.categoria || ''}{item.precio_lista_ars ? ` · ${fmt(item.precio_lista_ars)}` : ''}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '3px 4px', minWidth: 90 }}>
                            <input value={row.categoria} onChange={e => updateRow(row._id, 'categoria', e.target.value)} placeholder="vidrio..." style={cellInp} />
                          </td>
                          <td style={{ padding: '3px 4px', minWidth: 90 }}>
                            <input value={row.costo} onChange={e => updateRow(row._id, 'costo', e.target.value)} placeholder="900" type="number" style={{ ...cellInp, textAlign: 'right' }} />
                            {row._costoSistema && row.costo !== row._costoSistema && (
                              <div style={{ fontSize: 10, lineHeight: 1.3, marginTop: 2, padding: '3px 5px', background: 'rgba(227,179,65,.12)', border: '1px solid rgba(227,179,65,.3)', borderRadius: 4 }}>
                                <span style={{ color: C.orange }}>Antes: {fmt(row._costoSistema)}</span>
                                <button onMouseDown={() => updateRow(row._id, '_updateCosto', !row._updateCosto)} style={{ marginLeft: 5, background: row._updateCosto ? C.orange : C.bg4, color: row._updateCosto ? '#000' : C.text2, border: 'none', borderRadius: 3, padding: '1px 5px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                                  {row._updateCosto ? 'ACTUALIZAR ✓' : 'NO ACTUALIZAR'}
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '3px 4px', minWidth: 90 }}>
                            <input value={row.precio} onChange={e => updateRow(row._id, 'precio', e.target.value)} placeholder="3500" type="number" style={{ ...cellInp, textAlign: 'right' }} />
                            {row._precioSistema && row.precio !== row._precioSistema && (
                              <div style={{ fontSize: 10, lineHeight: 1.3, marginTop: 2, padding: '3px 5px', background: 'rgba(227,179,65,.12)', border: '1px solid rgba(227,179,65,.3)', borderRadius: 4 }}>
                                <span style={{ color: C.orange }}>Antes: {fmt(row._precioSistema)}</span>
                                <button onMouseDown={() => updateRow(row._id, '_updatePrecio', !row._updatePrecio)} style={{ marginLeft: 5, background: row._updatePrecio ? C.orange : C.bg4, color: row._updatePrecio ? '#000' : C.text2, border: 'none', borderRadius: 3, padding: '1px 5px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                                  {row._updatePrecio ? 'ACTUALIZAR ✓' : 'NO ACTUALIZAR'}
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '3px 4px', minWidth: 50 }}>
                            <input value={row.minimo} onChange={e => updateRow(row._id, 'minimo', e.target.value)} placeholder="3" type="number" style={{ ...cellInp, textAlign: 'center' }} />
                          </td>
                          {[['q695','695'],['q642','642'],['qsj','SJ']].map(([field, label]) => (
                            <td key={field} style={{ padding: '3px 4px', minWidth: 52 }}>
                              <input value={row[field]} onChange={e => updateRow(row._id, field, e.target.value)} placeholder="0" type="number" min="0"
                                style={{ ...cellInp, textAlign: 'center', fontWeight: 700, color: parseInt(row[field]) > 0 ? C.accent : C.text2 }} />
                            </td>
                          ))}
                          <td style={{ padding: '3px 4px' }}>
                            <button onClick={() => removeRow(row._id)} style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button onClick={() => addRows(5)} style={{ background: C.bg3, border: `1px solid ${C.border}`, color: C.text2, borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>+ 5 filas</button>
                  <button onClick={() => setRows(Array.from({ length: 5 }, newRow))} style={{ background: C.bg3, border: `1px solid ${C.border}`, color: C.red, borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>Limpiar</button>
                  <div style={{ fontSize: 11, color: C.text2, display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                    {rows.filter(r => r.nombre.trim()).length} productos listos
                  </div>
                </div>

                {ingMsg && <Msg msg={ingMsg} />}
                <button onClick={guardarAccesorios} disabled={savingIng || rows.every(r => !r.nombre.trim())} style={btn(savingIng || rows.every(r => !r.nombre.trim()))}>
                  {savingIng ? 'Guardando...' : `Guardar ${rows.filter(r => r.nombre.trim() && (parseInt(r.q695)||0)+(parseInt(r.q642)||0)+(parseInt(r.qsj)||0)>0).length} producto(s)`}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="SUCURSAL">
                  <select value={ingSuc} onChange={e => setIngSuc(e.target.value)} style={inp}>
                    {SUCURSALES.map(s => <option key={s} value={s}>Sucursal {s.toUpperCase()}</option>)}
                  </select>
                </Field>
                <Field label="IMEI *"><input value={ingImei} onChange={e => setIngImei(e.target.value)} placeholder="123456789012345" style={inp} /></Field>
                <Field label="MODELO *"><input value={ingModelo} onChange={e => setIngModelo(e.target.value)} placeholder="iPhone 15 128GB" style={inp} /></Field>
                <Field label="MARCA"><input value={ingMarca} onChange={e => setIngMarca(e.target.value)} placeholder="Apple / Samsung..." style={inp} /></Field>
                <Field label="COLOR"><input value={ingColor} onChange={e => setIngColor(e.target.value)} placeholder="Negro / Blanco..." style={inp} /></Field>
                <Field label="CONDICIÓN">
                  <select value={ingCondicion} onChange={e => setIngCondicion(e.target.value)} style={inp}>
                    <option value="nuevo">Nuevo</option>
                    <option value="usado_premium">Usado Premium</option>
                  </select>
                </Field>
                {ingCondicion !== 'nuevo' && (
                  <Field label="BATERÍA %"><input value={ingBateria} onChange={e => setIngBateria(e.target.value)} placeholder="85" type="number" min="0" max="100" style={inp} /></Field>
                )}
                <Field label="COSTO (ARS)"><input value={ingCosto} onChange={e => setIngCosto(e.target.value)} placeholder="800000" type="number" style={inp} /></Field>
                <Field label="PRECIO VENTA (ARS)"><input value={ingPrecio} onChange={e => setIngPrecio(e.target.value)} placeholder="1000000" type="number" style={inp} /></Field>
                {ingMsg && <Msg msg={ingMsg} />}
                <button onClick={guardarCelular} disabled={savingIng || !ingImei || !ingModelo} style={btn(savingIng || !ingImei || !ingModelo)}>
                  {savingIng ? 'Guardando...' : 'Ingresar celular'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ AJUSTES ═══════════════════════════════════════════════════════ */}
        {tab === 'ajustes' && (
          <div>
            <SucursalSelector value={ajSucursal} onChange={s => { setAjSucursal(s); cargarAjustes(s) }} />
            {loadingAj ? <Loading /> : (
              <>
                <div style={{ fontSize: 12, color: C.text2, marginBottom: 16, padding: '10px 14px', background: C.bg3, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  Usá <strong style={{ color: C.green }}>+</strong> y <strong style={{ color: C.red }}>−</strong> para ajustar la cantidad real. Cada cambio queda registrado con motivo.
                </div>

                {ajAccesorios.length === 0
                  ? <Empty text="Sin accesorios en esta sucursal" />
                  : ajAccesorios.map(a => {
                    const delta = ajDelta[a.id] || 0
                    const nuevo = Math.max(0, (a.stock_actual || 0) + delta)
                    const hayDelta = delta !== 0
                    return (
                      <Card key={a.id} style={{ marginBottom: 6, borderColor: hayDelta ? C.blue : C.border }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{a.nombre}</div>
                          <div style={{ fontSize: 13, color: C.text2, marginTop: 2 }}>
                            Stock actual: {a.stock_actual}
                            {hayDelta && (
                              <span style={{ marginLeft: 8, color: delta > 0 ? C.green : C.red }}>
                                → {nuevo} ({delta > 0 ? '+' : ''}{delta})
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <SmBtn onClick={() => setAjDelta(p => ({ ...p, [a.id]: (p[a.id] || 0) - 1 }))}>−</SmBtn>
                          <span style={{ fontSize: 16, fontWeight: 800, color: hayDelta ? C.blue : C.text, minWidth: 36, textAlign: 'center' }}>{nuevo}</span>
                          <SmBtn onClick={() => setAjDelta(p => ({ ...p, [a.id]: (p[a.id] || 0) + 1 }))}>+</SmBtn>
                        </div>
                      </Card>
                    )
                  })
                }

                {ajAccesorios.length > 0 && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Field label="MOTIVO DEL AJUSTE *">
                      <input value={ajMotivo} onChange={e => setAjMotivo(e.target.value)}
                        placeholder="Ej: corrección de inventario, devolución de cliente..."
                        style={inp} />
                    </Field>
                    {ajMsg && <Msg msg={ajMsg} />}
                    <button
                      onClick={guardarAjuste}
                      disabled={savingAj || !ajMotivo.trim() || ajAccesorios.every(a => !ajDelta[a.id] || ajDelta[a.id] === 0)}
                      style={btn(savingAj || !ajMotivo.trim() || ajAccesorios.every(a => !ajDelta[a.id] || ajDelta[a.id] === 0))}>
                      {savingAj ? 'Guardando...' : 'Guardar ajustes'}
                    </button>
                  </div>
                )}

                {/* Historial de movimientos */}
                {movimientos.length > 0 && (
                  <div style={{ marginTop: 32 }}>
                    <SeccionLabel text="ÚLTIMOS AJUSTES REGISTRADOS" />
                    {movimientos.map(m => (
                      <Card key={m.id} style={{ marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{m.producto_descripcion}</div>
                          <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>
                            {m.cantidad_antes} → {m.cantidad_despues} · por {m.usuario_nombre}
                          </div>
                          <div style={{ fontSize: 11, color: C.text2 }}>{m.motivo}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: m.diferencia > 0 ? C.green : C.red }}>
                            {m.diferencia > 0 ? '+' : ''}{m.diferencia}
                          </div>
                          <div style={{ fontSize: 10, color: C.text2 }}>
                            {new Date(m.fecha).toLocaleDateString('es-AR')}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ FALTANTES ═════════════════════════════════════════════════════ */}
        {tab === 'faltantes' && (
          <div>
            <SucursalSelector value={faltSuc} onChange={s => { setFaltSuc(s); cargarFaltantes(s) }} />
            {loadingFalt ? <Loading /> : (
              <>
                <div style={{ fontSize: 12, color: C.text2, marginBottom: 16, padding: '10px 14px', background: C.bg3, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  Marcá <strong style={{ color: C.red }}>NO</strong> si un celular no está físicamente. Ajustá la cantidad real de accesorios. Al guardar queda registrado con fecha y responsable.
                </div>

                {faltCels.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <SeccionLabel text={`CELULARES — ${faltCels.length} en sistema`} />
                    {faltCels.map(c => {
                      const falta = conteo[c.imei] === '0'
                      return (
                        <Card key={c.imei} style={{ marginBottom: 6, borderColor: falta ? C.red : C.border }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: falta ? C.red : C.text }}>{c.marca} {c.modelo}</div>
                            <div style={{ fontSize: 11, color: C.text2 }}>IMEI: {c.imei}{c.color ? ` · ${c.color}` : ''}</div>
                          </div>
                          <button onClick={() => setConteo(p => ({ ...p, [c.imei]: p[c.imei] === '1' ? '0' : '1' }))} style={{
                            background: falta ? C.red : C.green, color: '#fff', border: 'none',
                            borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          }}>{falta ? 'NO ESTÁ' : 'ESTÁ ✓'}</button>
                        </Card>
                      )
                    })}
                  </div>
                )}

                {faltAccs.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <SeccionLabel text="ACCESORIOS" />
                    {faltAccs.map(a => {
                      const fisico = parseInt(conteo[a.id] ?? String(a.stock_actual || 0))
                      const diff = fisico - (a.stock_actual || 0)
                      return (
                        <Card key={a.id} style={{ marginBottom: 6, borderColor: diff !== 0 ? C.red : C.border }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{a.nombre}</div>
                            <div style={{ fontSize: 13, color: C.text2 }}>
                              Sistema: {a.stock_actual}
                              {diff !== 0 && <span style={{ color: diff < 0 ? C.red : C.green, marginLeft: 8 }}>{diff > 0 ? '+' : ''}{diff}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <SmBtn onClick={() => setConteo(p => ({ ...p, [a.id]: String(Math.max(0, (parseInt(p[a.id] ?? a.stock_actual) || 0) - 1)) }))}>−</SmBtn>
                            <span style={{ fontSize: 18, fontWeight: 800, color: diff !== 0 ? C.red : C.text, minWidth: 32, textAlign: 'center' }}>{fisico}</span>
                            <SmBtn onClick={() => setConteo(p => ({ ...p, [a.id]: String((parseInt(p[a.id] ?? a.stock_actual) || 0) + 1) }))}>+</SmBtn>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}

                {faltCels.length === 0 && faltAccs.length === 0 && <Empty text="Sin stock para controlar en esta sucursal" />}

                {(faltCels.length > 0 || faltAccs.length > 0) && (
                  <>
                    {faltMsg && <Msg msg={faltMsg} />}
                    <button onClick={guardarFaltantes} disabled={savingFalt} style={{ ...btn(savingFalt), marginTop: 8 }}>
                      {savingFalt ? 'Guardando...' : 'Guardar control'}
                    </button>
                  </>
                )}

                {historial.length > 0 && (
                  <div style={{ marginTop: 32 }}>
                    <SeccionLabel text="HISTORIAL DE CONTROLES" />
                    {historial.map(h => (
                      <Card key={h.id} style={{ marginBottom: 6, borderColor: h.hay_faltantes ? C.red : C.border }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: h.hay_faltantes ? C.red : C.green }}>
                            {h.hay_faltantes ? `⚠ ${(h.diferencias || []).length} diferencia(s)` : '✓ Sin faltantes'}
                          </div>
                          <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>por {h.usuario_nombre}</div>
                          {h.hay_faltantes && (h.diferencias || []).map((d, i) => (
                            <div key={i} style={{ fontSize: 11, color: C.red, marginTop: 4 }}>
                              • {d.descripcion}: sistema {d.sistema} → físico {d.fisico}{d.imei ? ` (IMEI: ${d.imei})` : ''}
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: C.text2, flexShrink: 0 }}>{h.fecha}</div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Componentes ──────────────────────────────────────────────────────────────
function SucursalSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
      {SUCURSALES.map(s => (
        <button key={s} onClick={() => onChange(s)} style={{
          background: value === s ? '#FFD700' : '#161b22',
          color: value === s ? '#000' : '#8b949e',
          border: `1px solid ${value === s ? '#FFD700' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8, padding: '10px 18px', cursor: 'pointer',
          fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif",
        }}>SUC. {s.toUpperCase()}</button>
      ))}
    </div>
  )
}

function SeccionLabel({ text }) {
  return <div style={{ fontSize: 13, color: '#8b949e', letterSpacing: '.08em', marginBottom: 10 }}>{text}</div>
}

function Card({ children, style }) {
  return (
    <div style={{ background: '#161b22', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...style }}>
      {children}
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ color: '#8b949e', fontSize: 13, padding: 16, background: '#161b22', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>{text}</div>
}

function Loading() {
  return <div style={{ color: '#8b949e', fontSize: 13 }}>Cargando...</div>
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 6, letterSpacing: '.05em' }}>{label}</div>
      {children}
    </div>
  )
}

function Msg({ msg }) {
  return (
    <div style={{ fontSize: 13, color: msg.ok ? '#3fb950' : '#f85149', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
      {msg.text}
    </div>
  )
}

function SmBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{ background: '#21262d', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f6fc', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>
      {children}
    </button>
  )
}

const inp = {
  width: '100%', boxSizing: 'border-box',
  background: '#21262d', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, padding: '10px 12px', color: '#f0f6fc',
  fontSize: 14, outline: 'none', fontFamily: "'DM Mono', monospace",
}

const cellInp = {
  width: '100%', boxSizing: 'border-box',
  background: 'transparent', border: '1px solid transparent',
  borderRadius: 5, padding: '7px 6px', color: '#f0f6fc',
  fontSize: 13, outline: 'none', fontFamily: "'DM Mono', monospace",
  transition: 'border-color .15s',
  onFocus: undefined,
}

const btn = (disabled) => ({
  width: '100%', background: disabled ? '#21262d' : '#FFD700',
  color: disabled ? '#8b949e' : '#000', fontWeight: 700, fontSize: 15,
  border: 'none', borderRadius: 10, padding: 14, cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: "'Syne', sans-serif",
})
