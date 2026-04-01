'use client'
import { supabase } from '@/lib/supabase'
import { LogOut } from 'lucide-react'
import Image from 'next/image'

const handleLogout = async () => {
  const confirmLogout = confirm("Voulez-vous vraiment vous déconnecter ?");
  if (confirmLogout) {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }
};
export default function Navigation({ activeView, setActiveView }: { activeView: string, setActiveView: (v: any) => void }) {
  return (
    <nav className="bg-white border-b border-slate-200 p-4 sticky top-0 z-40 print:hidden shadow-sm">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center">

        <div
          onClick={() => setActiveView('hub')}
          className="flex items-center gap-2 cursor-pointer group"
        >
                  <img src="/FES.jpg" alt="Logo" className="w-24 h-24 mx-auto mb-4 rounded-full shadow-lg" />

          <span className="font-black text-blue-900 text-xs tracking-tighter group-hover:text-blue-600 transition-colors">
            Fondation El-Shaddaï / MBA__GESTION__
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('hub')}
            className="text-[10px] font-black px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-lg uppercase"
          >
            Menu Principal
          </button>
          <button
            onClick={handleLogout}
            aria-label="Se déconnecter"
            title="Déconnexion"
          >
            <LogOut size={20} />
          </button>
        </div>

      </div>
    </nav>
  )
}