'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TARIFS_OFFICIELS } from '@/lib/tarifs'
import { Users, Plus, Search, ChevronDown, X, UserPlus, FileDown, Eye, Archive, Trash2 } from 'lucide-react'

interface Souscripteur {
  id: string
  num_fiche: string
  noms: string
  categorie: string
  site: string
  telephone: string
  telephone_2?: string
  dimension: string
  nombre_parcelles?: number
  date_souscription: string
  num_parcelle?: string
  num_cadastral?: string
  num_acte_vente?: string
  email?: string
}

interface Paiement {
  montant: number
  date_paiement: string
}

interface SouscripteurRetard extends Souscripteur {
  quotite_mensuelle?: number
  acompte_initial?: number
  paiements?: Paiement[]
}

type AddSubscriberType = 'MILITAIRE' | 'CIVIL'

interface SubscribersViewProps {
  onAddSubscriber?: (view: 'militaire' | 'civil') => void
  isAdmin?: boolean
  currentUserEmail?: string
  onOpenTrash?: () => void
}

export default function SubscribersView({ onAddSubscriber, isAdmin = false, currentUserEmail = '', onOpenTrash }: SubscribersViewProps) {
  const PAGE_SIZE = 100
  const SUGGESTIONS_LIMIT = 8
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscribers, setSubscribers] = useState<Souscripteur[]>([])
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
  const [suggestions, setSuggestions] = useState<Souscripteur[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [loadingExport, setLoadingExport] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedSubscriber, setSelectedSubscriber] = useState<Souscripteur | null>(null)
  const addMenuRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLDivElement | null>(null)
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

  const calculerMoisRetardMetier = (subscriber: SouscripteurRetard) => {
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

    if (typeof q?.is === 'function') {
      q = q.is('deleted_at', null)
    }

    if (filtreSite !== 'TOUS') {
      q = q.eq('site', filtreSite)
    }

    if (filtreCategorie !== 'TOUS') {
      q = q.eq('categorie', filtreCategorie)
    }

    if (filtreDimension !== 'TOUS') {
      q = q.eq('dimension', filtreDimension)
    }

    if (dateDebut !== '') {
      q = q.gte('date_souscription', dateDebut)
    }

    if (dateFin !== '') {
      q = q.lte('date_souscription', dateFin)
    }

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

  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        const { count, error } = await supabase
          .from('souscripteurs')
          .is('deleted_at', null)
          .select('*', { count: 'exact', head: true })

        if (error) {
          throw error
        }

        setTotalCount(count || 0)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      }
    }

    fetchTotalCount()
  }, [])

  useEffect(() => {
    const fetchSubscribers = async () => {
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

        setSubscribers((rowsRpc.data as Souscripteur[]) || [])
        setFilteredCount(Number(countRpc.data || 0))
      } catch (err: unknown) {
        // Fallback si les RPC ne sont pas encore deployees.
        try {
          if (filtreRetard === null) {
            const from = (currentPage - 1) * PAGE_SIZE
            const to = from + PAGE_SIZE - 1

            let query = supabase
              .from('souscripteurs')
              .select('id, num_fiche, noms, categorie, site, telephone, telephone_2, dimension, nombre_parcelles, date_souscription, num_parcelle, num_cadastral, num_acte_vente, email', { count: 'exact' })
              .order('num_fiche', { ascending: true })
              .range(from, to)

            query = appliquerFiltresServeur(query)

            const { data, error, count } = await query

            if (error) {
              throw error
            }

            setSubscribers(data || [])
            setFilteredCount(count || 0)
          } else {
            const batchSize = 1000
            let from = 0
            const allRows: SouscripteurRetard[] = []

            while (true) {
              const to = from + batchSize - 1

              let query = supabase
                .from('souscripteurs')
                .select('id, num_fiche, noms, categorie, site, telephone, telephone_2, dimension, nombre_parcelles, date_souscription, num_parcelle, num_cadastral, num_acte_vente, email, quotite_mensuelle, acompte_initial, paiements(montant, date_paiement)')
                .order('num_fiche', { ascending: true })
                .range(from, to)

              query = appliquerFiltresServeur(query)

              const { data, error } = await query
              if (error) throw error

              const batch = (data as SouscripteurRetard[]) || []
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

            setSubscribers(filteredByRetard.slice(start, end))
            setFilteredCount(filteredByRetard.length)
          }
        } catch (fallbackErr: unknown) {
          setError(fallbackErr instanceof Error ? fallbackErr.message : 'Erreur inconnue')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchSubscribers()
  }, [currentPage, filtreSite, filtreCategorie, filtreDimension, filtreRetard, rechercheAppliquee, dateDebut, dateFin, refreshKey])

  useEffect(() => {
    setCurrentPage(1)
  }, [filtreSite, filtreCategorie, filtreDimension, filtreRetard, rechercheAppliquee, dateDebut, dateFin])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!addMenuRef.current) return
      if (!addMenuRef.current.contains(event.target as Node)) {
        setShowCategoryMenu(false)
      }

      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (!detailOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [detailOpen])

  useEffect(() => {
    const term = recherche.trim()

    if (term.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setLoadingSuggestions(true)

        const { data, error } = await supabase.rpc('get_recouvrement_rows', {
          ...buildRpcBaseParams(term),
          p_page: 1,
          p_page_size: SUGGESTIONS_LIMIT,
        })

        if (error) {
          throw error
        }

        setSuggestions((data as Souscripteur[]) || [])
        setShowSuggestions(true)
      } catch {
        try {
          let query = supabase
            .from('souscripteurs')
            .select('id, num_fiche, noms, categorie, site, telephone, telephone_2, dimension, nombre_parcelles, date_souscription, num_parcelle, num_cadastral, num_acte_vente, email')
            .order('num_fiche', { ascending: true })
            .limit(SUGGESTIONS_LIMIT)

          query = appliquerFiltresServeur(query, term)

          const { data, error } = await query

          if (error) {
            throw error
          }

          setSuggestions(data || [])
          setShowSuggestions(true)
        } catch {
          setSuggestions([])
          setShowSuggestions(false)
        }
      } finally {
        setLoadingSuggestions(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }, [recherche, filtreSite, filtreCategorie, filtreDimension, filtreRetard, dateDebut, dateFin])

  const executerRecherche = async () => {
    setRechercheAppliquee(recherche)
    setCurrentPage(1)
    setShowSuggestions(false)
  }

  const formatDateFr = (value?: string) => {
    if (!value) return '-'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR')
  }

  const annulerRecherche = () => {
    setRecherche('')
    setRechercheAppliquee('')
    setCurrentPage(1)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const choisirSuggestion = (value: string) => {
    setRecherche(value)
    setRechercheAppliquee(value)
    setCurrentPage(1)
    setShowSuggestions(false)
  }

  const fermerDetail = () => {
    setDetailOpen(false)
    setDetailLoading(false)
    setDetailError(null)
    setSelectedSubscriber(null)
  }

  const ouvrirDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)

    try {
      const { data, error } = await supabase
        .from('souscripteurs')
        .select('id, num_fiche, noms, categorie, site, telephone, telephone_2, dimension, nombre_parcelles, date_souscription, num_parcelle, num_cadastral, num_acte_vente, email')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

      if (error || !data) {
        throw error || new Error('Souscripteur introuvable')
      }

      setSelectedSubscriber(data as Souscripteur)
    } catch (err: unknown) {
      setSelectedSubscriber(null)
      setDetailError(err instanceof Error ? err.message : 'Erreur chargement details')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleAddSubscriber = (type: AddSubscriberType) => {
    if (!onAddSubscriber) return
    onAddSubscriber(type === 'MILITAIRE' ? 'militaire' : 'civil')
  }

  const supprimerSouscripteur = async (subscriber: Souscripteur) => {
    if (deleteLoadingId) {
      return
    }

    let mode: 'SOFT' | 'HARD' | null = 'SOFT'

    if (isAdmin) {
      const choice = window.prompt(
        'Admin: tapez 1 pour CORBEILLE, 2 pour SUPPRESSION DEFINITIVE. Toute autre valeur annule.',
        '1'
      )

      if (choice === null) {
        return
      }

      if (choice.trim() === '2') {
        mode = 'HARD'
      } else if (choice.trim() === '1' || choice.trim() === '') {
        mode = 'SOFT'
      } else {
        return
      }
    } else {
      const confirmSoftDelete = confirm(`Envoyer le dossier #${subscriber.num_fiche} dans la corbeille ?`)
      if (!confirmSoftDelete) {
        return
      }
    }

    setDeleteLoadingId(subscriber.id)
    setError(null)

    try {
      if (mode === 'HARD') {
        const confirmHardDelete = confirm(`Suppression definitive du dossier #${subscriber.num_fiche} ? Cette action est irreversible.`)
        if (!confirmHardDelete) {
          return
        }

        const ficheAsNumber = Number(subscriber.num_fiche)
        if (!Number.isNaN(ficheAsNumber)) {
          const { error: paymentsError } = await supabase
            .from('paiements')
            .delete()
            .eq('num_fiche', ficheAsNumber)

          if (paymentsError) {
            throw paymentsError
          }
        }

        const { error: hardDeleteError } = await supabase
          .from('souscripteurs')
          .delete()
          .eq('id', subscriber.id)

        if (hardDeleteError) {
          throw hardDeleteError
        }
      } else {
        const { error: softDeleteError } = await supabase
          .from('souscripteurs')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by_email: currentUserEmail || null,
            delete_note: isAdmin ? 'corbeille-admin' : 'corbeille-agent',
          })
          .eq('id', subscriber.id)

        if (softDeleteError) {
          throw softDeleteError
        }
      }

      if (selectedSubscriber?.id === subscriber.id) {
        fermerDetail()
      }

      setRefreshKey((prev) => prev + 1)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur suppression souscripteur')
    } finally {
      setDeleteLoadingId(null)
    }
  }

  const exporterPdf = async () => {
    try {
      setLoadingExport(true)

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

      const batchSize = 1000
      let page = 1
      const allRows: Souscripteur[] = []

      try {
        while (true) {
          const { data, error } = await supabase.rpc('get_recouvrement_rows', {
            ...buildRpcBaseParams(),
            p_page: page,
            p_page_size: batchSize,
          })

          if (error) {
            throw error
          }

          const batch = (data as Souscripteur[]) || []
          allRows.push(...batch)

          if (batch.length < batchSize) {
            break
          }

          page += 1
        }
      } catch {
        let from = 0
        const fallbackRows: SouscripteurRetard[] = []

        while (true) {
          const to = from + batchSize - 1
          let query = supabase
            .from('souscripteurs')
            .select('id, num_fiche, noms, categorie, site, telephone, telephone_2, dimension, nombre_parcelles, date_souscription, num_parcelle, num_cadastral, num_acte_vente, email, quotite_mensuelle, acompte_initial, paiements(montant, date_paiement)')
            .order('num_fiche', { ascending: true })
            .range(from, to)

          query = appliquerFiltresServeur(query)

          const { data, error } = await query

          if (error) {
            throw error
          }

          const batch = (data as SouscripteurRetard[]) || []
          fallbackRows.push(...batch)

          if (batch.length < batchSize) {
            break
          }

          from += batchSize
        }

        const fallbackFiltered =
          filtreRetard === null
            ? fallbackRows
            : fallbackRows.filter((row) => {
                const retard = calculerMoisRetardMetier(row)
                return filtreRetard === 3 ? retard >= 3 : retard === filtreRetard
              })

        allRows.splice(0, allRows.length, ...(fallbackFiltered as Souscripteur[]))
      }

      const rowsForExport = allRows

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const logoDataUrl = await loadLogoAsDataUrl()
      // Page de garde
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'JPEG', pageWidth / 2 - 15, 24, 30, 30)
      }

      doc.setFontSize(20)
      doc.setTextColor(30, 41, 59)
      doc.text('Fondation EL-Shaddaï / MBA', pageWidth / 2, 68, { align: 'center' })

      doc.setFontSize(15)
      doc.setTextColor(51, 65, 85)
      doc.text('Liste des souscripteurs', pageWidth / 2, 80, { align: 'center' })

      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 90, { align: 'center' })

      const contentieuxLabel =
        filtreRetard === null ? 'Tous' : filtreRetard === 3 ? '3M+' : `${filtreRetard}M`
      const periodeLabel =
        dateDebut || dateFin
          ? `${dateDebut ? formatDateFr(dateDebut) : '-'} au ${dateFin ? formatDateFr(dateFin) : '-'}`
          : 'Toutes'

      const lignesContexte = [
        `Site: ${filtreSite === 'TOUS' ? 'Tous' : filtreSite}`,
        `Catégorie: ${filtreCategorie === 'TOUS' ? 'Tous' : filtreCategorie}`,
        `Dimension: ${filtreDimension === 'TOUS' ? 'Toutes' : filtreDimension}`,
        `Contentieux: ${contentieuxLabel}`,
        `Période: ${periodeLabel}`,
        `Dossiers exportés: ${rowsForExport.length}`,
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

      const colonnes = [
        { label: 'N°', include: true, getValue: (_s: Souscripteur, index: number) => String(index + 1) },
        { label: 'Fiche', include: true, getValue: (s: Souscripteur) => s.num_fiche },
        { label: 'Nom', include: true, getValue: (s: Souscripteur) => s.noms },
        { label: 'Catégorie', include: filtreCategorie === 'TOUS', getValue: (s: Souscripteur) => s.categorie },
        { label: 'Site', include: filtreSite === 'TOUS', getValue: (s: Souscripteur) => s.site },
        { label: 'Téléphone', include: true, getValue: (s: Souscripteur) => s.telephone },
        { label: 'Dimension', include: filtreDimension === 'TOUS', getValue: (s: Souscripteur) => s.dimension },
        {
          label: 'Date souscription',
          include: true,
          getValue: (s: Souscripteur) => new Date(s.date_souscription).toLocaleDateString('fr-FR'),
        },
      ]

      const colonnesActives = colonnes.filter((col) => col.include)

      const body = rowsForExport.map((s, index) =>
        colonnesActives.map((col) => col.getValue(s, index))
      )

      autoTable(doc, {
        startY: 16,
        head: [colonnesActives.map((col) => col.label)],
        body,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 41, 59] },
      })

      // Pagination uniquement sur les pages de liste (hors page de garde).
      const totalPdfPages = doc.getNumberOfPages()
      const totalListPages = Math.max(1, totalPdfPages - 1)

      for (let pageIndex = 2; pageIndex <= totalPdfPages; pageIndex++) {
        doc.setPage(pageIndex)
        doc.setFontSize(10)
        doc.setTextColor(120)
        doc.text(`${pageIndex - 1}/${totalListPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
      }

      doc.save('liste-souscripteurs.pdf')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur export PDF')
    } finally {
      setLoadingExport(false)
    }
  }

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
              <p className="text-3xl font-black text-slate-900">{loading ? '...' : filteredCount}</p>
              {!loading && (
                <p className="text-xs text-slate-500">Total global: {totalCount}</p>
              )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-end gap-2 md:gap-4">
            <button
              onClick={() => onOpenTrash?.()}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 transition-colors hover:bg-slate-100 md:px-4"
            >
              <Archive size={16} />
              <span className="hidden md:inline">Corbeille</span>
            </button>

            <button
              onClick={exporterPdf}
              disabled={loadingExport}
              className="flex items-center gap-2 rounded-2xl bg-slate-700 px-3 py-2 text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 md:px-4"
            >
              <FileDown size={16} />
              <span className="hidden md:inline">{loadingExport ? 'Export...' : 'Exporter PDF'}</span>
            </button>

            <div ref={addMenuRef} className="relative">
              <button
                onClick={() => setShowCategoryMenu((prev) => !prev)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors"
              >
                <span className="md:hidden">
                  <UserPlus size={16} />
                </span>
                <span className="hidden md:inline-flex md:items-center md:gap-2">
                  <Plus size={16} />
                  Ajouter un souscripteur
                </span>
                <ChevronDown size={16} className={`transition-transform ${showCategoryMenu ? 'rotate-180' : ''}`} />
              </button>

              {showCategoryMenu && (
                <div className="absolute left-0 top-12 z-20 min-w-55 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  <button
                    onClick={() => {
                      handleAddSubscriber('MILITAIRE')
                      setShowCategoryMenu(false)
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Militaire
                  </button>
                  <button
                    onClick={() => {
                      handleAddSubscriber('CIVIL')
                      setShowCategoryMenu(false)
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Civil
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Filtres et recherche */}
          <div className="mb-6 space-y-4">
            {/* Ligne des filtres */}
            <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap">
              <select
                value={filtreSite}
                onChange={(e) => setFiltreSite(e.target.value)}
                className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 ring-blue-900/5 focus:border-blue-300 md:w-auto"
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
                onChange={(e) => setFiltreCategorie(e.target.value as any)}
                className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 ring-blue-900/5 focus:border-blue-300 md:w-auto"
              >
                <option value="TOUS">Catégories</option>
                <option value="MILITAIRE">Militaire</option>
                <option value="CIVIL">Civil</option>
              </select>

              <select
                value={filtreDimension}
                onChange={(e) => setFiltreDimension(e.target.value as any)}
                className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 ring-blue-900/5 focus:border-blue-300 md:w-auto"
              >
                <option value="TOUS">Dimensions</option>
                <option value="15x20">15x20</option>
                <option value="20x20">20x20</option>
              </select>

              <select
                value={filtreRetard === null ? 'TOUS' : String(filtreRetard)}
                onChange={(e) => {
                  const value = e.target.value
                  setFiltreRetard(value === 'TOUS' ? null : Number(value))
                }}
                className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 ring-blue-900/5 focus:border-blue-300 md:w-auto"
              >
                <option value="TOUS">Contentieux</option>
                <option value="1">1M</option>
                <option value="2">2M</option>
                <option value="3">3M+</option>
              </select>

              <div className="col-span-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:w-auto">
                <span className="text-sm font-semibold text-slate-500">Période</span>
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

            {/* Barre de recherche */}
            <div ref={searchRef} className="relative">
              <input
                type="text"
                placeholder="Rechercher par Nom, N° Fiche, Téléphone, N° Parcelle, Cadastral, Acte vente..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true)
                }}
                onKeyDown={(e) => e.key === 'Enter' && executerRecherche()}
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-blue-900/5 focus:border-blue-300 transition-all"
              />
              <button
                onClick={hasActiveSearch ? annulerRecherche : executerRecherche}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                aria-label={hasActiveSearch ? 'Annuler la recherche' : 'Executer la recherche'}
              >
                {hasActiveSearch ? <X size={16} /> : <Search size={16} />}
              </button>

              {showSuggestions && (
                <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  {loadingSuggestions ? (
                    <p className="px-3 py-2 text-sm text-slate-500">Recherche en cours...</p>
                  ) : suggestions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-500">Aucune suggestion</p>
                  ) : (
                    suggestions.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => choisirSuggestion(item.noms)}
                        className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100"
                      >
                        <p className="text-sm font-semibold text-slate-900">{item.noms}</p>
                        <p className="text-xs text-slate-500">Fiche #{item.num_fiche} • {item.telephone}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
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
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100">
                        <Users size={18} className="text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{subscriber.noms}</p>
                        <p className="text-xs text-slate-500">Fiche #{subscriber.num_fiche} • {subscriber.telephone || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => ouvrirDetail(subscriber.id)}
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-100"
                        aria-label="Voir les details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => supprimerSouscripteur(subscriber)}
                        disabled={deleteLoadingId === subscriber.id}
                        className="inline-flex items-center rounded-xl border border-red-200 bg-red-50 p-2 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Supprimer le souscripteur"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">
              Page {currentPage} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={loading || currentPage === 1}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={loading || currentPage >= totalPages}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      </div>

      {detailOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4"
          onClick={fermerDetail}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dossier souscripteur</p>
                <h2 className="text-2xl font-black text-slate-900">{selectedSubscriber?.noms || 'Chargement...'}</h2>
              </div>
              <button
                onClick={fermerDetail}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100"
                aria-label="Fermer les details"
              >
                <X size={16} />
              </button>
            </div>

            {detailLoading ? (
              <p className="py-12 text-center text-sm text-slate-500">Chargement des details...</p>
            ) : detailError ? (
              <p className="py-12 text-center text-sm text-red-600">{detailError}</p>
            ) : selectedSubscriber ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-700">Informations générales</p>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-semibold text-slate-600">Fiche:</span> <span className="text-slate-900">#{selectedSubscriber.num_fiche}</span></p>
                    <p><span className="font-semibold text-slate-600">Catégorie:</span> <span className="text-slate-900">{selectedSubscriber.categorie || '-'}</span></p>
                    <p><span className="font-semibold text-slate-600">Site:</span> <span className="text-slate-900">{selectedSubscriber.site || '-'}</span></p>
                    <p><span className="font-semibold text-slate-600">Date souscription:</span> <span className="text-slate-900">{formatDateFr(selectedSubscriber.date_souscription)}</span></p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-700">Contacts</p>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-semibold text-slate-600">Téléphone 1:</span> <span className="text-slate-900">{selectedSubscriber.telephone || '-'}</span></p>
                    <p><span className="font-semibold text-slate-600">Téléphone 2:</span> <span className="text-slate-900">{selectedSubscriber.telephone_2 || '-'}</span></p>
                    <p><span className="font-semibold text-slate-600">Email:</span> <span className="text-slate-900 break-all">{selectedSubscriber.email || '-'}</span></p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                  <p className="mb-3 text-sm font-semibold text-slate-700">Références foncières</p>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <p><span className="font-semibold text-slate-600">Dimension:</span> <span className="text-slate-900">{selectedSubscriber.dimension || '-'}</span></p>
                    <p><span className="font-semibold text-slate-600">Nombre de parcelles:</span> <span className="text-slate-900">{selectedSubscriber.nombre_parcelles ?? '-'}</span></p>
                    <p><span className="font-semibold text-slate-600">Parcelle:</span> <span className="text-slate-900">{selectedSubscriber.num_parcelle || '-'}</span></p>
                    <p><span className="font-semibold text-slate-600">Cadastral:</span> <span className="text-slate-900">{selectedSubscriber.num_cadastral || '-'}</span></p>
                    <p><span className="font-semibold text-slate-600">Acte de vente:</span> <span className="text-slate-900">{selectedSubscriber.num_acte_vente || '-'}</span></p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-slate-500">Aucun detail disponible.</p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={fermerDetail}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
              >
                Fermer
              </button>
            </div>
          </div>
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
