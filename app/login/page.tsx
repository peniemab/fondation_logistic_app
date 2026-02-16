'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { error } = await supabase.auth.signInWithPassword({ 
  email, 
  password,
})

    if (error) {
      alert("Erreur : " + error.message)
    } else {
      // TRÈS IMPORTANT : Force le rechargement pour que le middleware voie les cookies
      window.location.href = '/' 
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-900 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-8 border-yellow-500">
        <div className="text-center mb-8">
          <h1 className="text-xl font-black text-blue-900 uppercase">Fondation El-Shaddaï / MBA</h1>
          <p className="text-gray-500 text-sm italic">Accès sécurisé - Personnel autorisé</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase mb-2 text-slate-400">Email Professionnel</label>
            <input 
              type="email" 
              autoComplete='off'
              className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 ring-blue-500 font-bold"
              placeholder="agent@fondation.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase mb-2 text-slate-400">Mot de passe</label>
            <input 
              type="password" 
              autoComplete='current-password'
              className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 ring-blue-500 font-bold"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-yellow-500 text-blue-900 font-black py-4 rounded-lg hover:bg-yellow-400 transition shadow-lg uppercase text-xs tracking-widest disabled:bg-slate-200"
          >
            {loading ? 'Vérification...' : 'Se Connecter au Système'}
          </button>
        </form>
      </div>
    </div>
  )
}