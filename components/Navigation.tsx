'use client'

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
            onClick={() => window.location.reload()}
            className="text-[10px] font-black px-3 py-2 bg-red-50 text-red-600 rounded-lg uppercase border border-red-100"
          >
            Déconnexion
          </button>
        </div>

      </div>
    </nav>
  )
}