'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) setError('Email o contraseña incorrectos')
    else window.location.href = '/'
    setLoading(false)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>FO<span style={{color:'#f5a623'}}>MO</span></div>
        <p style={styles.sub}>Dashboard financiero</p>
        <form onSubmit={handleLogin}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Contraseña</label>
            <input style={styles.input} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  wrap: {minHeight:'100vh',background:'#0c0c0e',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'},
  card: {background:'#141416',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'16px',padding:'32px 24px',width:'100%',maxWidth:'380px'},
  logo: {fontFamily:'Syne,sans-serif',fontSize:'28px',fontWeight:800,color:'#eeecea',textAlign:'center',marginBottom:'4px'},
  sub: {fontFamily:'Syne,sans-serif',fontSize:'13px',color:'#7a7876',textAlign:'center',marginBottom:'28px'},
  field: {marginBottom:'16px'},
  label: {fontFamily:'Syne,sans-serif',fontSize:'11px',color:'#7a7876',fontWeight:600,display:'block',marginBottom:'7px'},
  input: {width:'100%',background:'#1c1c20',border:'1px solid rgba(255,255,255,0.13)',borderRadius:'8px',color:'#eeecea',fontFamily:'DM Mono,monospace',fontSize:'15px',padding:'12px',outline:'none',boxSizing:'border-box'},
  error: {fontFamily:'Syne,sans-serif',fontSize:'12px',color:'#ff5050',marginBottom:'12px'},
  btn: {width:'100%',background:'#f5a623',color:'#000',border:'none',padding:'14px',borderRadius:'10px',fontSize:'14px',fontWeight:700,fontFamily:'Syne,sans-serif',cursor:'pointer',marginTop:'8px'}
}
