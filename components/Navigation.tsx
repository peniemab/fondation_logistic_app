'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'

type ActiveView = 'hub' | 'militaire' | 'civil' | 'subscribers' | 'corbeille' | 'echeances' | 'rapports' | 'audits' | 'recouvrement' | 'verification' | 'parametres' | 'caisse'

export default function Navigation({
  activeView,
  setActiveView,
  currentUserEmail,
  currentUserId,
  isAdmin,
}: {
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void
  currentUserEmail: string
  currentUserId: string
  isAdmin: boolean
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Bloquer le scroll quand le menu est ouvert
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMenuOpen])

  return (
    <>
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 print:hidden shadow-sm">
        <div className="mx-auto flex max-w-400 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Ouvrir le menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <button
              onClick={() => setActiveView('hub')}
              className="flex items-center gap-3 p-5 cursor-pointer group"
            >
              <Image src="/FES.jpg" alt="Logo Fondation El-Shaddaï" width={32} height={32} className="w-8 h-8 rounded-full shadow-sm" />
              <span className="font-black text-blue-900 text-sm tracking-tighter group-hover:text-blue-600 transition-colors">
                Fondation EL-Shaddai / MBA
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-18.25 h-[calc(100vh-73px)] overflow-y-auto border-r border-slate-200 bg-white shadow-lg transition-transform duration-300 ease-in-out z-40 ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } w-full max-w-[320px]`}
      >
        <Sidebar
          activeView={activeView}
          currentUserEmail={currentUserEmail}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          setActiveView={(view: ActiveView) => {
            setActiveView(view)
            setIsMenuOpen(false)
          }}
        />
      </div>

      {/* Desktop Sidebar removed - now always in menu burger */}
    </>
  )
}
