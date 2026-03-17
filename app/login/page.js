'use client'
import { useState } from 'react'
import { getSupabase } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) setError('Email o contraseña incorrectos')
    else window.location.href = '/dashboard'
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#0c0c0e',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}>
      <div style={{background:'#141416',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',padding:'32px 24px',width:'100%',maxWidth:'380px'}}>
        <div style={{fontFamily:'sans-serif',fontSize:'28px',fontWeight:800,color:'#eeecea',textAlign:'center',marginBottom:'4px'}}>
          FO<span style={{color:'#f5a623'}}>MO</span>
        </div>
        <p style={{fontFamily:'sans-serif',fontSize:'13px',color:'#7a7876',textAlign:'center',marginBottom:'28px'}}>Dashboard financiero</p>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:'16px'}}>
            <label style={{fontFamily:'sans-serif',fontSize:'11px',color:'#7a7876',fontWeight:600,display:'block',marginBottom:'7px'}}>Email</label>
            <input style={{width:'100%',background:'#1c1c20',border:'1px solid rgba(255,255,255,0.13)',borderRadius:'8px',color:'#eeecea',fontSize:'15px',padding:'12px',outline:'none',boxSizing:'border-box'}}
              type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" required />
          </div>
          <div style={{marginBottom:'16px'}}>
            <label style={{fontFamily:'sans-serif',fontSize:'11px',color:'#7a7876',fontWeight:600,display:'block',marginBottom:'7px'}}>Contraseña</label>
            <input style={{width:'100%',background:'#1c1c20',border:'1px solid rgba(255,255,255,0.13)',borderRadius:'8px',color:'#eeecea',fontSize:'15px',padding:'12px',outline:'none',boxSizing:'border-box'}}
              type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p style={{fontFamily:'sans-serif',fontSize:'12px',color:'#ff5050',marginBottom:'12px'}}>{error}</p>}
          <button style={{width:'100%',background:'#f5a623',color:'#000',border:'none',padding:'14px',borderRadius:'10px',fontSize:'14px',fontWeight:700,fontFamily:'sans-serif',cursor:'pointer',marginTop:'8px'}}
            type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
