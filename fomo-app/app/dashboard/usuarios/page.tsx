'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function SetupUsuarios() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('admin')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [usuarios, setUsuarios] = useState<any[]>([])

  useEffect(() => {
    cargarUsuarios()
  }, [])

  async function cargarUsuarios() {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    if (data) setUsuarios(data)
  }

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const res = await fetch('/api/crear-usuario', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, password, nombre, rol })
    })
    const data = await res.json()
    if (data.error) setMsg('Error: ' + data.error)
    else { setMsg('✓ Usuario creado: ' + email); setEmail(''); setPassword(''); setNombre(''); cargarUsuarios() }
    setLoading(false)
  }

  const S = {
    inp: {width:'100%',background:'#1c1c20',border:'1px solid rgba(255,255,255,0.13)',borderRadius:'8px',color:'#eeecea',fontFamily:'DM Mono,monospace',fontSize:'16px',padding:'11px 12px',outline:'none',boxSizing:'border-box' as const,marginBottom:'10px'},
    sel: {width:'100%',background:'#1c1c20',border:'1px solid rgba(255,255,255,0.13)',borderRadius:'8px',color:'#7a7876',fontFamily:'DM Mono,monospace',fontSize:'15px',padding:'11px 12px',outline:'none',boxSizing:'border-box' as const,marginBottom:'10px',WebkitAppearance:'none' as const},
    label: {fontSize:'11px',color:'#7a7876',display:'block',marginBottom:'6px',fontWeight:600 as const},
  }

  return (
    <div style={{minHeight:'100vh',background:'#0c0c0e',padding:'20px 16px',fontFamily:"'Syne',sans-serif",color:'#eeecea'}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{maxWidth:'480px',margin:'0 auto'}}>
        <div style={{marginBottom:'24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <h1 style={{fontSize:'22px',fontWeight:800}}>FO<span style={{color:'#f5a623'}}>MO</span> — Usuarios</h1>
          <button onClick={()=>router.push('/dashboard')} style={{fontSize:'12px',color:'#7a7876',background:'none',border:'none',cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>← Volver</button>
        </div>

        <div style={{background:'#141416',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'16px',marginBottom:'20px'}}>
          <h2 style={{fontSize:'14px',fontWeight:700,marginBottom:'14px',color:'#7a7876',textTransform:'uppercase',letterSpacing:'.08em'}}>Crear nuevo usuario</h2>
          <form onSubmit={crearUsuario}>
            <label style={S.label}>Nombre</label>
            <input type="text" style={S.inp} placeholder="ej: Sofia" value={nombre} onChange={e=>setNombre(e.target.value)} required/>
            <label style={S.label}>Email</label>
            <input type="email" style={S.inp} placeholder="sofia@fomo.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
            <label style={S.label}>Contraseña</label>
            <input type="text" style={S.inp} placeholder="min. 6 caracteres" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>
            <label style={S.label}>Rol</label>
            <select style={S.sel} value={rol} onChange={e=>setRol(e.target.value)}>
              <option value="owner">Owner (Nicolás)</option>
              <option value="admin">Admin (Sofía, Juan Cruz)</option>
            </select>
            {msg && <p style={{fontSize:'12px',color:msg.startsWith('✓')?'#3ddc84':'#ff5050',marginBottom:'10px'}}>{msg}</p>}
            <button type="submit" disabled={loading} style={{width:'100%',background:'#f5a623',color:'#000',border:'none',borderRadius:'10px',padding:'13px',fontSize:'14px',fontWeight:700,fontFamily:"'Syne',sans-serif",cursor:'pointer',opacity:loading?0.7:1}}>
              {loading ? 'Creando...' : 'Crear usuario'}
            </button>
          </form>
        </div>

        <div style={{background:'#141416',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'12px',padding:'16px'}}>
          <h2 style={{fontSize:'14px',fontWeight:700,marginBottom:'14px',color:'#7a7876',textTransform:'uppercase',letterSpacing:'.08em'}}>Usuarios activos</h2>
          {usuarios.map((u:any,i:number)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<usuarios.length-1?'1px solid rgba(255,255,255,0.07)':'none'}}>
              <div>
                <div style={{fontSize:'13px',fontWeight:600}}>{u.nombre}</div>
                <div style={{fontSize:'10px',color:'#7a7876',fontFamily:'monospace',marginTop:'2px'}}>{u.rol}</div>
              </div>
              <span style={{fontSize:'10px',padding:'3px 8px',borderRadius:'4px',background:u.rol==='owner'?'rgba(245,166,35,0.15)':'rgba(91,159,255,0.15)',color:u.rol==='owner'?'#f5a623':'#5b9fff',fontFamily:'monospace',fontWeight:700}}>{u.rol.toUpperCase()}</span>
            </div>
          ))}
          {usuarios.length===0 && <p style={{fontSize:'12px',color:'#3a3a38',textAlign:'center',padding:'12px 0'}}>Sin usuarios creados aún</p>}
        </div>
      </div>
    </div>
  )
}
