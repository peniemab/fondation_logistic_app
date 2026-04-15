'use client'

import type { ComponentType } from 'react'
import { supabase } from '@/lib/supabase'
import { Archive, ClipboardList, Clock, FileText, HandCoins, Home, Layers, ListChecks, LogOut, Settings2, ShieldCheck, UserCircle2, Users } from 'lucide-react'

type ActiveView = 'hub' | 'militaire' | 'civil' | 'subscribers' | 'corbeille' | 'echeances' | 'rapports' | 'audits' | 'recouvrement' | 'verification' | 'parametres' | 'caisse'

type MenuItem = {
  id: Exclude<ActiveView, 'parametres'>
  title: string
  description: string
  icon: ComponentType<{ size?: number }>
}

const handleLogout = async () => {
  const confirmLogout = confirm("Voulez-vous vraiment vous déconnecter ?")
  if (confirmLogout) {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }
}

const menuItems: MenuItem[] = [
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
    id: 'caisse',
    title: 'Caisse',
    description: 'Encaissement des versements',
    icon: HandCoins,
  },
  
  {
    id: 'recouvrement',
    title: 'Recouvrement',
    description: 'Suivi encaissements et relances',
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
  {
    id: 'corbeille',
    title: 'Corbeille',
    description: 'Dossiers supprimés',
    icon: Archive,
  },
]

export default function Sidebar({
  activeView,
  currentUserEmail,
  currentUserId,
  isAdmin,
  setActiveView,
}: {
  activeView: ActiveView
  currentUserEmail: string
  currentUserId: string
  isAdmin: boolean
  setActiveView: (view: ActiveView) => void
}) {
  const visibleMenuItems = menuItems.filter((item) => {
    if (!isAdmin && item.id === 'audits') {
      return false
    }

    return true
  })

  const finalMenuItems = isAdmin
    ? [
      ...visibleMenuItems,
      {
        id: 'parametres' as ActiveView,
        title: 'Paramètres',
        description: 'Gestion des utilisateurs',
        icon: Settings2,
      },
    ]
    : visibleMenuItems

  return (
    <aside className="w-full shrink-0 bg-white flex flex-col h-full">
      <div className="mb-4 px-6 pt-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-900 text-white">
              <UserCircle2 size={20} />
            </span>
            <div className="min-w-0">
              <p className="mt-1 truncate text-sm font-bold text-slate-900">{currentUserEmail || 'Utilisateur inconnu'}</p>
              <p className="mt-1 truncate text-[11px] text-slate-500" title={currentUserId || 'ID indisponible'}>
                ID: {currentUserId || 'indisponible'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto px-6 pb-6">
        {finalMenuItems.map((item) => {
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
