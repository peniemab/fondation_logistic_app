'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MoreVertical, RefreshCcw, Settings2, X } from 'lucide-react'

type UserItem = {
  id: string
  email: string
  role: 'admin' | 'agent' | 'lecture_seule'
  is_active: boolean
  permissions: {
    recouvrement: boolean
    rapports: boolean
    echeances: boolean
  }
  created_at: string | null
  last_sign_in_at: string | null
}

type PermissionKey = keyof UserItem['permissions']

const permissionLabels: Array<{ key: PermissionKey; label: string }> = [
  { key: 'recouvrement', label: 'Recouvrement' },
  { key: 'rapports', label: 'Rapports' },
  { key: 'echeances', label: 'Échéances' },
]

const roleOptions: Array<{ value: UserItem['role']; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
  { value: 'lecture_seule', label: 'Lecture seule' },
]

function formatDate(input: string | null) {
  if (!input) {
    return 'Jamais'
  }

  return new Date(input).toLocaleString('fr-FR')
}

export default function ParametresView() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [detailUser, setDetailUser] = useState<UserItem | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setError('Session invalide. Reconnectez-vous.')
      setLoading(false)
      return
    }

    const response = await fetch('/api/admin/users', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result = await response.json()

    if (!response.ok) {
      setError(result.error || 'Impossible de charger les utilisateurs.')
      setLoading(false)
      return
    }

    setUsers(result.users || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) {
      return users
    }

    return users.filter((user) => {
      return (
        user.email.toLowerCase().includes(keyword)
        || user.role.toLowerCase().includes(keyword)
        || user.id.toLowerCase().includes(keyword)
      )
    })
  }, [search, users])

  const updateUser = async (userId: string, payload: Partial<Pick<UserItem, 'role' | 'is_active' | 'permissions'>>) => {
    setBusyUserId(userId)
    setError('')

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setError('Session invalide. Reconnectez-vous.')
      setBusyUserId(null)
      return
    }

    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId,
        ...payload,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      setError(result.error || 'Mise à jour refusée.')
      setBusyUserId(null)
      return
    }

    const applyServerUpdate = (user: UserItem): UserItem => ({
      ...user,
      role: result.user?.role || user.role,
      is_active: typeof result.user?.is_active === 'boolean' ? result.user.is_active : user.is_active,
      permissions: {
        recouvrement: typeof result.user?.permissions?.recouvrement === 'boolean' ? result.user.permissions.recouvrement : user.permissions.recouvrement,
        rapports: typeof result.user?.permissions?.rapports === 'boolean' ? result.user.permissions.rapports : user.permissions.rapports,
        echeances: typeof result.user?.permissions?.echeances === 'boolean' ? result.user.permissions.echeances : user.permissions.echeances,
      },
    })

    setUsers((previous) => previous.map((user) => {
      if (user.id !== userId) {
        return user
      }

      return applyServerUpdate(user)
    }))

    setDetailUser((previous) => {
      if (!previous || previous.id !== userId) {
        return previous
      }

      return applyServerUpdate(previous)
    })

    setBusyUserId(null)
  }

  const togglePermission = (user: UserItem, permission: PermissionKey) => {
    updateUser(user.id, {
      permissions: {
        ...user.permissions,
        [permission]: !user.permissions[permission],
      },
    })
  }

  const closeDetailUser = () => {
    setDetailUser(null)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Administration</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900">
              <Settings2 size={24} className="text-blue-900" />
              Paramètres utilisateurs
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Gérez les rôles et activez/désactivez les accès à l’application.
            </p>
          </div>

          <button
            onClick={fetchUsers}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw size={16} />
            Actualiser
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500">Utilisateurs</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{users.length}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-emerald-700">Actifs</p>
            <p className="mt-1 text-2xl font-black text-emerald-800">{users.filter((user) => user.is_active).length}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-amber-700">Inactifs</p>
            <p className="mt-1 text-2xl font-black text-amber-800">{users.filter((user) => !user.is_active).length}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 sm:max-w-md"
            placeholder="Rechercher par email, rôle ou id..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="text-xs font-semibold text-slate-500">
            {filteredUsers.length} résultat(s)
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600">
            Chargement des utilisateurs...
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-900">Utilisateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredUsers.map((user) => {
                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-bold text-slate-900">{user.email || 'Sans email'}</p>
                          <button
                            type="button"
                            onClick={() => setDetailUser(user)}
                            className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-600 transition-colors hover:bg-slate-100"
                            aria-label={`Voir les détails de ${user.email || 'cet utilisateur'}`}
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm font-medium text-slate-500" colSpan={1}>
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailUser && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/55"
            onClick={closeDetailUser}
            aria-label="Fermer les détails"
          />

          <div className="absolute inset-x-0 bottom-0 w-full max-h-[90vh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:p-6">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">Détail utilisateur</p>
                <h3 className="mt-1 break-all text-lg font-black text-slate-900">{detailUser.email || 'Sans email'}</h3>
              </div>
              <button
                type="button"
                onClick={closeDetailUser}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">Rôle</p>
                <select
                  value={detailUser.role}
                  disabled={busyUserId === detailUser.id}
                  onChange={(event) => updateUser(detailUser.id, { role: event.target.value as UserItem['role'] })}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">Statut</p>
                <div className="mt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => updateUser(detailUser.id, { is_active: true })}
                    disabled={busyUserId === detailUser.id}
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Activer cet utilisateur"
                  >
                    <span className={`grid h-4 w-4 place-items-center rounded-full border ${detailUser.is_active ? 'border-emerald-600' : 'border-slate-400'}`}>
                      <span className={`h-2 w-2 rounded-full ${detailUser.is_active ? 'bg-emerald-600' : 'bg-transparent'}`} />
                    </span>
                    Activer
                  </button>

                  <button
                    type="button"
                    onClick={() => updateUser(detailUser.id, { is_active: false })}
                    disabled={busyUserId === detailUser.id}
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Désactiver cet utilisateur"
                  >
                    <span className={`grid h-4 w-4 place-items-center rounded-full border ${!detailUser.is_active ? 'border-amber-600' : 'border-slate-400'}`}>
                      <span className={`h-2 w-2 rounded-full ${!detailUser.is_active ? 'bg-amber-600' : 'bg-transparent'}`} />
                    </span>
                    Désactiver
                  </button>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">ID utilisateur</p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-800">{detailUser.id}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">Créé le</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{formatDate(detailUser.created_at)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">Dernière connexion</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{formatDate(detailUser.last_sign_in_at)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-900">Permissions sensibles</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {permissionLabels.map((permission) => {
                  const enabled = detailUser.permissions[permission.key]

                  return (
                    <div key={permission.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-black text-slate-800">{permission.label}</p>

                      <div className="mt-2 space-y-2">
                        <button
                          type="button"
                          onClick={() => updateUser(detailUser.id, { permissions: { ...detailUser.permissions, [permission.key]: true } })}
                          disabled={busyUserId === detailUser.id || detailUser.role === 'admin'}
                          className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Mettre ${permission.label} en permis`}
                        >
                          <span className={`grid h-4 w-4 place-items-center rounded-full border ${enabled ? 'border-emerald-600' : 'border-slate-400'}`}>
                            <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-600' : 'bg-transparent'}`} />
                          </span>
                          Permis
                        </button>

                        <button
                          type="button"
                          onClick={() => updateUser(detailUser.id, { permissions: { ...detailUser.permissions, [permission.key]: false } })}
                          disabled={busyUserId === detailUser.id || detailUser.role === 'admin'}
                          className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Mettre ${permission.label} en non permis`}
                        >
                          <span className={`grid h-4 w-4 place-items-center rounded-full border ${!enabled ? 'border-amber-600' : 'border-slate-400'}`}>
                            <span className={`h-2 w-2 rounded-full ${!enabled ? 'bg-amber-600' : 'bg-transparent'}`} />
                          </span>
                          Non permis
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {detailUser.role === 'admin' && (
                <p className="mt-2 text-xs font-semibold text-slate-500">Admin: accès total par défaut.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
