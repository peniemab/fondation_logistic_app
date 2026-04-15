'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [logoSrc, setLogoSrc] = useState('/FES.jpg')
  const [logoFailed, setLogoFailed] = useState(false)

  const isUserActive = (user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }) => {
    const appActive = user.app_metadata?.is_active !== false
    const userActive = user.user_metadata?.is_active !== false
    return appActive && userActive
  }

  useEffect(() => {
    const ensureInactiveUsersAreSignedOut = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const sessionUser = sessionData.session?.user

      if (sessionUser && !isUserActive(sessionUser)) {
        await supabase.auth.signOut()
      }
    }

    ensureInactiveUsersAreSignedOut()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { data, error } = await supabase.auth.signInWithPassword({ 
  email, 
  password,
})

    if (error) {
      alert("Erreur : " + error.message)
    } else {
      const signedInUser = data.user

      if (signedInUser && !isUserActive(signedInUser)) {
        await supabase.auth.signOut()
        alert('Ce compte est désactivé. Contactez le coordonnateur.')
        setLoading(false)
        return
      }

      // TRÈS IMPORTANT : Force le rechargement pour que le middleware voie les cookies
      window.location.href = '/' 
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.98)), url('/FES.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-blue-900/10 bg-white shadow-2xl">
        <div className="border-b border-slate-200 bg-blue-900 px-8 py-6 text-white">
          <div className="mx-auto mb-3 grid h-24 w-24 place-items-center overflow-hidden rounded-2xl p-2">
            {!logoFailed ? (
              <Image
                src={logoSrc}
                alt="Logo Fondation"
                width={80}
                height={80}
                className="h-20 w-20 rounded-xl object-cover"
                onError={() => {
                  if (logoSrc === '/FES.jpg') {
                    setLogoSrc('/fes.jpg')
                    return
                  }
                  setLogoFailed(true)
                }}
              />
            ) : (
              <span className="text-xs font-black tracking-widest text-yellow-300">FES</span>
            )}
          </div>
          <h1 className="text-center text-lg font-black uppercase tracking-wide">Fondation El-Shaddai / MBA</h1>
          <p className="mt-1 text-center text-xs text-blue-100">Acces securise - Personnel autorise</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 p-8">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase text-slate-500">Email professionnel</label>
            <input 
              type="email" 
              autoComplete='off'
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 ring-blue-900/10"
              placeholder="agent@fondation.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase text-slate-500">Mot de passe</label>
            <input 
              type="password" 
              autoComplete='current-password'
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 ring-blue-900/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            disabled={loading}
            className="w-full rounded-xl bg-blue-900 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? 'Vérification...' : 'Se Connecter au Système'}
          </button>

          <p className="text-center text-xs text-slate-500">
            Plateforme interne de gestion des souscriptions et du recouvrement.
          </p>

          <div className="mx-auto h-1 w-24 rounded-full bg-yellow-500/90" />
        </form>
      </div>
    </div>
  )
}