'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TARIFS_OFFICIELS } from '@/lib/tarifs'
import { Eye, FileDown, Search, Users, X } from 'lucide-react'

interface RecouvrementRow {
  id: string
  num_fiche: string
  noms: string
  categorie: string
  site: string
  telephone: string
  dimension: string
  date_souscription: string
  quotite_mensuelle?: number
  acompte_initial?: number
  paiements?: Paiement[]
}

interface Paiement {
  montant: number
  date_paiement: string
}

interface RecouvrementDetail {
  id: string
  num_fiche: string
  noms: string
  categorie: string
  site: string
  telephone: string
  telephone_2?: string
  email?: string
  dimension?: string
  nombre_parcelles?: number
  num_parcelle?: string
  num_cadastral?: string
  num_acte_vente?: string
  date_souscription: string
  quotite_mensuelle: number
  acompte_initial: number
  prix_total: number
  paiements: Paiement[]
}

export default function RecouvrementView() {
  const PAGE_SIZE = 100

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [rows, setRows] = useState<RecouvrementRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [filteredCount, setFilteredCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)

  const [recherche, setRecherche] = useState('')
  const [rechercheAppliquee, setRechercheAppliquee] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filtreSite, setFiltreSite] = useState<string>('TOUS')
  const [filtreCategorie, setFiltreCategorie] = useState<'TOUS' | 'MILITAIRE' | 'CIVIL'>('TOUS')
  const [filtreDimension, setFiltreDimension] = useState<'TOUS' | '15x20' | '20x20'>('TOUS')
  const [filtreRetard, setFiltreRetard] = useState<number | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detail, setDetail] = useState<RecouvrementDetail | null>(null)
  const [loadingExport, setLoadingExport] = useState(false)

  const sitesDisponibles = Object.keys(TARIFS_OFFICIELS).sort((a, b) => a.localeCompare(b, 'fr'))
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))
  const hasActiveSearch = rechercheAppliquee.trim() !== ''

  const buildRpcBaseParams = (termOverride?: string) => ({
    p_term: (termOverride ?? rechercheAppliquee).trim() || null,
    p_site: filtreSite,
    p_categorie: filtreCategorie,
    p_dimension: filtreDimension,
    p_date_debut: dateDebut || null,
    p_date_fin: dateFin || null,
    p_retard: filtreRetard,
  })

  const calculerMoisRetardMetier = (subscriber: {
    date_souscription: string
    quotite_mensuelle?: number
    acompte_initial?: number
    paiements?: Paiement[]
  }) => {
    const debut = new Date(subscriber.date_souscription)
    const aujourdhui = new Date()
    const jourSouscription = debut.getDate()

    let moisEcoules = (aujourdhui.getFullYear() - debut.getFullYear()) * 12 + (aujourdhui.getMonth() - debut.getMonth())
    if (aujourdhui.getDate() < jourSouscription) moisEcoules--
    moisEcoules = Math.max(0, moisEcoules)

    const totalPaiements = (subscriber.paiements || []).reduce((acc, p) => acc + (Number(p.montant) || 0), 0)
    const totalVerse = totalPaiements + (Number(subscriber.acompte_initial) || 0)
    const montantPourMensualites = Math.max(0, totalVerse - (Number(subscriber.acompte_initial) || 0))
    const quotite = Number(subscriber.quotite_mensuelle) || 0
    const nbMoisCouverts = quotite > 0 ? Math.floor(montantPourMensualites / quotite) : 0

    return Math.max(0, moisEcoules - nbMoisCouverts)
  }

  const appliquerFiltresServeur = <T,>(query: T, termOverride?: string) => {
    let q: any = query

    if (filtreSite !== 'TOUS') q = q.eq('site', filtreSite)
    if (filtreCategorie !== 'TOUS') q = q.eq('categorie', filtreCategorie)
    if (filtreDimension !== 'TOUS') q = q.eq('dimension', filtreDimension)
    if (dateDebut !== '') q = q.gte('date_souscription', dateDebut)
    if (dateFin !== '') q = q.lte('date_souscription', dateFin)

    const term = (termOverride ?? rechercheAppliquee).trim()
    if (term !== '') {
      const safeTerm = term.replace(/,/g, ' ')
      const orFilters = [
        `noms.ilike.%${safeTerm}%`,
        `telephone.ilike.%${safeTerm}%`,
        `telephone_2.ilike.%${safeTerm}%`,
        `email.ilike.%${safeTerm}%`,
      ]

      if (/^\d+$/.test(safeTerm)) {
        orFilters.push(
          `num_fiche.eq.${safeTerm}`,
          `num_parcelle.eq.${safeTerm}`,
          `num_cadastral.eq.${safeTerm}`,
          `num_acte_vente.eq.${safeTerm}`
        )
      }

      q = q.or(orFilters.join(','))
    }

    return q
  }

  const formatDateFr = (value?: string | null) => {
    if (!value) return '-'
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR')
  }

  const formatMoney = (value: number) => `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`

  const calculerRecouvrement = (subscriber: RecouvrementDetail) => {
    const moisNoms = ['Janv', 'Fevr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sept', 'Oct', 'Nov', 'Dec']
    const debut = new Date(subscriber.date_souscription)
    const aujourdhui = new Date()
    const jourSouscription = debut.getDate()

    let moisEcoules = (aujourdhui.getFullYear() - debut.getFullYear()) * 12 + (aujourdhui.getMonth() - debut.getMonth())
    if (aujourdhui.getDate() < jourSouscription) moisEcoules--
    moisEcoules = Math.max(0, moisEcoules)

    const totalPaiements = subscriber.paiements.reduce((acc, p) => acc + (Number(p.montant) || 0), 0)
    const totalVerse = totalPaiements + (Number(subscriber.acompte_initial) || 0)

    const montantPourMensualites = Math.max(0, totalVerse - (subscriber.acompte_initial || 0))
    const nbMoisCouverts = subscriber.quotite_mensuelle > 0 ? Math.floor(montantPourMensualites / subscriber.quotite_mensuelle) : 0

    const dateCouverture = new Date(debut)
    dateCouverture.setMonth(debut.getMonth() + nbMoisCouverts)

    const retardMois = Math.max(0, moisEcoules - nbMoisCouverts)
    const detteArgent = Math.max(
      0,
      (moisEcoules * (Number(subscriber.quotite_mensuelle) || 0)) + (Number(subscriber.acompte_initial) || 0) - totalVerse
    )

    const moisEnRetardListe: string[] = []
    if (retardMois > 0) {
      for (let i = 1; i <= retardMois; i++) {
        const d = new Date(dateCouverture)
        d.setMonth(dateCouverture.getMonth() + i)
        moisEnRetardListe.push(`${moisNoms[d.getMonth()]} ${d.getFullYear()}`)
      }
    }

    const paiementsTries = [...subscriber.paiements].sort(
      (a, b) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime()
    )
    const dernierVersement = paiementsTries[0]

    return {
      totalVerse,
      montantAttendu: Number(subscriber.prix_total) || 0,
      retardMois,
      moisEnRetardTexte: moisEnRetardListe.join(', '),
      couverture: dateCouverture.toLocaleDateString('fr-FR'),
      etat: retardMois > 0 ? 'EN RETARD' : 'A JOUR',
      dernierVersement,
      detteMensuelle: detteArgent,
    }
  }

  const detailFinance = useMemo(() => {
    if (!detail) return null
    return calculerRecouvrement(detail)
  }, [detail])

  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        const { count, error } = await supabase.from('souscripteurs').select('*', { count: 'exact', head: true })
        if (error) throw error
        setTotalCount(count || 0)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      }
    }

    fetchTotalCount()
  }, [])

  useEffect(() => {
    const fetchRows = async () => {
      setLoading(true)
      setError(null)

      try {
        const rpcParams = {
          ...buildRpcBaseParams(),
          p_page: currentPage,
          p_page_size: PAGE_SIZE,
        }

        const [rowsRpc, countRpc] = await Promise.all([
          supabase.rpc('get_recouvrement_rows', rpcParams),
          supabase.rpc('get_recouvrement_count', buildRpcBaseParams()),
        ])

        if (rowsRpc.error || countRpc.error) {
          throw rowsRpc.error || countRpc.error
        }

        setRows((rowsRpc.data as RecouvrementRow[]) || [])
        setFilteredCount(Number(countRpc.data || 0))
      } catch (err: unknown) {
        // Fallback de securite si les RPC ne sont pas encore deployees.
        try {
          if (filtreRetard === null) {
            const from = (currentPage - 1) * PAGE_SIZE
            const to = from + PAGE_SIZE - 1

            let query = supabase
              .from('souscripteurs')
              .select('id, num_fiche, noms, categorie, site, telephone, dimension, date_souscription', { count: 'exact' })
              .order('num_fiche', { ascending: true })
              .range(from, to)

            query = appliquerFiltresServeur(query)

            const { data, error, count } = await query
            if (error) throw error

            setRows((data as RecouvrementRow[]) || [])
            setFilteredCount(count || 0)
          } else {
            const batchSize = 1000
            let from = 0
            const allRows: RecouvrementRow[] = []

            while (true) {
              const to = from + batchSize - 1

              let query = supabase
                .from('souscripteurs')
                .select('id, num_fiche, noms, categorie, site, telephone, dimension, date_souscription, quotite_mensuelle, acompte_initial, paiements(montant, date_paiement)')
                .order('num_fiche', { ascending: true })
                .range(from, to)

              query = appliquerFiltresServeur(query)

              const { data, error } = await query
              if (error) throw error

              const batch = (data as RecouvrementRow[]) || []
              allRows.push(...batch)

              if (batch.length < batchSize) break
              from += batchSize
            }

            const filteredByRetard = allRows.filter((row) => {
              const retard = calculerMoisRetardMetier(row)
              return filtreRetard === 3 ? retard >= 3 : retard === filtreRetard
            })

            const start = (currentPage - 1) * PAGE_SIZE
            const end = start + PAGE_SIZE

            setRows(filteredByRetard.slice(start, end))
            setFilteredCount(filteredByRetard.length)
          }
        } catch (fallbackErr: unknown) {
          setError(fallbackErr instanceof Error ? fallbackErr.message : 'Erreur inconnue')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchRows()
  }, [currentPage, filtreSite, filtreCategorie, filtreDimension, filtreRetard, rechercheAppliquee, dateDebut, dateFin])

  useEffect(() => {
    setCurrentPage(1)
  }, [filtreSite, filtreCategorie, filtreDimension, filtreRetard, rechercheAppliquee, dateDebut, dateFin])

  const executerRecherche = () => {
    setRechercheAppliquee(recherche)
    setCurrentPage(1)
  }

  const annulerRecherche = () => {
    setRecherche('')
    setRechercheAppliquee('')
    setCurrentPage(1)
  }

  const fermerDetail = () => {
    setDetailOpen(false)
    setDetailError(null)
  }

  const ouvrirDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)

    try {
      const { data, error } = await supabase
        .from('souscripteurs')
        .select(`
          id,
          num_fiche,
          noms,
          categorie,
          site,
          telephone,
          telephone_2,
          email,
          dimension,
          nombre_parcelles,
          num_parcelle,
          num_cadastral,
          num_acte_vente,
          date_souscription,
          quotite_mensuelle,
          acompte_initial,
          prix_total,
          paiements (
            montant,
            date_paiement
          )
        `)
        .eq('id', id)
        .single()

      if (error || !data) throw error || new Error('Souscripteur introuvable')

      setDetail(data as unknown as RecouvrementDetail)
    } catch (err: unknown) {
      setDetail(null)
      setDetailError(err instanceof Error ? err.message : 'Erreur detail')
    } finally {
      setDetailLoading(false)
    }
  }

  const exporterFichePdf = async () => {
    if (!detail || !detailFinance) return

    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])

    const loadLogoAsDataUrl = async () => {
      try {
        const response = await fetch('/FES.jpg')
        const blob = await response.blob()
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Impossible de lire le logo'))
          reader.readAsDataURL(blob)
        })
      } catch {
        return ''
      }
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const logoDataUrl = await loadLogoAsDataUrl()

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'JPEG', 14, 10, 22, 22)
    }

    doc.setDrawColor(226, 232, 240)
    doc.line(14, 36, pageWidth - 14, 36)

    doc.setFontSize(14)
    doc.setTextColor(20, 83, 45)
    doc.text('Fondation El-Shaddai / MBA', pageWidth / 2, 14, { align: 'center' })

    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text('Operation Logements Sociaux - FES / MUTRAV', pageWidth / 2, 20, { align: 'center' })
    doc.text('ARRETE MINISTERIEL N° 103/CAB.MIN/AFF.SS.AH/PKY/KS/2017', pageWidth / 2, 25, { align: 'center' })

    doc.setFontSize(16)
    doc.setTextColor(30, 41, 59)
    doc.text('Fiche Souscripteur', pageWidth / 2, 45, { align: 'center' })

    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Recouvrement - ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 51, { align: 'center' })

    const rows = [
      ['Nom', detail.noms || '-'],
      ['Numero fiche', detail.num_fiche || '-'],
      ['Categorie', detail.categorie || '-'],
      ['Site', detail.site || '-'],
      ['Telephone 1', detail.telephone || '-'],
      ['Telephone 2', detail.telephone_2 || '-'],
      ['Email', detail.email || '-'],
      ['Dimension', detail.dimension || '-'],
      ['Nombre de parcelles', String(detail.nombre_parcelles || '-')],
      ['Parcelle', detail.num_parcelle || '-'],
      ['Cadastral', detail.num_cadastral || '-'],
      ['Acte', detail.num_acte_vente || '-'],
      ['Quotite mensuelle', formatMoney(detail.quotite_mensuelle || 0)],
      ['Date souscription', formatDateFr(detail.date_souscription)],
      ['Statut retard', detailFinance.retardMois > 0 ? `${detailFinance.retardMois} mois dus` : 'A jour'],
      ['Dernier versement', detailFinance.dernierVersement ? `${formatDateFr(detailFinance.dernierVersement.date_paiement)} (${formatMoney(detailFinance.dernierVersement.montant)})` : '-'],
      ['Couverture', detailFinance.couverture],
      ['Total verse', `${formatMoney(detailFinance.totalVerse)} / ${formatMoney(detailFinance.montantAttendu)}`],
      ['Dette mensuelle', formatMoney(detailFinance.detteMensuelle)],
      ['Etat', `${detailFinance.etat}${detailFinance.retardMois > 0 ? ` (${detailFinance.retardMois} mois)` : ''}`],
    ]

    autoTable(doc, {
      startY: 58,
      head: [['Champ', 'Valeur']],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold' },
        1: { cellWidth: 120 },
      },
    })

    doc.save(`fiche-souscripteur-${detail.num_fiche || detail.id}.pdf`)
  }

  const exporterListePdf = async () => {
    try {
      setLoadingExport(true)
      setError(null)

      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const loadLogoAsDataUrl = async () => {
        try {
          const response = await fetch('/FES.jpg')
          const blob = await response.blob()
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(new Error('Impossible de lire le logo'))
            reader.readAsDataURL(blob)
          })
        } catch {
          return ''
        }
      }

      const batchSize = 500
      let page = 1
      const allRows: RecouvrementRow[] = []

      while (true) {
        const { data, error } = await supabase.rpc('get_recouvrement_rows', {
          ...buildRpcBaseParams(),
          p_page: page,
          p_page_size: batchSize,
        })

        if (error) throw error

        const batch = (data as RecouvrementRow[]) || []
        allRows.push(...batch)

        if (batch.length < batchSize) break
        page += 1
      }

      if (allRows.length === 0) {
        setError('Aucune donnee a exporter avec les filtres actuels.')
        return
      }

      const detailsByFiche = new Map<string, RecouvrementDetail>()
      const ficheValues = allRows.map((r) => Number(r.num_fiche)).filter((n) => !Number.isNaN(n))
      const chunkSize = 300

      for (let i = 0; i < ficheValues.length; i += chunkSize) {
        const chunk = ficheValues.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('souscripteurs')
          .select(`
            id,
            num_fiche,
            noms,
            categorie,
            site,
            telephone,
            telephone_2,
            email,
            dimension,
            num_parcelle,
            num_cadastral,
            num_acte_vente,
            date_souscription,
            quotite_mensuelle,
            acompte_initial,
            prix_total,
            paiements (
              montant,
              date_paiement
            )
          `)
          .in('num_fiche', chunk)

        if (error) throw error

        for (const row of (data || []) as RecouvrementDetail[]) {
          detailsByFiche.set(String(row.num_fiche), row)
        }
      }

      const body = allRows.map((row) => {
        const d = detailsByFiche.get(String(row.num_fiche))

        if (!d) {
          return [row.noms || '-', row.telephone || '-', '-', '-', '-', '-', '-']
        }

        const metier = calculerRecouvrement(d)
        const dernierVersement = metier.dernierVersement
          ? `${formatDateFr(metier.dernierVersement.date_paiement)} (${formatMoney(metier.dernierVersement.montant)})`
          : '-'

        return [
          d.noms || '-',
          d.telephone || '-',
          formatMoney(d.quotite_mensuelle || 0),
          dernierVersement,
          `${formatMoney(metier.totalVerse)} / ${formatMoney(metier.montantAttendu)}`,
          formatMoney(metier.detteMensuelle),
          metier.retardMois > 0 ? `${metier.retardMois} mois dus` : 'A jour',
        ]
      })

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const logoDataUrl = await loadLogoAsDataUrl()

      const contentieuxLabel =
        filtreRetard === null ? 'Tous' : filtreRetard === 3 ? '3M+' : `${filtreRetard}M`
      const periodeLabel =
        dateDebut || dateFin
          ? `${dateDebut ? formatDateFr(dateDebut) : '-'} au ${dateFin ? formatDateFr(dateFin) : '-'}`
          : 'Toutes'
      const rechercheLabel = rechercheAppliquee.trim() || 'Aucune'

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'JPEG', pageWidth / 2 - 15, 24, 30, 30)
      }

      doc.setFontSize(20)
      doc.setTextColor(30, 41, 59)
      doc.text('Fondation El-Shaddai / MBA', pageWidth / 2, 68, { align: 'center' })

      doc.setFontSize(15)
      doc.setTextColor(51, 65, 85)
      doc.text('Liste Recouvrement - Export PDF', pageWidth / 2, 80, { align: 'center' })

      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 90, { align: 'center' })

      const lignesContexte = [
        `Site: ${filtreSite === 'TOUS' ? 'Tous' : filtreSite}`,
        `Categorie: ${filtreCategorie === 'TOUS' ? 'Toutes' : filtreCategorie}`,
        `Dimension: ${filtreDimension === 'TOUS' ? 'Toutes' : filtreDimension}`,
        `Contentieux: ${contentieuxLabel}`,
        `Periode: ${periodeLabel}`,
        `Recherche: ${rechercheLabel}`,
        `Dossiers exportes: ${allRows.length}`,
      ]

      doc.setFontSize(11)
      doc.setTextColor(51, 65, 85)
      doc.text('Contexte des filtres', pageWidth / 2, 106, { align: 'center' })

      doc.setFontSize(10)
      doc.setTextColor(71, 85, 105)
      lignesContexte.forEach((line, index) => {
        doc.text(line, pageWidth / 2, 116 + index * 7, { align: 'center' })
      })

      doc.addPage()

      autoTable(doc, {
        startY: 16,
        head: [[
          'Nom',
          'Telephone 1',
          'Quotite mensuelle',
          'Dernier versement',
          'Total verse (verse / attendu)',
          'Dette mensuelle',
          'Statut retard',
        ]],
        body,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 41, 59] },
      })

      const totalPdfPages = doc.getNumberOfPages()
      const totalListPages = Math.max(1, totalPdfPages - 1)

      for (let pageIndex = 2; pageIndex <= totalPdfPages; pageIndex++) {
        doc.setPage(pageIndex)
        doc.setFontSize(10)
        doc.setTextColor(120)
        doc.text(`${pageIndex - 1}/${totalListPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
      }

      doc.save(`recouvrement-liste-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur export PDF')
    } finally {
      setLoadingExport(false)
    }
  }

  return (
    <div className="p-1">
      <div className="mb-8 max-w-4xl">
        <h1 className="max-w-2xl text-3xl font-black text-slate-900">Recouvrement</h1>
        <p className="mt-2 text-sm text-slate-500">Suivi des encaissements et relances par souscripteur.</p>
      </div>

      <div className="mb-6">
        <div className="rounded-3xl bg-white px-6 py-3 shadow-sm">
          <div className="mb-2 flex items-center gap-3">
            <Users size={30} className="text-slate-600" />
            <p className="text-xl font-semibold text-slate-900">Dossiers recouvrement</p>
          </div>
          <p className="text-3xl font-black text-slate-900">{loading ? '...' : filteredCount}</p>
          {!loading && <p className="text-xs text-slate-500">Total global: {totalCount}</p>}
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-end">
            <button
              onClick={exporterListePdf}
              disabled={loadingExport}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800"
            >
              <FileDown size={16} />
              {loadingExport ? 'Export...' : 'Exporter PDF'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap">
            <select
              value={filtreSite}
              onChange={(e) => setFiltreSite(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 ring-blue-900/5 md:w-auto"
            >
              <option value="TOUS">Sites</option>
              {sitesDisponibles.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>

            <select
              value={filtreCategorie}
              onChange={(e) => setFiltreCategorie(e.target.value as 'TOUS' | 'MILITAIRE' | 'CIVIL')}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 ring-blue-900/5 md:w-auto"
            >
              <option value="TOUS">Categories</option>
              <option value="MILITAIRE">Militaire</option>
              <option value="CIVIL">Civil</option>
            </select>

            <select
              value={filtreDimension}
              onChange={(e) => setFiltreDimension(e.target.value as 'TOUS' | '15x20' | '20x20')}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 ring-blue-900/5 md:w-auto"
            >
              <option value="TOUS">Dimensions</option>
              <option value="15x20">15x20</option>
              <option value="20x20">20x20</option>
            </select>

            <select
              value={filtreRetard === null ? 'TOUS' : String(filtreRetard)}
              onChange={(e) => setFiltreRetard(e.target.value === 'TOUS' ? null : Number(e.target.value))}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 ring-blue-900/5 md:w-auto"
            >
              <option value="TOUS">Contentieux</option>
              <option value="1">1M</option>
              <option value="2">2M</option>
              <option value="3">3M+</option>
            </select>

            <div className="col-span-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:w-auto">
              <span className="text-sm font-semibold text-slate-500">Periode</span>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="min-w-0 bg-transparent text-sm outline-none"
                aria-label="Date de debut"
              />
              <span className="text-sm text-slate-400">au</span>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="min-w-0 bg-transparent text-sm outline-none"
                aria-label="Date de fin"
              />
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher par nom, fiche, telephone, parcelle..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executerRecherche()}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-12 outline-none transition-all focus:border-blue-300 focus:ring-4 ring-blue-900/5"
            />
            <button
              onClick={hasActiveSearch ? annulerRecherche : executerRecherche}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700"
              aria-label={hasActiveSearch ? 'Annuler la recherche' : 'Executer la recherche'}
            >
              {hasActiveSearch ? <X size={16} /> : <Search size={16} />}
            </button>
          </div>
        </div>

        <div className="max-h-96 space-y-3 overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="h-16 rounded-3xl bg-slate-100" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aucun souscripteur trouve.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="rounded-3xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100">
                      <Users size={18} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{row.noms}</p>
                      <p className="text-xs text-slate-500">Fiche #{row.num_fiche}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => ouvrirDetail(row.id)}
                    className="inline-flex items-center rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
                    aria-label={`Voir le detail de ${row.noms}`}
                  >
                    <Eye size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">Page {currentPage} / {totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={loading || currentPage === 1}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Precedent
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={loading || currentPage >= totalPages}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-slate-900/55" onClick={fermerDetail} aria-label="Fermer" />

          <aside className="absolute right-0 top-0 h-full w-full overflow-y-auto bg-white shadow-2xl md:w-[720px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 md:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Fiche detaillee</p>
                <h3 className="text-lg font-black text-slate-900">{detail?.noms || 'Chargement...'}</h3>
              </div>
              <button
                onClick={fermerDetail}
                className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-4 md:p-6">
              {detailLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600">
                  Chargement des informations du souscripteur...
                </div>
              ) : detailError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">{detailError}</div>
              ) : detail && detailFinance ? (
                <>
                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Identite</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p><span className="font-black text-slate-600">Nom:</span> {detail.noms}</p>
                      <p><span className="font-black text-slate-600">Fiche:</span> {detail.num_fiche}</p>
                      <p><span className="font-black text-slate-600">Categorie:</span> {detail.categorie || '-'}</p>
                      <p><span className="font-black text-slate-600">Site:</span> {detail.site || '-'}</p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Contacts</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p><span className="font-black text-slate-600">Telephone 1:</span> {detail.telephone || '-'}</p>
                      <p><span className="font-black text-slate-600">Telephone 2:</span> {detail.telephone_2 || '-'}</p>
                      <p className="sm:col-span-2"><span className="font-black text-slate-600">Email:</span> {detail.email || '-'}</p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Foncier</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p><span className="font-black text-slate-600">Dimension:</span> {detail.dimension || '-'}</p>
                      <p><span className="font-black text-slate-600">Nombre de parcelles:</span> {detail.nombre_parcelles || '-'}</p>
                      <p><span className="font-black text-slate-600">Parcelle:</span> {detail.num_parcelle || '-'}</p>
                      <p><span className="font-black text-slate-600">Cadastral:</span> {detail.num_cadastral || '-'}</p>
                      <p><span className="font-black text-slate-600">Acte:</span> {detail.num_acte_vente || '-'}</p>
                      <p><span className="font-black text-slate-600">Quotite mensuelle:</span> {formatMoney(detail.quotite_mensuelle || 0)}</p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Souscription</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p><span className="font-black text-slate-600">Date:</span> {formatDateFr(detail.date_souscription)}</p>
                      <p>
                        <span className="font-black text-slate-600">Statut retard:</span>{' '}
                        <span className={detailFinance.retardMois > 0 ? 'font-black text-red-600' : 'font-black text-green-600'}>
                          {detailFinance.retardMois > 0 ? `${detailFinance.retardMois} mois dus` : 'A jour'}
                        </span>
                      </p>
                      {detailFinance.retardMois > 0 && (
                        <p className="sm:col-span-2 text-xs text-red-500">
                          {detailFinance.moisEnRetardTexte}
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Recouvrement</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p>
                        <span className="font-black text-slate-600">Dernier versement:</span>{' '}
                        {detailFinance.dernierVersement
                          ? `${formatDateFr(detailFinance.dernierVersement.date_paiement)} (${formatMoney(detailFinance.dernierVersement.montant)})`
                          : '-'}
                      </p>
                      <p><span className="font-black text-slate-600">Couverture:</span> {detailFinance.couverture}</p>
                      <p><span className="font-black text-slate-600">Total verse:</span> {formatMoney(detailFinance.totalVerse)} / {formatMoney(detailFinance.montantAttendu)}</p>
                      <p><span className="font-black text-slate-600">Dette mensuelle:</span> {formatMoney(detailFinance.detteMensuelle)}</p>
                      <p className="sm:col-span-2">
                        <span className="font-black text-slate-600">Etat:</span>{' '}
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                            detailFinance.etat === 'A JOUR' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {detailFinance.etat}{detailFinance.retardMois > 0 ? ` (${detailFinance.retardMois} mois)` : ''}
                        </span>
                      </p>
                    </div>
                  </section>

                  <button
                    onClick={exporterFichePdf}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black uppercase text-white hover:bg-slate-800"
                  >
                    <FileDown size={16} />
                    Exporter PDF
                  </button>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">Erreur de chargement</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
