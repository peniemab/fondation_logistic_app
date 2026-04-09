'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
	AlertTriangle,
	CalendarDays,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	MessageCircle,
	Wrench,
} from 'lucide-react'

interface Souscripteur {
	id: string
	num_fiche: string | number
	noms: string
	site?: string
	dimension?: string
	telephone?: string
	date_souscription?: string
	quotite_mensuelle?: number
	acompte_initial?: number
}

interface Paiement {
	id: string
	num_fiche: string | number
	montant?: number
	date_paiement?: string
	statut?: string
}

type StatutEcheance = 'payee' | 'partiel' | 'retard' | 'attente'

interface EcheanceItem {
	souscripteur: Souscripteur
	montantDu: number
	montantPayeCeMois: number
	statut: StatutEcheance
	retardArgent: number
}

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
const addMonths = (date: Date, delta: number) => new Date(date.getFullYear(), date.getMonth() + delta, 1)

const formatMonthFr = (date: Date) =>
	new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date)

const sameMonth = (value: string | undefined, ref: Date) => {
	if (!value) return false
	const d = new Date(value)
	return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

const cleanPhone = (value?: string) => {
	if (!value) return ''
	const digits = value.replace(/\D+/g, '')
	if (digits.startsWith('243')) return digits
	if (digits.startsWith('0')) return `243${digits.slice(1)}`
	return digits
}

const genererLienWhatsApp = (item: EcheanceItem, moisLabel: string) => {
	const phone = cleanPhone(item.souscripteur.telephone)
	if (!phone) return ''

	const reste = Math.max(0, item.montantDu - item.montantPayeCeMois)
	const message =
		`Bonjour ${item.souscripteur.noms}, rappel echeance ${moisLabel}. ` +
		`Montant du: ${item.montantDu.toLocaleString('fr-FR')} $. ` +
		`Reste a payer: ${reste.toLocaleString('fr-FR')} $.`

	return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

const calculerRetardArgent = (s: Souscripteur, paiements: Paiement[], refDate: Date) => {
	const quotite = Number(s.quotite_mensuelle) || 0
	const acompte = Number(s.acompte_initial) || 0
	if (!s.date_souscription || quotite <= 0) return 0

	const debut = new Date(s.date_souscription)
	const jourSouscription = debut.getDate()

	let moisEcoules = (refDate.getFullYear() - debut.getFullYear()) * 12 + (refDate.getMonth() - debut.getMonth())
	if (refDate.getDate() < jourSouscription) moisEcoules--
	moisEcoules = Math.max(0, moisEcoules)

	const totalPaiements = paiements
		.filter((p) => !(p.statut || '').toUpperCase().includes('REJET'))
		.reduce((sum, p) => sum + (Number(p.montant) || 0), 0)

	const totalVerse = totalPaiements + acompte
	const montantAttendu = acompte + moisEcoules * quotite
	return Math.max(0, montantAttendu - totalVerse)
}

export default function EcheancesView() {
	const [moisCourant, setMoisCourant] = useState(new Date())
	const [filterStatut, setFilterStatut] = useState<'all' | StatutEcheance>('all')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [souscripteurs, setSouscripteurs] = useState<Souscripteur[]>([])
	const [paiements, setPaiements] = useState<Paiement[]>([])

	useEffect(() => {
		const loadData = async () => {
			setLoading(true)
			setError(null)
			try {
				const [sousRes, paieRes] = await Promise.all([
					supabase
						.from('souscripteurs')
						.select('id, num_fiche, noms, site, dimension, telephone, date_souscription, quotite_mensuelle, acompte_initial')
						.order('num_fiche', { ascending: false })
						.limit(1200),
					supabase
						.from('paiements')
						.select('id, num_fiche, montant, date_paiement, statut')
						.limit(10000),
				])

				if (sousRes.error) throw sousRes.error
				if (paieRes.error) throw paieRes.error

				setSouscripteurs((sousRes.data as Souscripteur[]) || [])
				setPaiements((paieRes.data as Paiement[]) || [])
			} catch (err: unknown) {
				setError(err instanceof Error ? err.message : 'Erreur de chargement')
			} finally {
				setLoading(false)
			}
		}

		loadData()
	}, [])

	const paiementsMap = useMemo(() => {
		const map: Record<string, Paiement[]> = {}
		for (const p of paiements) {
			const key = String(p.num_fiche)
			if (!map[key]) map[key] = []
			map[key].push(p)
		}
		return map
	}, [paiements])

	const echeances = useMemo(() => {
		const result: EcheanceItem[] = []
		const debut = startOfMonth(moisCourant)
		const fin = endOfMonth(moisCourant)
		const now = new Date()

		for (const s of souscripteurs) {
			const quotite = Number(s.quotite_mensuelle) || 0
			if (!quotite || !s.date_souscription) continue

			const dateSouscription = new Date(s.date_souscription)
			if (dateSouscription > fin) continue

			const ficheKey = String(s.num_fiche)
			const sesPaiements = (paiementsMap[ficheKey] || []).filter(
				(p) => !(p.statut || '').toUpperCase().includes('REJET')
			)

			const paiementsCeMois = sesPaiements.filter((p) => sameMonth(p.date_paiement, moisCourant))
			const montantPayeCeMois = paiementsCeMois.reduce((sum, p) => sum + (Number(p.montant) || 0), 0)

			const estPaye = montantPayeCeMois >= quotite
			const estPartiel = montantPayeCeMois > 0 && !estPaye
			const estPasse = fin < now

			let statut: StatutEcheance = 'attente'
			if (estPaye) statut = 'payee'
			else if (estPartiel) statut = 'partiel'
			else if (estPasse) statut = 'retard'

			result.push({
				souscripteur: s,
				montantDu: quotite,
				montantPayeCeMois,
				statut,
				retardArgent: calculerRetardArgent(s, sesPaiements, fin),
			})
		}

		const ordre: Record<StatutEcheance, number> = { retard: 0, partiel: 1, attente: 2, payee: 3 }
		return result.sort((a, b) => ordre[a.statut] - ordre[b.statut])
	}, [souscripteurs, paiementsMap, moisCourant])

	const filtered = useMemo(() => {
		if (filterStatut === 'all') return echeances
		return echeances.filter((e) => e.statut === filterStatut)
	}, [echeances, filterStatut])

	const stats = useMemo(() => {
		const payees = echeances.filter((e) => e.statut === 'payee').length
		const retard = echeances.filter((e) => e.statut === 'retard').length
		const attente = echeances.filter((e) => e.statut === 'attente' || e.statut === 'partiel').length

		return {
			total: echeances.length,
			payees,
			retard,
			attente,
			montantAttendu: echeances.reduce((sum, e) => sum + e.montantDu, 0),
			montantEncaisse: echeances.reduce((sum, e) => sum + e.montantPayeCeMois, 0),
		}
	}, [echeances])

	return (
		<div className="space-y-6 p-1">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
						<CalendarDays className="h-6 w-6 text-blue-700" />
						Echeances mensuelles
					</h1>
					<p className="mt-1 text-sm text-slate-500">Suivi des paiements attendus par mois.</p>
				</div>

				<div className="flex items-center gap-2">
					<button
						className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"
						onClick={() => setMoisCourant((prev) => addMonths(prev, -1))}
						aria-label="Mois precedent"
					>
						<ChevronLeft className="h-4 w-4" />
					</button>

					<div className="min-w-42.5 text-center">
						<p className="font-semibold capitalize text-slate-800">{formatMonthFr(moisCourant)}</p>
					</div>

					<button
						className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"
						onClick={() => setMoisCourant((prev) => addMonths(prev, 1))}
						aria-label="Mois suivant"
					>
						<ChevronRight className="h-4 w-4" />
					</button>

					<button
						className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
						onClick={() => setMoisCourant(new Date())}
					>
						Aujourd'hui
					</button>
				</div>
			</div>

			<div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-slate-800 shadow-sm">
				<div className="flex items-start gap-3">
					<div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
						<Wrench className="h-4 w-4" />
					</div>
					<div className="space-y-3">
						<p className="text-sm font-black">Module en developpement</p>
						<p className="mt-1 text-xs text-slate-700">
							Je finalise encore cette vue. Les regles et les indicateurs peuvent donc evoluer avant la version stable.
						</p>

						<div className="rounded-2xl bg-white/70 p-3">
							<p className="text-xs font-black uppercase tracking-wider text-slate-700">Ce que la vue va faire</p>
							<ul className="mt-2 space-y-1 text-xs text-slate-700">
								<li>- Je vais afficher les echeances mensuelles reelles par souscripteur.</li>
								<li>- Je vais classer chaque dossier: payee, partiel, en retard, a venir.</li>
								<li>- Je vais donner les stats cles: total echeances, encaisse, attendu, retard.</li>
								<li>- Je vais faciliter les relances WhatsApp sur les dossiers non soldes.</li>
							</ul>
						</div>

						<div className="rounded-2xl bg-white/70 p-3">
							<p className="text-xs font-black uppercase tracking-wider text-slate-700">Comment elle va fonctionner</p>
							<ul className="mt-2 space-y-1 text-xs text-slate-700">
								<li>- Je charge les souscripteurs et les paiements depuis Supabase.</li>
								<li>- Je calcule automatiquement les montants dus et payes pour le mois selectionne.</li>
								<li>- Je navigue par mois (precedent, suivant, aujourd'hui) avec filtre par statut.</li>
								<li>- J'affiche les details utiles: nom, site, montant, badge statut et action de relance.</li>
							</ul>
						</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{[
					{ label: 'Total echeances', value: stats.total, tone: 'text-slate-900' },
					{ label: 'Payees', value: stats.payees, tone: 'text-emerald-600' },
					{ label: 'En retard / a venir', value: stats.retard + stats.attente, tone: 'text-orange-600' },
					{
						label: 'Encaisse / attendu',
						value: `${stats.montantEncaisse.toLocaleString('fr-FR')} / ${stats.montantAttendu.toLocaleString('fr-FR')}`,
						tone: 'text-blue-700',
					},
				].map((card) => (
					<div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-xs text-slate-500">{card.label}</p>
						<p className={`mt-1 text-xl font-black ${card.tone}`}>{loading ? '...' : card.value}</p>
					</div>
				))}
			</div>

			<div className="flex items-center gap-3">
				<select
					value={filterStatut}
					onChange={(e) => setFilterStatut(e.target.value as 'all' | StatutEcheance)}
					className="w-52 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
				>
					<option value="all">Tous ({echeances.length})</option>
					<option value="retard">En retard ({echeances.filter((e) => e.statut === 'retard').length})</option>
					<option value="partiel">Partiel ({echeances.filter((e) => e.statut === 'partiel').length})</option>
					<option value="attente">A venir ({echeances.filter((e) => e.statut === 'attente').length})</option>
					<option value="payee">Payees ({echeances.filter((e) => e.statut === 'payee').length})</option>
				</select>
			</div>

			{loading ? (
				<div className="space-y-3">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
					))}
				</div>
			) : filtered.length === 0 ? (
				<div className="py-16 text-center">
					<CalendarDays className="mx-auto mb-3 h-12 w-12 text-slate-400" />
					<p className="text-slate-500">Aucune echeance pour ce mois.</p>
				</div>
			) : (
				<div className="space-y-2">
					{filtered.map((item) => {
						const waLink = genererLienWhatsApp(item, formatMonthFr(moisCourant))

						return (
							<div key={item.souscripteur.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
								<div className="flex items-center justify-between gap-3">
									<div className="flex min-w-0 flex-1 items-center gap-3">
										<EcheanceIcon statut={item.statut} />
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-slate-900">{item.souscripteur.noms}</p>
											<p className="text-xs text-slate-500">
												{(item.souscripteur.site || '-') + ' · ' + (item.souscripteur.dimension || '-')}
												{item.souscripteur.telephone ? ` · ${item.souscripteur.telephone}` : ''}
											</p>
										</div>
									</div>

									<div className="flex items-center gap-2">
										<div className="hidden text-right sm:block">
											<p className="text-sm font-semibold text-slate-900">
												{item.montantPayeCeMois > 0
													? `${item.montantPayeCeMois.toLocaleString('fr-FR')} / ${item.montantDu.toLocaleString('fr-FR')} $`
													: `${item.montantDu.toLocaleString('fr-FR')} $`}
											</p>
											{item.retardArgent > 0 && (
												<p className="text-xs text-red-600">Retard: {item.retardArgent.toLocaleString('fr-FR')} $</p>
											)}
										</div>

										<EcheanceBadge statut={item.statut} />

										{waLink && item.statut !== 'payee' && (
											<a href={waLink} target="_blank" rel="noopener noreferrer">
												<button className="inline-flex items-center gap-1.5 rounded-xl border border-green-300 px-2 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50">
													<MessageCircle className="h-4 w-4" />
													<span className="hidden sm:inline">WhatsApp</span>
												</button>
											</a>
										)}
									</div>
								</div>
							</div>
						)
					})}
				</div>
			)}

			{error && (
				<div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
					<p className="font-semibold">Erreur de chargement</p>
					<p className="mt-2 text-sm">{error}</p>
				</div>
			)}
		</div>
	)
}

function EcheanceIcon({ statut }: { statut: StatutEcheance }) {
	const map: Record<StatutEcheance, { icon: any; className: string }> = {
		payee: { icon: CheckCircle2, className: 'text-emerald-500' },
		partiel: { icon: Clock, className: 'text-orange-500' },
		retard: { icon: AlertTriangle, className: 'text-red-600' },
		attente: { icon: Clock, className: 'text-slate-400' },
	}

	const conf = map[statut]
	const Icon = conf.icon
	return <Icon className={`h-5 w-5 shrink-0 ${conf.className}`} />
}

function EcheanceBadge({ statut }: { statut: StatutEcheance }) {
	const map: Record<StatutEcheance, { label: string; className: string }> = {
		payee: { label: 'Payee', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
		partiel: { label: 'Partiel', className: 'border-orange-200 bg-orange-50 text-orange-700' },
		retard: { label: 'En retard', className: 'border-red-200 bg-red-50 text-red-700' },
		attente: { label: 'A venir', className: 'border-slate-200 bg-slate-100 text-slate-600' },
	}

	const conf = map[statut]
	return <span className={`rounded-full border px-3 py-1 text-xs font-bold ${conf.className}`}>{conf.label}</span>
}
