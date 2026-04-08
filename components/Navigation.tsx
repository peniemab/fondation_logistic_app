'use client'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'

export default function Navigation({ activeView, setActiveView }: { activeView: string; setActiveView: (view: string) => void }) {
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
        <div className="max-w-[1600px] mx-auto flex justify-between items-center px-4">
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
              <img src="/FES.jpg" alt="Logo Fondation El-Shaddaï" className="w-8 h-8 rounded-full shadow-sm" />
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
        className={`fixed top-[73px] left-0 h-[calc(100vh-73px)] bg-white border-r border-slate-200 shadow-lg z-40 transition-transform duration-300 ease-in-out overflow-y-auto ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } w-full max-w-[320px]`}
      >
        <Sidebar
          activeView={activeView}
          setActiveView={(view: string) => {
            setActiveView(view)
            setIsMenuOpen(false)
          }}
        />
      </div>

      {/* Desktop Sidebar removed - now always in menu burger */}
    </>
  )
}
