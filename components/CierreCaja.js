'use client'
import { useState, useEffect } from 'react'
import { getCierreDataAction, guardarCierreAction } from '../app/pos/actions'

const C = {
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
  { id: 'efectivo_ars',       label: 'Efectivo ARS',    icon: '💵' },
  { id: 'transferencia',      label: 'Transferencia',   icon: '🏦' },
  { id: 'mercadopago',        label: 'MercadoPago',     icon: '💙' },
  { id: 'usd_billete',        label: 'USD Billete',     icon: '💲' },
  { id: 'tarjeta_visa',       label: 'Visa',            icon: '💳' },
  { id: 'tarjeta_mastercard', label: 'Mastercard',      icon: '💳' },
  { id: 'naranja_x',          label: 'Naranja X',       icon: '🟠' },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `credito_personal_${i + 1}`, label: `Crédito ${i + 1}`, icon: '📋',
  })),
  { id: 'financiado_fomo', label: 'Financiado FOMO', icon: '⭐' },
]

const formatARS = (num) =>
  '$' + Number(num || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

// ─── CierreCaja ───────────────────────────────────────────────────────────────
// Props:
//   open        bool
//   onClose     () => void
//   vendedora   { id, nombre } | null
export default function CierreCaja({ open, onClose, vendedora }) {
  const [esperado, setEsperado] = useState({})   // { forma_pago: number }
  const [real, setReal]         = useState({})   // { forma_pago: string }
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [errMsg, setErrMsg]     = useState('')

  const hoy = new Date().toISOString().split('T')[0]

  // Cargar datos cuando se abre
  useEffect(() => {
    if (!open) return
    setGuardado(false)
    setErrMsg('')
    setFetching(true)

    getCierreDataAction(hoy).then(({ data, error }) => {
      if (error) { setErrMsg(error); setFetching(false); return }
      setEsperado(data || {})
      // Inicializar inputs vacíos (el usuario ingresa el real)
      const initReal = {}
      Object.keys(data || {}).forEach(k => { initReal[k] = '' })
      setReal(initReal)
      setFetching(false)
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalEsperado = Object.values(esperado).reduce((a, b) => a + b, 0)

  const guardar = async () => {
    setSaving(true)
    setErrMsg('')
    const { ok, error } = await guardarCierreAction({
      fecha: hoy,
      vendedora_id: vendedora?.id,
      esperado,
      real,
    })
    if (error) setErrMsg(error)
    else setGuardado(true)
    setSaving(false)
  }

  if (!open) return null

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
        display: 'flex', alignItems: 'flex-end', zIndex: 999,
      }}
    >
      <div style={{
        background: C.bg2, borderTop: `1px solid ${C.border}`,
        borderRadius: '20px 20px 0 0', padding: 20,
        width: '100%', maxWidth: 480, margin: '0 auto',
        maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box',
      }}>

        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: C.text }}>
            Cierre de Caja
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: C.text2, marginBottom: 20 }}>
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {vendedora && ` · ${vendedora.nombre}`}
        </div>

        {/* Error */}
        {errMsg && (
          <div style={{ background: C.red + '18', border: `1px solid ${C.red}40`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: C.red, fontSize: 13 }}>
            {errMsg}
          </div>
        )}

        {/* Loading */}
        {fetching && (
          <div style={{ textAlign: 'center', color: C.text2, padding: '28px 0', fontSize: 13 }}>
            Cargando ventas del día...
          </div>
        )}

        {/* Sin ventas */}
        {!fetching && Object.keys(esperado).length === 0 && (
          <div style={{ textAlign: 'center', color: C.text2, padding: '28px 0', fontSize: 13 }}>
            Sin ventas registradas hoy.
          </div>
        )}

        {/* Tabla de formas de pago */}
        {!fetching && Object.keys(esperado).length > 0 && (
          <>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 6, marginBottom: 8, padding: '0 4px' }}>
              <div style={labelStyle}>Forma</div>
              <div style={{ ...labelStyle, textAlign: 'right' }}>Esperado</div>
              <div style={{ ...labelStyle, textAlign: 'right' }}>Real</div>
            </div>

            {Object.entries(esperado).map(([forma, esp]) => {
              const fp = FORMAS_PAGO.find(f => f.id === forma)
              const realVal = parseFloat(real[forma] || '') || 0
              const filled = real[forma] !== ''
              const diff = realVal - esp
              return (
                <div key={forma} style={{ background: C.bg3, borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {fp?.icon} {fp?.label || forma}
                    </span>
                    <span style={{ textAlign: 'right', fontSize: 13, color: C.text2, fontFamily: "'DM Mono', monospace" }}>
                      {formatARS(esp)}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={real[forma] || ''}
                      onChange={e => setReal(p => ({ ...p, [forma]: e.target.value }))}
                      placeholder="—"
                      style={{
                        background: C.bg4, border: `1px solid ${C.border}`,
                        borderRadius: 6, padding: '6px 8px', color: C.text,
                        fontSize: 13, outline: 'none',
                        fontFamily: "'DM Mono', monospace",
                        textAlign: 'right', width: '100%', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  {/* Diferencia */}
                  {filled && (
                    <div style={{
                      textAlign: 'right', fontSize: 11, marginTop: 5,
                      color: diff === 0 ? C.green : Math.abs(diff) <= 100 ? C.accent : C.red,
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      {diff > 0 ? '+' : ''}{formatARS(diff)}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Total del día */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '12px 4px', borderTop: `1px solid ${C.border}`,
              marginTop: 4, marginBottom: 20,
            }}>
              <span style={{ fontWeight: 700, color: C.text }}>Total del día</span>
              <span style={{ color: C.accent, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                {formatARS(totalEsperado)}
              </span>
            </div>

            {/* Resumen diferencias */}
            {Object.entries(real).some(([, v]) => v !== '') && (
              <div style={{ background: C.bg3, borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: C.text2, textTransform: 'uppercase', marginBottom: 8 }}>Resumen de diferencias</div>
                {Object.entries(esperado).map(([forma, esp]) => {
                  if (real[forma] === '') return null
                  const realVal = parseFloat(real[forma]) || 0
                  const diff = realVal - esp
                  if (diff === 0) return null
                  const fp = FORMAS_PAGO.find(f => f.id === forma)
                  return (
                    <div key={forma} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: C.text2 }}>{fp?.label || forma}</span>
                      <span style={{ color: diff > 0 ? C.green : C.red, fontFamily: "'DM Mono', monospace" }}>
                        {diff > 0 ? '+' : ''}{formatARS(diff)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* CTA */}
        {guardado ? (
          <div style={{ textAlign: 'center', color: C.green, padding: 14, fontWeight: 700, fontSize: 15 }}>
            ✓ Cierre guardado correctamente
          </div>
        ) : !fetching && (
          <button
            onClick={guardar}
            disabled={saving || Object.keys(esperado).length === 0}
            style={{
              width: '100%', background: C.accent, color: '#000',
              border: 'none', borderRadius: 8, padding: '13px 20px',
              fontSize: 15, fontWeight: 700,
              cursor: (saving || Object.keys(esperado).length === 0) ? 'not-allowed' : 'pointer',
              opacity: (saving || Object.keys(esperado).length === 0) ? 0.45 : 1,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {saving ? 'Guardando...' : 'Confirmar Cierre'}
          </button>
        )}
      </div>
    </div>
  )
}

const labelStyle = {
  fontSize: 11, color: '#8b949e',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}
