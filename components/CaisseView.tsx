'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import UnifiedSearchBar, { type UnifiedSuggestion } from './UnifiedSearchBar'

type Subscriber = {
  id: string
  num_fiche: string
  noms: string
  telephone: string | null
  email: string | null
  categorie: 'MILITAIRE' | 'CIVIL'
  prix_total: number | null
  acompte_initial: number | null
  quotite_mensuelle: number | null
}

type Paiement = {
  id: string
  created_at: string
  date_paiement: string | null
  reference_bordereau: string
  montant: number
  statut: string
}

function money(value: number) {
  return `${value.toFixed(2)}$`
}

export default function CaisseView({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [suggestions, setSuggestions] = useState<Subscriber[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selected, setSelected] = useState<Subscriber | null>(null)
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().split('T')[0])
  const [montant, setMontant] = useState('')
  const [reference, setReference] = useState('')

  const acompteInitial = selected?.acompte_initial || 0
  const prixTotal = selected?.prix_total || 0
  const mensualite = selected?.quotite_mensuelle || 0
  const totalManuel = useMemo(() => paiements.reduce((sum, p) => sum + p.montant, 0), [paiements])
  const totalVerse = acompteInitial + totalManuel
  const reste = Math.max(0, prixTotal - totalVerse)

  const loadPaiements = useCallback(async (numFiche: string) => {
    const { data, error } = await supabase
      .from('paiements')
      .select('id, created_at, date_paiement, reference_bordereau, montant, statut')
      .eq('num_fiche', numFiche)
      .order('created_at', { ascending: false })

    if (error) {
      alert(`Erreur chargement paiements: ${error.message}`)
      return
    }

    setPaiements((data || []) as Paiement[])
  }, [])

  const tracerAction = async (action: string, details: string, numFiche: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('logs_activite').insert({
        utilisateur: user.email,
        action,
        details,
        num_fiche: numFiche,
      })
    }
  }

  const searchSubscribers = useCallback(async (raw: string) => {
    const cleaned = raw.trim()
    if (!cleaned) {
      setSubscribers([])
      setSuggestions([])
      setShowSuggestions(false)
      setSelected(null)
      setPaiements([])
      return
    }

    setLoading(true)
    const isNumeric = /^\d+$/.test(cleaned)

    let request = supabase
      .from('souscripteurs')
      .select('id, num_fiche, noms, telephone, email, categorie, prix_total, acompte_initial, quotite_mensuelle')
      .is('deleted_at', null)
      .limit(15)

    if (isNumeric) {
      request = request.or(`num_fiche.eq.${parseInt(cleaned, 10)},telephone.eq.${cleaned}`)
    } else {
      request = request.or(`noms.ilike.%${cleaned}%,email.ilike.%${cleaned}%`)
    }

    const { data, error } = await request
    setLoading(false)

    if (error) {
      alert(`Erreur de recherche: ${error.message}`)
      return
    }

    const rows = (data || []) as Subscriber[]
    setSubscribers(rows)

    if (rows.length === 1) {
      setSelected(rows[0])
      setShowSuggestions(false)
      await loadPaiements(rows[0].num_fiche)
    } else {
      setSelected(null)
      setPaiements([])
    }
  }, [loadPaiements])

  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery)
      searchSubscribers(initialQuery)
    }
  }, [initialQuery, searchSubscribers])

  useEffect(() => {
    const term = query.trim()

    if (term.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setLoadingSuggestions(true)

        const isNumeric = /^\d+$/.test(term)
        let request = supabase
          .from('souscripteurs')
          .select('id, num_fiche, noms, telephone, email, categorie, prix_total, acompte_initial, quotite_mensuelle')
          .is('deleted_at', null)
          .limit(8)

        if (isNumeric) {
          request = request.or(`num_fiche.eq.${parseInt(term, 10)},telephone.eq.${term}`)
        } else {
          request = request.or(`noms.ilike.%${term}%,email.ilike.%${term}%`)
        }

        const { data, error } = await request

        if (error) {
          throw error
        }

        setSuggestions((data || []) as Subscriber[])
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setLoadingSuggestions(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }, [query])

  const handleSelect = async (sub: Subscriber) => {
    setSelected(sub)
    setShowSuggestions(false)
    await loadPaiements(sub.num_fiche)
  }

  const clearSearch = () => {
    setQuery('')
    setSubscribers([])
    setSuggestions([])
    setShowSuggestions(false)
    setSelected(null)
    setPaiements([])
  }

  const handleAddPaiement = async () => {
    if (!selected) {
      alert('Sélectionnez d abord un souscripteur.')
      return
    }

    if (!montant || !reference || !datePaiement) {
      alert('Remplissez date, montant et référence.')
      return
    }

    const parsed = Number(montant)
    if (Number.isNaN(parsed) || parsed <= 0) {
      alert('Montant invalide.')
      return
    }

    const today = new Date().toISOString().split('T')[0]
    if (datePaiement > today) {
      alert('La date de paiement ne peut pas être dans le futur.')
      return
    }

    if (reste > 0 && parsed > reste) {
      const ok = confirm(`Le montant (${money(parsed)}) dépasse le reste (${money(reste)}). Continuer ?`)
      if (!ok) return
    }

    setLoading(true)
    const ref = reference.trim().toUpperCase()

    const { error } = await supabase.from('paiements').insert({
      num_fiche: selected.num_fiche,
      montant: parsed,
      reference_bordereau: ref,
      date_paiement: datePaiement,
      statut: 'VALIDÉ',
    })

    setLoading(false)

    if (error) {
      alert(error.code === '23505' ? 'Ce bordereau existe déjà pour ce souscripteur.' : error.message)
      return
    }

    setMontant('')
    setReference('')
    await tracerAction(
      'INSERT',
      `Versement de ${money(parsed)} enregistré (réf. ${ref}) pour la fiche ${selected.num_fiche} — ${selected.noms}`,
      selected.num_fiche,
    )
    await loadPaiements(selected.num_fiche)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900">Caisse - Encaissement</h2>
        <p className="mt-2 text-sm text-slate-600">Acompte initial automatique. Cette vue sert aux versements manuels.</p>

        <div className="mt-4 space-y-2">
          <UnifiedSearchBar
            value={query}
            placeholder="Rechercher par numero fiche, telephone, nom, email"
            hasActiveSearch={query.trim() !== ''}
            onChange={setQuery}
            onSubmit={() => searchSubscribers(query)}
            onClear={clearSearch}
            suggestions={suggestions.map((item): UnifiedSuggestion => ({
              id: item.id,
              title: item.noms,
              subtitle: `Fiche #${item.num_fiche} • ${item.telephone || '-'} • ${item.email || '-'}`,
              value: item.noms,
            }))}
            showSuggestions={showSuggestions}
            onShowSuggestionsChange={setShowSuggestions}
            onSelectSuggestion={(item) => {
              setQuery(item.value || item.title)
              const selectedSuggestion = suggestions.find((sub) => sub.id === item.id)
              if (selectedSuggestion) {
                handleSelect(selectedSuggestion)
              } else {
                searchSubscribers(item.value || item.title)
              }
            }}
            loadingSuggestions={loadingSuggestions}
            emptySuggestionsText="Aucune suggestion"
          />

        </div>

        {subscribers.length > 1 && (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">N fiche</th>
                  <th className="px-3 py-2 text-left">Nom</th>
                  <th className="px-3 py-2 text-left">Telephone</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold">{sub.num_fiche}</td>
                    <td className="px-3 py-2">{sub.noms}</td>
                    <td className="px-3 py-2">{sub.telephone || '-'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleSelect(sub)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-50"
                      >
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="text-lg font-black text-slate-900">Versement manuel - Fiche {selected.num_fiche}</h3>
            <p className="mt-1 text-sm text-slate-600">{selected.noms} - {selected.categorie}</p>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <input
                type="date"
                value={datePaiement}
                onChange={(e) => setDatePaiement(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <input
                type="number"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="Montant"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
                placeholder="Reference bordereau"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold uppercase outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={handleAddPaiement}
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {loading ? 'Validation...' : 'Encaisser'}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMontant(String(mensualite || ''))}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-slate-50"
              >
                Mensualite: {money(mensualite)}
              </button>
              <button
                type="button"
                onClick={() => setMontant(String(reste || ''))}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold hover:bg-slate-50"
              >
                Reste: {money(reste)}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Reference</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                    <th className="px-3 py-2 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {paiements.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{new Date(p.date_paiement || p.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="px-3 py-2 font-semibold uppercase">{p.reference_bordereau}</td>
                      <td className="px-3 py-2 text-right font-bold">{money(p.montant)}</td>
                      <td className="px-3 py-2">{p.statut}</td>
                    </tr>
                  ))}
                  {paiements.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-500">Aucun versement manuel enregistre.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Resume financier</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span>Acompte initial (auto)</span>
                <span className="font-black">{money(acompteInitial)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span>Versements manuels</span>
                <span className="font-black">{money(totalManuel)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2">
                <span>Total verse</span>
                <span className="font-black text-emerald-700">{money(totalVerse)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-red-50 px-3 py-2">
                <span>Reste a payer</span>
                <span className="font-black text-red-700">{money(reste)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
