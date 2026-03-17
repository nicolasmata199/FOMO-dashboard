'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '../../lib/supabase'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = '/login'
      else setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#0c0c0e',display:'flex',alignItems:'center',justifyContent:'center',color:'#f5a623',fontFamily:'sans-serif'}}>
      Cargando...
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#0c0c0e',display:'flex',alignItems:'center',justifyContent:'center',color:'#eeecea',fontFamily:'sans-serif'}}>
      <h1>Dashboard FOMO - funcionando</h1>
    </div>
  )
}
