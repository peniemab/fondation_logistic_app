'use client'
import { supabase } from '@/lib/supabase'

const handleLogout = async () => {
  const confirmLogout = confirm("Voulez-vous vraiment vous déconnecter ?");
  if (confirmLogout) {
    await supabase.auth.signOut();
    window.location.href = '/login'; // On vide tout et on rentre au poste
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
          <img src="/FES.jpg" alt="Logo" className="w-8 h-8 rounded-full" />
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
  className="bg-red-600/10 text-red-600 p-2 rounded-xl hover:bg-red-600 hover:text-white transition-all group"
  title="Déconnexion"
>
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
</button>
        </div>

      </div>
    </nav>
  )
}