'use client'

import { useMemo, useState } from 'react'
import { TARIFS_OFFICIELS } from '@/lib/tarifs'
import { BarChart2, CalendarDays, Download, MapPin, Users, Wrench } from 'lucide-react'

const statsPreview = [
  {
    label: "Paiements aujourd'hui",
    value: '---',
    tone: 'bg-blue-100 text-blue-700',
    icon: CalendarDays,
  },
  {
    label: "Encaisse aujourd'hui",
    value: '---',
    tone: 'bg-emerald-100 text-emerald-700',
    icon: BarChart2,
  },
  {
    label: 'Total souscripteurs',
    value: '---',
    tone: 'bg-amber-100 text-amber-700',
    icon: Users,
  },
]

const monthIso = (offset = 0) => {
  const d = new Date()
  d.setMonth(d.getMonth() - offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const dayIso = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const dayLabelFr = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00`)
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d)
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
  return `${weekday} ${formatted}`
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => monthIso(i))
const DAY_OPTIONS = Array.from({ length: 30 }, (_, i) => {
  const value = dayIso(i)
  return { value, label: dayLabelFr(value) }
})

export default function RapportsSynthesesView() {
  const sites = Object.keys(TARIFS_OFFICIELS)

  const [siteSelec, setSiteSelec] = useState(sites[0] || 'TOUS')
  const [dimensionSelec, setDimensionSelec] = useState('all')
  const [moisSite, setMoisSite] = useState(MONTH_OPTIONS[0])
  const [jourSelec, setJourSelec] = useState(DAY_OPTIONS[0]?.value || '')

  const dimensions = useMemo(() => {
    if (!siteSelec || !TARIFS_OFFICIELS[siteSelec]) return []
    return Object.keys(TARIFS_OFFICIELS[siteSelec])
  }, [siteSelec])

  return (
    <div className="space-y-6 p-1">
      <div className="mb-8 max-w-4xl">
        <h1 className="max-w-2xl text-3xl font-black text-slate-900">Rapports et syntheses</h1>
        <p className="mt-2 text-sm text-slate-500">Ce module est temporairement en pause.</p>
      </div>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-slate-800 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
            <Wrench size={20} />
          </div>

          <div className="space-y-2">
            <p className="text-lg font-black">En developpement</p>
            <p className="text-sm leading-6 text-slate-700">
              Cette fonctionnalite sera finalisee si le client la demande. Pour l&apos;instant,
              nous concentrons les efforts sur les modules prioritaires.
            </p>

            <div className="pt-2">
              <p className="text-xs font-black uppercase tracking-wider text-slate-600">Fonctionnalites prevues</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>- Statistiques du jour: paiements, montants encaisses, nouveaux souscripteurs.</li>
                <li>- Filtres par periode, site et categorie.</li>
                <li>- Evolution journaliere et mensuelle des encaissements.</li>
                <li>- Comparatif recouvrement attendu vs recouvrement effectif.</li>
                <li>- Liaison avec les vraies valeurs en base (a brancher ensuite).</li>
                <li>- Export des rapports en PDF et Excel.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-black text-slate-900">Apercu du rendu final</p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Preview</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statsPreview.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-xl ${item.tone}`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="text-lg font-black text-slate-900">{item.value}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 transition-colors hover:border-blue-300">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <MapPin size={18} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">Rapport mensuel</p>
                <p className="text-xs text-slate-500">Par site</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs text-slate-500">Site</p>
                <select
                  value={siteSelec}
                  onChange={(e) => setSiteSelec(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                >
                  {sites.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-xs text-slate-500">Dimension</p>
                <select
                  value={dimensionSelec}
                  onChange={(e) => setDimensionSelec(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                >
                  <option value="all">Toutes dimensions</option>
                  {dimensions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-xs text-slate-500">Mois</p>
                <select
                  value={moisSite}
                  onChange={(e) => setMoisSite(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-600">Contenu du rapport:</p>
                <ul className="space-y-1">
                  {[
                    'KPIs: souscripteurs, encaisse, taux',
                    'Repartition des statuts (graphique)',
                    'Paiements du mois (tableau)',
                    'Portefeuille complet du site',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="mt-0.5 text-slate-900">•</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                disabled
                className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-slate-700 px-4 py-2 text-sm font-bold text-white opacity-60"
              >
                <Download size={16} />
                Exporter PDF
              </button>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 transition-colors hover:border-emerald-300">
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <CalendarDays size={18} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">Rapport journalier</p>
                <p className="text-xs text-slate-500">Activite du jour</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs text-slate-500">Date</p>
                <select
                  value={jourSelec}
                  onChange={(e) => setJourSelec(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div className="h-18" />

              <div className="rounded-xl bg-slate-100 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-600">Contenu du rapport:</p>
                <ul className="space-y-1">
                  {[
                    'Paiements du jour par site',
                    'Graphiques de repartition',
                    'Detail de chaque paiement',
                    'Nouvelles souscriptions',
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="mt-0.5 text-slate-900">•</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                disabled
                className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-slate-700 px-4 py-2 text-sm font-bold text-white opacity-60"
              >
                <Download size={16} />
                Exporter PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
