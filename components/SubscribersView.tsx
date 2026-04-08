'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Plus, Search } from 'lucide-react'

interface Souscripteur {
  id: string
  num_fiche: string
  noms: string
  categorie: string
  site: string
  telephone: string
  telephone_2?: string
  dimension: string
  date_souscription: string
  num_parcelle?: string
  num_cadastral?: string
  num_acte_vente?: string
  email?: string
}

export default function SubscribersView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscribers, setSubscribers] = useState<Souscripteur[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [recherche, setRecherche] = useState('')
  const [filtreSite, setFiltreSite] = useState<string>('TOUS')
  const [filtreCategorie, setFiltreCategorie] = useState<'TOUS' | 'MILITAIRE' | 'CIVIL'>('TOUS')
  const [filtreDimension, setFiltreDimension] = useState<'TOUS' | '15x20' | '20x20'>('TOUS')
  const [filtreRetard, setFiltreRetard] = useState<number | null>(null)

  useEffect(() => {
    const fetchSubscribers = async () => {
      setLoading(true)
      setError(null)

      try {
        // Obtenir le nombre total
        const { count: totalCount, error: countError } = await supabase
          .from('souscripteurs')
          .select('*', { count: 'exact', head: true })

        if (countError) {
          throw countError
        }

        setTotalCount(totalCount || 0)

        // Récupérer les données de base (sans paiements pour performance)
        const { data, error } = await supabase
          .from('souscripteurs')
          .select('id, num_fiche, noms, categorie, site, telephone, telephone_2, dimension, date_souscription, num_parcelle, num_cadastral, num_acte_vente, email')
          .order('num_fiche', { ascending: true })

        if (error) {
          throw error
        }

        setSubscribers(data || [])
        setLoading(false)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
        setLoading(false)
      }
    }

    fetchSubscribers()
  }, [])

  const executerRecherche = async () => {
    // La recherche est maintenant faite côté client via subscribersFiltres
    // On pourrait ajouter une vraie recherche suggestive plus tard si besoin
  }

  const calculerRetard = (subscriber: Souscripteur) => {
    const debut = new Date(subscriber.date_souscription)
    const aujourdhui = new Date()
    const diffMois = (aujourdhui.getFullYear() - debut.getFullYear()) * 12 + (aujourdhui.getMonth() - debut.getMonth())
    // Logique simplifiée pour le retard (on pourrait la complexifier plus tard)
    return diffMois
  }

  // Filtrage des souscripteurs
  const subscribersFiltres = subscribers.filter(subscriber => {
    const matchRecherche = recherche === '' ? true :
      subscriber.noms.toLowerCase().includes(recherche.toLowerCase()) ||
      subscriber.num_fiche.toString().includes(recherche) ||
      subscriber.telephone.includes(recherche) ||
      (subscriber.telephone_2 && subscriber.telephone_2.includes(recherche)) ||
      (subscriber.num_parcelle && subscriber.num_parcelle.toString().includes(recherche)) ||
      (subscriber.num_cadastral && subscriber.num_cadastral.toString().includes(recherche)) ||
      (subscriber.num_acte_vente && subscriber.num_acte_vente.toString().includes(recherche)) ||
      (subscriber.email && subscriber.email.toLowerCase().includes(recherche.toLowerCase()))

    const matchSite = filtreSite === 'TOUS' ? true : subscriber.site === filtreSite
    const matchCategorie = filtreCategorie === 'TOUS' ? true : subscriber.categorie === filtreCategorie
    const matchDimension = filtreDimension === 'TOUS' ? true : subscriber.dimension === filtreDimension

    const moisRetard = calculerRetard(subscriber)
    const matchRetard = filtreRetard === null ? true :
      (filtreRetard === 3 ? moisRetard >= 3 : moisRetard === filtreRetard)

    return matchRecherche && matchSite && matchCategorie && matchDimension && matchRetard
  })

  return (
    <div className="p-1">
      <div className="mb-8 max-w-4xl">
        <h1 className="max-w-2xl text-3xl font-black text-slate-900">Liste des souscripteurs</h1>
      </div>
      <div className="mb-6">
        <div className="rounded-3xl bg-white px-6 py-2 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Users size={30} className="text-slate-600" />
                <p className="text-xl font-semibold text-slate-900">Dossiers enregistrés</p>
              </div>
              <p className="text-3xl font-black text-slate-900">{loading ? '...' : totalCount}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-6">
            
            <div className="flex gap-3">
              <button
                onClick={() => handleAddSubscriber('MILITAIRE')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                Militaire
              </button>
              <button
                onClick={() => handleAddSubscriber('CIVIL')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-colors"
              >
                <Plus size={16} />
                Civil
              </button>
            </div>
          </div>

          {/* Filtres et recherche */}
          <div className="mb-6 space-y-4">
            {/* Ligne des filtres */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filtreSite}
                onChange={(e) => setFiltreSite(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 ring-blue-900/5 focus:border-blue-300"
              >
                <option value="TOUS">Sites</option>
                {/* On pourrait charger dynamiquement les sites depuis la DB */}
                <option value="Site A">Site A</option>
                <option value="Site B">Site B</option>
              </select>

              <select
                value={filtreCategorie}
                onChange={(e) => setFiltreCategorie(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 ring-blue-900/5 focus:border-blue-300"
              >
                <option value="TOUS">Catégories</option>
                <option value="MILITAIRE">Militaire</option>
                <option value="CIVIL">Civil</option>
              </select>

              <select
                value={filtreDimension}
                onChange={(e) => setFiltreDimension(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 ring-blue-900/5 focus:border-blue-300"
              >
                <option value="TOUS">Dimensions</option>
                <option value="15x20">15x20</option>
                <option value="20x20">20x20</option>
              </select>

              <div className="flex gap-1">
                <button
                  onClick={() => setFiltreRetard(null)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    filtreRetard === null ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setFiltreRetard(1)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    filtreRetard === 1 ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  1M
                </button>
                <button
                  onClick={() => setFiltreRetard(2)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    filtreRetard === 2 ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  2M
                </button>
                <button
                  onClick={() => setFiltreRetard(3)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    filtreRetard >= 3 ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  3M+
                </button>
              </div>
            </div>

            {/* Barre de recherche */}
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher par Nom, N° Fiche, Téléphone, N° Parcelle, Cadastral, Acte vente..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executerRecherche()}
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-blue-900/5 focus:border-blue-300 transition-all"
              />
              <button
                onClick={executerRecherche}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                <Search size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="h-16 rounded-3xl bg-slate-100" />
                ))}
              </div>
            ) : subscribers.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Aucun souscripteur trouvé.</p>
            ) : (
              subscribers.map((subscriber) => (
                <div key={subscriber.id} className="rounded-3xl border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100">
                        <Users size={18} className="text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{subscriber.noms}</p>
                        <p className="text-xs text-slate-500">Fiche #{subscriber.num_fiche}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{subscriber.site}</p>
                      <p className="text-xs text-slate-500">{subscriber.categorie} • {subscriber.dimension}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">Erreur de chargement</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
