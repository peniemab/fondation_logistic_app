'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TARIFS_OFFICIELS } from '@/lib/tarifs'
import { Users, Plus, ChevronDown, X, UserPlus, FileDown, Eye, Trash2, Printer } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import UnifiedSearchBar, { type UnifiedSuggestion } from './UnifiedSearchBar'

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
  // champs détail complet
  genre?: string
  matricule?: string
  num_piece_id?: string
  fonction?: string
  employeur?: string
  avenue_num?: string
  quartier?: string
  commune?: string
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
  const [detailPaiements, setDetailPaiements] = useState<{ date_paiement: string; reference_bordereau: string; montant: number; statut: string }[]>([])
  const addMenuRef = useRef<HTMLDivElement | null>(null)
  const qrRef = useRef<HTMLDivElement | null>(null)
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
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null)

        if (error) {
          // Fallback si la colonne deleted_at n'existe pas encore en base.
          const fallback = await supabase
            .from('souscripteurs')
            .select('*', { count: 'exact', head: true })

          if (fallback.error) {
            throw fallback.error
          }

          setTotalCount(fallback.count || 0)
          return
        }

        setTotalCount(count || 0)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur chargement total global')
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

    const scrollY = window.scrollY
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyPosition = document.body.style.position
    const previousBodyTop = document.body.style.top
    const previousBodyWidth = document.body.style.width

    // Lock background page scroll while allowing the detail panel to scroll.
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
      document.body.style.position = previousBodyPosition
      document.body.style.top = previousBodyTop
      document.body.style.width = previousBodyWidth
      window.scrollTo(0, scrollY)
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
    setDetailPaiements([])
  }

  const ouvrirDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailPaiements([])

    try {
      const { data, error } = await supabase
        .from('souscripteurs')
        .select('id, num_fiche, noms, categorie, site, telephone, telephone_2, dimension, nombre_parcelles, date_souscription, num_parcelle, num_cadastral, num_acte_vente, email, genre, matricule, num_piece_id, fonction, employeur, avenue_num, quartier, commune')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

      if (error || !data) {
        throw error || new Error('Souscripteur introuvable')
      }

      setSelectedSubscriber(data as Souscripteur)

      const { data: paiementsData } = await supabase
        .from('paiements')
        .select('date_paiement, reference_bordereau, montant, statut')
        .eq('num_fiche', data.num_fiche)
        .order('date_paiement', { ascending: true })

      setDetailPaiements(paiementsData ?? [])
    } catch (err: unknown) {
      setSelectedSubscriber(null)
      setDetailError(err instanceof Error ? err.message : 'Erreur chargement details')
    } finally {
      setDetailLoading(false)
    }
  }

  const imprimerFiche = async () => {
    if (!selectedSubscriber) return

    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210
    const cX = W / 2
    const mL = 15
    const mR = W - 15

    // --- Logo ---
    try {
      const blob = await fetch('/FES.jpg').then(r => r.blob())
      const logoBase64 = await new Promise<string>((res) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result as string)
        reader.readAsDataURL(blob)
      })
      doc.addImage(logoBase64, 'JPEG', mL, 8, 22, 22)
    } catch { /* logo optionnel */ }

    // --- En-tête ---
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('FONDATION EL-SHADDAÏ / MBA', cX, 14, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Système de Gestion des Souscripteurs Fonciers', cX, 19, { align: 'center' })
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`FICHE DE SOUSCRIPTION N° ${selectedSubscriber.num_fiche}`, cX, 25, { align: 'center' })
    doc.setLineWidth(0.5)
    doc.line(mL, 30, mR, 30)

    let y = 36

    const drawSection = (title: string, rows: [string, string][]) => {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 64, 175)
      doc.text(title, mL, y)
      doc.setTextColor(0, 0, 0)
      y += 5
      const colW = (W - mL * 2) / 2
      rows.forEach(([label, value], i) => {
        const x = i % 2 === 0 ? mL : mL + colW
        if (i % 2 === 0 && i > 0) y += 6
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(`${label}:`, x, y)
        doc.setFont('helvetica', 'normal')
        doc.text(value || '-', x + 28, y)
        if (i % 2 === 1 || i === rows.length - 1) y += 6
      })
      y += 3
    }

    const fmt = (v?: string) => {
      if (!v) return '-'
      const d = new Date(v)
      return isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR')
    }

    const nb = parseInt(selectedSubscriber.nombre_parcelles?.toString() ?? '1') || 1
    const tarif = TARIFS_OFFICIELS[selectedSubscriber.site]?.[selectedSubscriber.dimension]
    const modalites = tarif
      ? { total: tarif.total * nb, acompte: tarif.acompte * nb, mensualite: tarif.mensualite * nb }
      : { total: 0, acompte: 0, mensualite: 0 }

    const totalVerse = detailPaiements.reduce((acc, p) => acc + p.montant, 0) + modalites.acompte
    const reste = modalites.total - totalVerse

    drawSection('I. IDENTIFICATION', [
      ['Nom complet', selectedSubscriber.noms],
      ['Genre', selectedSubscriber.genre === 'F' ? 'FEMME' : 'HOMME'],
      ['Catégorie', selectedSubscriber.categorie],
      ['Date', fmt(selectedSubscriber.date_souscription)],
      ['Employeur', selectedSubscriber.employeur ?? '-'],
      ['Matricule', selectedSubscriber.matricule ?? '-'],
      ['Fonction', selectedSubscriber.fonction ?? '-'],
      ["Pièce d'ID", selectedSubscriber.num_piece_id ?? '-'],
    ])

    drawSection('II. ADRESSE & CONTACTS', [
      ['Avenue', selectedSubscriber.avenue_num ?? '-'],
      ['Quartier', selectedSubscriber.quartier ?? '-'],
      ['Commune', selectedSubscriber.commune ?? '-'],
      ['Téléphone 1', selectedSubscriber.telephone],
      ['Téléphone 2', selectedSubscriber.telephone_2 ?? '-'],
      ['Email', selectedSubscriber.email ?? '-'],
    ])

    drawSection('III. DONNÉES FONCIÈRES', [
      ['Site', selectedSubscriber.site],
      ['Dimension', selectedSubscriber.dimension],
      ['Nb parcelles', String(selectedSubscriber.nombre_parcelles ?? 1)],
      ['N° parcelle', selectedSubscriber.num_parcelle ?? '-'],
      ['N° cadastral', selectedSubscriber.num_cadastral ?? '-'],
      ['Acte de vente', selectedSubscriber.num_acte_vente ?? '-'],
    ])

    drawSection('IV. MODALITÉS FINANCIÈRES', [
      ['Prix total', `${modalites.total.toLocaleString('fr-FR')} $`],
      ['Acompte initial', `${modalites.acompte.toLocaleString('fr-FR')} $`],
      ['Mensualité', `${modalites.mensualite.toLocaleString('fr-FR')} $`],
      ['Total versé', `${totalVerse.toLocaleString('fr-FR')} $`],
      ['Reste à payer', `${Math.max(0, reste).toLocaleString('fr-FR')} $`],
      ['Statut', reste <= 0 ? 'À JOUR' : 'EN COURS'],
    ])

    // --- QR code ---
    const canvas = qrRef.current?.querySelector('canvas')
    if (canvas) {
      const qrDataURL = canvas.toDataURL('image/png')
      doc.addImage(qrDataURL, 'PNG', mR - 28, 30, 28, 28)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(`N° ${selectedSubscriber.num_fiche}`, mR - 14, 62, { align: 'center' })
    }

    // --- Pied de page page 1 ---
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} — Système FES / MBA`, cX, 288, { align: 'center' })
    doc.setTextColor(0)

    // --- Page 2 : historique des versements ---
    doc.addPage()
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`HISTORIQUE DES VERSEMENTS — N° ${selectedSubscriber.num_fiche}`, cX, 18, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(selectedSubscriber.noms, cX, 24, { align: 'center' })
    doc.line(mL, 28, mR, 28)

    autoTable(doc, {
      startY: 33,
      head: [['#', 'Date de paiement', 'Référence bordereau', 'Montant ($)', 'Statut']],
      body: detailPaiements.length > 0
        ? detailPaiements.map((p, i) => [
            i + 1,
            fmt(p.date_paiement),
            p.reference_bordereau || '-',
            p.montant.toLocaleString('fr-FR'),
            p.statut,
          ])
        : [['', 'Aucun versement enregistré', '', '', '']],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'center', cellWidth: 12 }, 3: { halign: 'right' }, 4: { halign: 'center' } },
      margin: { left: mL, right: mL },
    })

    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} — Système FES / MBA`, cX, 288, { align: 'center' })

    doc.save(`Fiche_${selectedSubscriber.num_fiche}_${selectedSubscriber.noms.replace(/\s+/g, '_')}.pdf`)
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
            <UnifiedSearchBar
              value={recherche}
              placeholder="Rechercher par nom, fiche, telephone, parcelle, cadastral, acte vente..."
              hasActiveSearch={hasActiveSearch}
              onChange={setRecherche}
              onSubmit={executerRecherche}
              onClear={annulerRecherche}
              suggestions={suggestions.map((item): UnifiedSuggestion => ({
                id: item.id,
                title: item.noms,
                subtitle: `Fiche #${item.num_fiche} • ${item.telephone || '-'}`,
                value: item.noms,
              }))}
              showSuggestions={showSuggestions}
              onShowSuggestionsChange={setShowSuggestions}
              onSelectSuggestion={(item) => choisirSuggestion(item.value || item.title)}
              loadingSuggestions={loadingSuggestions}
              emptySuggestionsText="Aucune suggestion"
            />
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
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-slate-900/55" onClick={fermerDetail} aria-label="Fermer" />

          <aside className="absolute right-0 top-0 h-full w-full overflow-y-auto bg-white shadow-2xl md:w-180">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 md:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Fiche detaillee</p>
                <h3 className="text-lg font-black text-slate-900">{selectedSubscriber?.noms || 'Chargement...'}</h3>
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
              ) : selectedSubscriber ? (
                <>
                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Identite</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p><span className="font-black text-slate-600">Nom:</span> {selectedSubscriber.noms}</p>
                      <p><span className="font-black text-slate-600">Fiche:</span> {selectedSubscriber.num_fiche}</p>
                      <p><span className="font-black text-slate-600">Categorie:</span> {selectedSubscriber.categorie || '-'}</p>
                      <p><span className="font-black text-slate-600">Site:</span> {selectedSubscriber.site || '-'}</p>
                      <p><span className="font-black text-slate-600">Date:</span> {formatDateFr(selectedSubscriber.date_souscription)}</p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Contacts</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p><span className="font-black text-slate-600">Telephone 1:</span> {selectedSubscriber.telephone || '-'}</p>
                      <p><span className="font-black text-slate-600">Telephone 2:</span> {selectedSubscriber.telephone_2 || '-'}</p>
                      <p className="sm:col-span-2 break-all"><span className="font-black text-slate-600">Email:</span> {selectedSubscriber.email || '-'}</p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Foncier</h4>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <p><span className="font-black text-slate-600">Dimension:</span> {selectedSubscriber.dimension || '-'}</p>
                      <p><span className="font-black text-slate-600">Nombre de parcelles:</span> {selectedSubscriber.nombre_parcelles ?? '-'}</p>
                      <p><span className="font-black text-slate-600">Parcelle:</span> {selectedSubscriber.num_parcelle || '-'}</p>
                      <p><span className="font-black text-slate-600">Cadastral:</span> {selectedSubscriber.num_cadastral || '-'}</p>
                      <p className="sm:col-span-2"><span className="font-black text-slate-600">Acte de vente:</span> {selectedSubscriber.num_acte_vente || '-'}</p>
                    </div>
                  </section>

                  <div className="flex items-center justify-end gap-2">
                    {/* Canvas caché pour le QR code — utilisé par imprimerFiche */}
                    <div ref={qrRef} className="hidden">
                      <QRCodeCanvas value={selectedSubscriber.num_fiche} size={128} />
                    </div>
                    <button
                      onClick={imprimerFiche}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100"
                    >
                      <Printer size={16} />
                      Imprimer la fiche
                    </button>
                    <button
                      onClick={() => supprimerSouscripteur(selectedSubscriber)}
                      disabled={deleteLoadingId === selectedSubscriber.id}
                      className="inline-flex items-center rounded-xl border border-red-200 bg-red-50 p-2 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Supprimer le souscripteur"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      onClick={fermerDetail}
                      className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
                    >
                      Fermer
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600">
                  Aucun detail disponible.
                </div>
              )}
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
