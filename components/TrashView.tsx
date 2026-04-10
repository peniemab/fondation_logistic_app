'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RotateCcw, Trash2 } from 'lucide-react'

interface CorbeilleRow {
  id: string
  num_fiche: string
  noms: string
  categorie: string
  site: string
  telephone: string
  deleted_at: string | null
  deleted_by_email?: string | null
}

interface TrashViewProps {
  isAdmin: boolean
  currentUserEmail: string
}

const DAY_MS = 24 * 60 * 60 * 1000

export default function TrashView({ isAdmin, currentUserEmail }: TrashViewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CorbeilleRow[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const purgeIfNeeded = useCallback(async () => {
    try {
      const { error: rpcError } = await supabase.rpc('purge_souscripteurs_corbeille')
      if (rpcError) {
        // Fallback client-side si la migration n'est pas encore deployee.
        const before = new Date(Date.now() - 30 * DAY_MS).toISOString()

        const { data: oldRows, error: oldRowsError } = await supabase
          .from('souscripteurs')
          .select('num_fiche')
          .not('deleted_at', 'is', null)
          .lt('deleted_at', before)

        if (oldRowsError) {
          throw oldRowsError
        }

        const fiches = (oldRows || [])
          .map((r) => Number((r as { num_fiche: string | number }).num_fiche))
          .filter((n) => !Number.isNaN(n))

        if (fiches.length > 0) {
          const { error: paymentDeleteError } = await supabase.from('paiements').delete().in('num_fiche', fiches)
          if (paymentDeleteError) {
            throw paymentDeleteError
          }
        }

        const { error: softDeleteError } = await supabase
          .from('souscripteurs')
          .delete()
          .not('deleted_at', 'is', null)
          .lt('deleted_at', before)

        if (softDeleteError) {
          throw softDeleteError
        }
      }
    } catch (err: unknown) {
      console.error('Purge corbeille impossible', err)
    }
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      await purgeIfNeeded()

      const { data, error } = await supabase
        .from('souscripteurs')
        .select('id, num_fiche, noms, categorie, site, telephone, deleted_at, deleted_by_email')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (error) {
        throw error
      }

      setRows((data as CorbeilleRow[]) || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement corbeille')
    } finally {
      setLoading(false)
    }
  }, [purgeIfNeeded])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const restaurer = async (row: CorbeilleRow) => {
    setBusyId(row.id)
    setError(null)

    try {
      const { error } = await supabase
        .from('souscripteurs')
        .update({
          deleted_at: null,
          deleted_by_email: null,
          delete_note: null,
        })
        .eq('id', row.id)

      if (error) {
        throw error
      }

      await fetchRows()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur restauration')
    } finally {
      setBusyId(null)
    }
  }

  const supprimerDefinitivement = async (row: CorbeilleRow) => {
    if (!isAdmin) return

    const confirmDelete = confirm(`Supprimer definitivement le dossier #${row.num_fiche} ?`)
    if (!confirmDelete) return

    setBusyId(row.id)
    setError(null)

    try {
      const ficheAsNumber = Number(row.num_fiche)
      if (!Number.isNaN(ficheAsNumber)) {
        const { error: paymentsError } = await supabase
          .from('paiements')
          .delete()
          .eq('num_fiche', ficheAsNumber)

        if (paymentsError) {
          throw paymentsError
        }
      }

      const { error } = await supabase
        .from('souscripteurs')
        .delete()
        .eq('id', row.id)

      if (error) {
        throw error
      }

      await fetchRows()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur suppression definitive')
    } finally {
      setBusyId(null)
    }
  }

  const formattedRows = useMemo(
    () =>
      rows.map((row) => {
        const deletedAt = row.deleted_at ? new Date(row.deleted_at) : null
        const deletedLabel = deletedAt && !Number.isNaN(deletedAt.getTime())
          ? deletedAt.toLocaleDateString('fr-FR')
          : '-'
        const daysLeft = deletedAt ? Math.max(0, 30 - Math.floor((Date.now() - deletedAt.getTime()) / DAY_MS)) : 0

        return {
          ...row,
          deletedLabel,
          daysLeft,
        }
      }),
    [rows]
  )

  return (
    <div className="p-1">
      <div className="mb-8 max-w-4xl">
        <h1 className="max-w-2xl text-3xl font-black text-slate-900">Corbeille des souscripteurs</h1>
        <p className="mt-2 text-sm text-slate-500">
          Les dossiers restes 30 jours en corbeille avant purge automatique. Restauration autorisee pour tous les agents.
        </p>
      </div>

      <div className="mb-6 rounded-3xl bg-white px-6 py-4 shadow-sm">
        <p className="text-sm text-slate-500">Utilisateur actif: {currentUserEmail || 'inconnu'}</p>
        <p className="text-sm text-slate-500">Profil: {isAdmin ? 'Administrateur' : 'Agent'}</p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="h-16 rounded-3xl bg-slate-100" />
            ))}
          </div>
        ) : formattedRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Aucun dossier en corbeille.
          </div>
        ) : (
          <div className="space-y-3">
            {formattedRows.map((row) => {
              const isBusy = busyId === row.id

              return (
                <div key={row.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-slate-900">{row.noms}</p>
                      <p className="text-xs text-slate-500">
                        Fiche #{row.num_fiche} • {row.telephone || '-'} • supprime le {row.deletedLabel}
                      </p>
                      <p className="text-xs text-slate-500">
                        Par: {row.deleted_by_email || '-'} • purge dans {row.daysLeft} jour{row.daysLeft > 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => restaurer(row)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RotateCcw size={15} />
                        Restaurer
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => supprimerDefinitivement(row)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">Erreur corbeille</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-600">Rappels de regles</p>
        <p className="mt-1">Suppression agent: envoi corbeille uniquement.</p>
        <p className="mt-1">Restauration: agent et admin.</p>
        <p className="mt-1">Suppression definitive: admin uniquement.</p>
      </div>
    </div>
  )
}
