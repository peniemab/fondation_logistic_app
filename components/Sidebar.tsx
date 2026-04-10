'use client'

import { supabase } from '@/lib/supabase'
import { Archive, ClipboardList, Clock, FileText, Home, Layers, ListChecks, LogOut, ShieldCheck, Users } from 'lucide-react'

const handleLogout = async () => {
  const confirmLogout = confirm("Voulez-vous vraiment vous déconnecter ?")
  if (confirmLogout) {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }
}

const menuItems = [
  {
    id: 'hub',
    title: 'Accueil',
    description: 'Tableau de bord principal',
    icon: Home,
  },
  {
    id: 'militaire',
    title: 'Formulaire militaire',
    description: 'Souscription des militaires',
    icon: ClipboardList,
  },
  {
    id: 'civil',
    title: 'Formulaire civil',
    description: 'Souscription des civils',
    icon: ClipboardList,
},
{
    id: 'subscribers',
    title: 'Souscripteurs',
    description: 'Vues des souscripteurs',
    icon: Users,
  },
  {
    id: 'corbeille',
    title: 'Corbeille',
    description: 'Dossiers supprimes logiquement',
    icon: Archive,
  },
  {
    id: 'recouvrement',
    title: 'Recouvrement',
    description: 'Suivi des encaissements et relances',
    icon: ShieldCheck,
  },
  {
    id: 'echeances',
    title: 'Échéances mensuelles',
    description: 'Suivi des échéances',
    icon: Clock,
  },
  {
    id: 'rapports',
    title: 'Rapports & synthèses',
    description: 'Analyse et bilan',
    icon: FileText,
  },
  {
    id: 'audits',
    title: 'Journal d’audits',
    description: 'Contrôles et historique',
    icon: ListChecks,
  },
  {
    id: 'verification',
    title: 'Vérification QR code',
    description: 'Formulaire et reçu',
    icon: Layers,
  },
]

export default function Sidebar({
  activeView,
  setActiveView,
}: {
  activeView: string
  setActiveView: (view: string) => void
}) {
  return (
    <aside className="w-full shrink-0 bg-white flex flex-col h-full">
      <div className="mb-2">
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto px-6 pb-6">
        {menuItems.map((item) => {
          const ItemIcon = item.icon
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-start gap-4 rounded-3xl border p-1 text-left transition-all duration-200 ${
                isActive
                  ? 'border-blue-900 bg-blue-950/5 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-blue-900 hover:bg-slate-50'
              }`}
            >
              <span className={`grid h-11 w-11 place-items-center rounded-2xl shrink-0 ${isActive ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                <ItemIcon size={20} />
              </span>
              <div>
                <p className={`text-sm font-black ${isActive ? 'text-blue-900' : 'text-slate-900'}`}>{item.title}</p>
                <p className="text-xs text-slate-500 mt-1">{item.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Logout Button */}
      <div className="mt-6 pt-6 border-t border-slate-200 px-6 pb-6">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Se déconnecter</span>
        </button>
      </div>
    </aside>
  )
}
