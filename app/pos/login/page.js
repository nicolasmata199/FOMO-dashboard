'use client'
import { useState } from 'react'
import { getSupabase } from '../../../lib/supabase'

const sb = getSupabase()
const C = { bg:'#030712', bg3:'#161b22', bg4:'#21262d', accent:'#FFD700', text:'#f0f6fc', text2:'#8b949e', border:'rgba(255,255,255,0.08)', red:'#f85149' }

export default function LoginPOS() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { setError('Email o contraseña incorrectos'); setLoading(false); return }
    const { data: perfil } = await sb.from('usuarios_fomo').select('*').eq('id', data.user.id).single()
    if (!perfil) { setError('Usuario sin acceso al sistema'); setLoading(false); return }
    window.location.href = '/pos'
  }

  return (
    <div style={{ background:C.bg, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, color:C.accent }}>FOMO OS</div>
          <div style={{ fontSize:13, color:C.text2, marginTop:4 }}>Ingresá con tu cuenta</div>
        </div>
        <div style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:12, padding:24 }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:C.text2, marginBottom:6, letterSpacing:'.05em' }}>EMAIL</div>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              style={{ width:'100%', boxSizing:'border-box', background:C.bg4, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', color:C.text, fontSize:14, outline:'none', fontFamily:"'Inter', system-ui, sans-serif" }}
            />
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, color:C.text2, marginBottom:6, letterSpacing:'.05em' }}>CONTRASEÑA</div>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width:'100%', boxSizing:'border-box', background:C.bg4, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', color:C.text, fontSize:14, outline:'none', fontFamily:"'Inter', system-ui, sans-serif" }}
            />
          </div>
          {error && <div style={{ fontSize:13, color:C.red, marginBottom:16, textAlign:'center' }}>{error}</div>}
          <button
            onClick={handleLogin} disabled={loading || !email || !password}
            style={{ width:'100%', background:C.accent, color:'#000', fontWeight:700, fontSize:16, border:'none', borderRadius:10, padding:14, cursor:'pointer', fontFamily:"'Syne',sans-serif", opacity: loading ? .7 : 1 }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  )
}
