'use client' 

import './globals.css'
import { ReactNode, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase' 

export default function RootLayout({ children }: { children: ReactNode }) {
  const [isSuspended, setIsSuspended] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('is_suspended')
          .single()

        if (data && data.is_suspended) {
          setIsSuspended(true)
        }
      } catch (err) {
        console.error("Erreur check status", err)
      } finally {
        setLoading(false)
      }
    }
    checkStatus()
  }, [])

  if (loading) {
    return (
      <html lang="fr">
        <body className="bg-slate-900 flex items-center justify-center min-h-screen">
          <div className="animate-pulse text-blue-400 font-black">CHARGEMENT SYSTÈME...</div>
        </body>
      </html>
    )
  }

  if (isSuspended) {
    return (
      <html lang="fr">
        <body className="bg-slate-950 text-white antialiased">
          <div className="min-h-screen flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-slate-900 border border-red-900/50 p-8 rounded-2xl shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-600/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11-3V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2zm-10 0V7a3 3 0 00-3-3H6a3 3 0 00-3 3v10a3 3 0 003 3h4a3 3 0 003-3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Accès Restreint</h1>
              <p className="text-slate-400 text-sm mb-6">
                Le service est temporairement suspendu pour <span className="text-red-400 font-bold">maintenance administrative</span>. 
                Veuillez contacter votre prestataire technique pour le rétablissement des accès.
              </p>
              <div className="py-3 px-4 bg-slate-800 rounded-lg text-[10px] font-mono text-slate-500 uppercase">
                CODE ERREUR : 402_PAYMENT_REQUIRED
              </div>
            </div>
          </div>
        </body>
      </html>
    )
  }

  return (
    <html lang="fr">
      <body className="bg-slate-50 text-slate-900 antialiased print:bg-white">
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}