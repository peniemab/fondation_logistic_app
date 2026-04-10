'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

interface SiteRevenue {
  site: string
  totalCollected: number
  percentage: number
  count: number
}

interface PaiementRow {
  montant: number | string | null
}

interface SouscripteurRow {
  id: string
  site: string | null
  prix_total: number | string | null
  acompte_initial: number | string | null
  paiements?: PaiementRow[] | null
}

export default function DashboardHome() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscriberCount, setSubscriberCount] = useState(0)
  const [paymentCount, setPaymentCount] = useState(0)
  const [totalContracts, setTotalContracts] = useState(0)
  const [totalCollected, setTotalCollected] = useState(0)
  const [revenueBySite, setRevenueBySite] = useState<SiteRevenue[]>([])

  useEffect(() => {
    const fetchDashboardMetrics = async () => {
      setLoading(true)
      setError(null)

      try {
        // Obtenir le nombre total exact
        const { count: totalCount, error: countError } = await supabase
          .from('souscripteurs')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null)

        if (countError) {
          throw countError
        }

        const totalRecords = totalCount || 0
        let toutesLesDonnees: SouscripteurRow[] = []
        const taillePaquet = 1000

        // Boucler pour récupérer tous les enregistrements
        for (let i = 0; i < totalRecords; i += taillePaquet) {
          const { data, error } = await supabase
            .from('souscripteurs')
            .select(`id, site, prix_total, acompte_initial, paiements(montant)`)
            .is('deleted_at', null)
            .order('id', { ascending: true })
            .range(i, i + taillePaquet - 1)

          if (error) {
            throw error
          }

          if (data) {
            toutesLesDonnees = [...toutesLesDonnees, ...data]
          }
        }

        const siteMap = new Map<string, { totalCollected: number; count: number }>()
        let subscriberTotal = 0
        let paymentTotal = 0
        let contractTotal = 0
        let collectedTotal = 0

        toutesLesDonnees.forEach((row) => {
          const prixTotal = Number(row.prix_total) || 0
          const acompteInitial = Number(row.acompte_initial) || 0
          const paiements = Array.isArray(row.paiements) ? row.paiements : []
          const paiementsTotal = paiements.reduce((sum: number, paiement: PaiementRow) => sum + (Number(paiement.montant) || 0), 0)
          const rowCollected = acompteInitial + paiementsTotal

          subscriberTotal += 1
          paymentTotal += paiements.length
          contractTotal += prixTotal
          collectedTotal += rowCollected

          const siteName = row.site || 'Autre'
          const previous = siteMap.get(siteName) ?? { totalCollected: 0, count: 0 }
          siteMap.set(siteName, {
            totalCollected: previous.totalCollected + rowCollected,
            count: previous.count + 1,
          })
        })

        const siteList: SiteRevenue[] = Array.from(siteMap.entries()).map(([site, stats]) => ({
          site,
          totalCollected: stats.totalCollected,
          count: stats.count,
          percentage: contractTotal > 0 ? (stats.totalCollected / contractTotal) * 100 : 0,
        }))

        siteList.sort((a, b) => b.totalCollected - a.totalCollected)

        setSubscriberCount(subscriberTotal)
        setPaymentCount(paymentTotal)
        setTotalContracts(contractTotal)
        setTotalCollected(collectedTotal)
        setRevenueBySite(siteList)
        setLoading(false)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
        setLoading(false)
      }
    }

    fetchDashboardMetrics()
  }, [])

  const collectedPercent = totalContracts > 0 ? (totalCollected / totalContracts) * 100 : 0
  const remainingPercent = totalContracts > 0 ? Math.max(0, 100 - collectedPercent) : 0

  const summaryCards = [
    {
      label: 'Souscripteurs',
      value: subscriberCount,
      description: 'Dossiers enregistrés',
      icon: Users2,
    },
    {
      label: 'Total encaissé',
      value: `${Math.round(collectedPercent)}%`,
      description: 'du montant total',
      icon: TrendingUp,


    },
    {
      label: 'Revenus attendus',
      value: '100%',
      description: 'du montant total de contrats',
      icon: DollarSign,

    },
    {
      label: 'Reste à percevoir',
      value: `${Math.round(remainingPercent)}%`,
      description: 'du montant total de contrats',
      icon: TrendingDown,
    },
  ]

  const siteSummary = useMemo(
    () =>
      revenueBySite.map((site) => ({
        ...site,
        displayLabel: site.site.length > 18 ? `${site.site.slice(0, 18)}…` : site.site,
      })),
    [revenueBySite]
  )

  return (
    <div className="p-1">
      <div className="mb-4 max-w-4xl">
        <h1 className="max-w-2xl text-3xl font-black text-slate-900">Tableau de bord</h1>
        <h2 className="mt-4 max-w-2xl text-2xl leading-7  text-slate-900">Vue d&apos;ensemble de l&apos;activité</h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
        <div className="">
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-3xl bg-white px-6 py-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  {card.icon && <card.icon size={30} className="text-slate-900" />}
                  <p className="text-xl tracking-[0.18em] text-slate-900">{card.label}</p>
                </div>
                <p className="mt-4 text-3xl font-black text-slate-900">{loading ? '...' : card.value}</p>
                <p className="mt-3 text-xl leading-6 text-slate-900">{card.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div> 
                <h2 className="mt-3 text-2xl font-black text-slate-900">Répartition des revenus par site</h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="h-16 rounded-3xl bg-slate-100" />
                  ))}
                </div>
              ) : siteSummary.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune donnée de site disponible.</p>
              ) : (
                siteSummary.map((site) => (
                  <div key={site.site} className="rounded-3xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xl font-black text-slate-900">{site.displayLabel}</p>
                        <p className="mt-1 text-xl text-slate-900">{site.count} dossier{site.count > 1 ? 's' : ''}</p>
                      </div>
                      <p className="text-xl font-black text-slate-900">{Math.round(site.percentage)}%</p>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-900"
                        style={{ width: `${Math.min(100, site.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">Impossible de charger les métriques.</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      ) : null}
    </div>
  )
}
