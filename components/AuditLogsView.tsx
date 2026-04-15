'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, ListChecks, RefreshCcw } from 'lucide-react'

type AuditLogItem = {
  id: string
  performer_id: string | null
  performer_email?: string | null
  target_email?: string | null
  action_type: string
  table_name: string
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

type ActivityLogItem = {
  id: string
  created_at: string
  utilisateur: string
  action: string
  details: string | null
  num_fiche: string | null
}

const ACCESS_ACTION_TYPES = new Set([
  'USER_ROLE_UPDATED',
  'USER_STATUS_UPDATED',
  'USER_PERMISSION_RECOUVREMENT_UPDATED',
  'USER_PERMISSION_RAPPORTS_UPDATED',
  'USER_PERMISSION_ECHEANCES_UPDATED',
  'USER_ACCESS_UPDATED',
])

function formatDate(input: string | null) {
  if (!input) {
    return '-'
  }

  return new Date(input).toLocaleString('fr-FR')
}

function summarizeAccessChanges(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) {
  if (!oldData || !newData) {
    return 'Détail indisponible'
  }

  const oldPermission = typeof oldData.permission === 'string' ? oldData.permission : ''
  const newPermission = typeof newData.permission === 'string' ? newData.permission : ''
  const permissionName = newPermission || oldPermission

  // Format d'event unitaire: { permission: 'rapports', allowed: boolean }
  if (permissionName && ('allowed' in oldData || 'allowed' in newData)) {
    const oldAllowed = oldData.allowed === true
    const newAllowed = newData.allowed === true

    if (oldAllowed !== newAllowed) {
      return `${permissionName}: ${oldAllowed ? 'permis' : 'non permis'} -> ${newAllowed ? 'permis' : 'non permis'}`
    }

    return `${permissionName}: ${newAllowed ? 'permis' : 'non permis'}`
  }

  const oldRole = String(oldData.role || '')
  const newRole = String(newData.role || '')

  const oldIsActive = oldData.is_active
  const newIsActive = newData.is_active

  const oldPermissions = (oldData.permissions as Record<string, unknown> | undefined) || {}
  const newPermissions = (newData.permissions as Record<string, unknown> | undefined) || {}

  const deltas: string[] = []

  if (oldRole !== newRole) {
    deltas.push(`role: ${oldRole || '-'} -> ${newRole || '-'}`)
  }

  if (oldIsActive !== newIsActive) {
    deltas.push(`statut: ${oldIsActive === true ? 'actif' : 'inactif'} -> ${newIsActive === true ? 'actif' : 'inactif'}`)
  }

  const permissionKeys = ['recouvrement', 'rapports', 'echeances'] as const
  permissionKeys.forEach((key) => {
    if (oldPermissions[key] !== newPermissions[key]) {
      deltas.push(`${key}: ${oldPermissions[key] === true ? 'permis' : 'non permis'} -> ${newPermissions[key] === true ? 'permis' : 'non permis'}`)
    }
  })

  if (deltas.length === 0) {
    return 'Mise à jour effectuée sans delta détecté.'
  }

  return deltas.join(' | ')
}

export default function AuditLogsView() {
  const PAGE_SIZE = 100
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('TOUTES')
  const [periodFilter, setPeriodFilter] = useState<'7J' | '30J' | '90J' | 'TOUT'>('30J')
  const [referenceTime, setReferenceTime] = useState(() => Date.now())
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const getActionFilterLabel = (action: string) => {
    const labels: Record<string, string> = {
      USER_ROLE_UPDATED: 'Rôle utilisateur modifié',
      USER_STATUS_UPDATED: 'Statut utilisateur modifié',
      USER_PERMISSION_RECOUVREMENT_UPDATED: 'Permission recouvrement modifiée',
      USER_PERMISSION_RAPPORTS_UPDATED: 'Permission rapports modifiée',
      USER_PERMISSION_ECHEANCES_UPDATED: 'Permission échéances modifiée',
      USER_ACCESS_UPDATED: 'Accès utilisateur modifié',
      INSERT: 'Insertion',
      UPDATE: 'Mise à jour',
      DELETE: 'Suppression',
    }

    return labels[action] || action
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      throw new Error('Session invalide. Reconnectez-vous.')
    }

    const response = await fetch('/api/admin/audit-logs', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Impossible de charger les journaux.')
    }

    return {
      auditLogs: result.auditLogs || [],
      activityLogs: result.activityLogs || [],
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadLogs = async () => {
      setLoading(true)
      setError('')

      try {
        const nextLogs = await fetchLogs()
        if (!isMounted) {
          return
        }

        setAuditLogs(nextLogs.auditLogs)
        setActivityLogs(nextLogs.activityLogs)
        setReferenceTime(Date.now())
      } catch (caughtError) {
        if (!isMounted) {
          return
        }

        const message = caughtError instanceof Error ? caughtError.message : 'Impossible de charger les journaux.'
        setError(message)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadLogs()

    return () => {
      isMounted = false
    }
  }, [fetchLogs])

  const handleRefresh = async () => {
    setLoading(true)
    setError('')

    try {
      const nextLogs = await fetchLogs()
      setAuditLogs(nextLogs.auditLogs)
      setActivityLogs(nextLogs.activityLogs)
      setReferenceTime(Date.now())
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Impossible de charger les journaux.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const availableActionTypes = useMemo(() => {
    const unique = Array.from(new Set(auditLogs.map((row) => row.action_type).filter(Boolean)))
    return unique
      .filter((action) => !ACCESS_ACTION_TYPES.has(action))
      .sort((a, b) => a.localeCompare(b, 'fr'))
  }, [auditLogs])

  const filteredAuditLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    const periodThreshold = (() => {
      if (periodFilter === '7J') return referenceTime - 7 * 24 * 60 * 60 * 1000
      if (periodFilter === '30J') return referenceTime - 30 * 24 * 60 * 60 * 1000
      if (periodFilter === '90J') return referenceTime - 90 * 24 * 60 * 60 * 1000
      return 0
    })()

    return auditLogs.filter((row) => {
      const createdAt = new Date(row.created_at).getTime()
      if (periodThreshold > 0 && (!createdAt || Number.isNaN(createdAt) || createdAt < periodThreshold)) {
        return false
      }

      if (actionFilter !== 'TOUTES') {
        if (actionFilter === 'USER_ACCESS_UPDATED') {
          if (!ACCESS_ACTION_TYPES.has(row.action_type)) {
            return false
          }
        } else if (row.action_type !== actionFilter) {
          return false
        }
      }

      if (!keyword) {
        return true
      }

      const haystack = [
        row.action_type,
        row.table_name,
        row.record_id || '',
        row.performer_id || '',
        row.performer_email || '',
        JSON.stringify(row.old_data || {}),
        JSON.stringify(row.new_data || {}),
      ].join(' ').toLowerCase()

      return haystack.includes(keyword)
    })
  }, [actionFilter, auditLogs, periodFilter, referenceTime, search])

  const totalPages = Math.max(1, Math.ceil(filteredAuditLogs.length / PAGE_SIZE))

  const paginatedAuditLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    return filteredAuditLogs.slice(start, end)
  }, [currentPage, filteredAuditLogs])

  useEffect(() => {
    setCurrentPage(1)
    setExpandedRowId(null)
  }, [actionFilter, periodFilter, search])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const resetFilters = () => {
    setSearch('')
    setActionFilter('TOUTES')
    setPeriodFilter('30J')
    setReferenceTime(Date.now())
  }

  const hasFilters = search.trim() !== '' || actionFilter !== 'TOUTES' || periodFilter !== '30J'

  const periodLabel = useMemo(() => {
    if (periodFilter === '7J') return '7 derniers jours'
    if (periodFilter === '30J') return '30 derniers jours'
    if (periodFilter === '90J') return '90 derniers jours'
    return 'Tout l’historique'
  }, [periodFilter])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Traçabilité</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900">
              <ListChecks size={24} className="text-blue-900" />
              Journal d’audits
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Suivi des modifications sensibles et journal d’activité administratif.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw size={16} />
            Actualiser
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Journaux d&apos;audit</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{auditLogs.length}</p>
          </div>
          <div className="rounded-2xl bg-blue-50 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-blue-700">Journaux d&apos;activité</p>
            <p className="mt-1 text-2xl font-black text-blue-900">{activityLogs.length}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-emerald-700">Filtrés</p>
            <p className="mt-1 text-2xl font-black text-emerald-900">{filteredAuditLogs.length}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value as typeof periodFilter)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 outline-none focus:border-blue-400"
          >
            <option value="7J">7 derniers jours</option>
            <option value="30J">30 derniers jours</option>
            <option value="90J">90 derniers jours</option>
            <option value="TOUT">Tout l’historique</option>
          </select>

          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 outline-none focus:border-blue-400"
          >
            <option value="TOUTES">Toutes les actions</option>
            <option value="USER_ACCESS_UPDATED">Accès utilisateur modifié</option>
            {availableActionTypes.map((action) => (
              <option key={action} value={action}>{getActionFilterLabel(action)}</option>
            ))}
          </select>

          <input
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 outline-none focus:border-blue-400"
            placeholder="Recherche texte..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">Période active: {periodLabel}</p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600">
            Chargement des journaux...
          </div>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">Acteur</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.12em] text-slate-500">Voir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedAuditLogs.map((row) => {
                    const isExpanded = expandedRowId === row.id

                    return (
                      <Fragment key={row.id}>
                        <tr key={row.id}>
                          <td className="px-4 py-4 align-top text-xs font-semibold text-slate-700">{formatDate(row.created_at)}</td>
                          <td className="px-4 py-4 align-top text-xs text-slate-700">
                            <p className="font-semibold text-slate-900">{row.performer_email || '-'}</p>
                            <p className="mt-1 text-[10px] text-slate-500">ID: {row.performer_id || '-'}</p>
                          </td>
                          <td className="px-4 py-4 align-top text-right">
                            <button
                              type="button"
                              onClick={() => setExpandedRowId((prev) => (prev === row.id ? null : row.id))}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              aria-label={isExpanded ? 'Masquer les détails' : 'Voir les détails'}
                              title={isExpanded ? 'Masquer les détails' : 'Voir les détails'}
                            >
                              {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${row.id}-details`} className="bg-slate-50/80">
                            <td colSpan={3} className="px-4 pb-4 pt-1">
                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Action</p>
                                  <p className="mt-1 text-xs font-semibold text-slate-900">{getActionFilterLabel(row.action_type)}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cible</p>
                                  <p className="mt-1 text-xs font-semibold text-slate-900">{row.target_email || row.record_id || '-'}</p>
                                  {row.target_email && row.record_id && (
                                    <p className="mt-1 text-[10px] text-slate-500">ID: {row.record_id}</p>
                                  )}
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Détails</p>
                                  <p className="mt-1 text-xs text-slate-700">{summarizeAccessChanges(row.old_data, row.new_data)}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}

                  {filteredAuditLogs.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm font-medium text-slate-500" colSpan={3}>
                        Aucun log d’audit trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Page {currentPage} / {totalPages} • {PAGE_SIZE} lignes par page
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
