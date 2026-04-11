'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCcw, Settings2, Shield, UserCheck, UserX } from 'lucide-react'

type UserItem = {
  id: string
  email: string
  role: 'admin' | 'agent' | 'lecture_seule'
  is_active: boolean
  created_at: string | null
  last_sign_in_at: string | null
}

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

  const updateUser = async (userId: string, payload: Partial<Pick<UserItem, 'role' | 'is_active'>>) => {
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

    setUsers((previous) => previous.map((user) => {
      if (user.id !== userId) {
        return user
      }

      return {
        ...user,
        role: result.user?.role || user.role,
        is_active: typeof result.user?.is_active === 'boolean' ? result.user.is_active : user.is_active,
      }
    }))

    setBusyUserId(null)
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
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">Dernière connexion</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredUsers.map((user) => {
                  const rowBusy = busyUserId === user.id
                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-4 align-top">
                        <p className="text-sm font-bold text-slate-900">{user.email || 'Sans email'}</p>
                        <p className="mt-1 text-xs text-slate-500">ID: {user.id}</p>
                        <p className="mt-1 text-xs text-slate-500">Créé le: {formatDate(user.created_at)}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <select
                          value={user.role}
                          disabled={rowBusy}
                          onChange={(event) => updateUser(user.id, { role: event.target.value as UserItem['role'] })}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800"
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                          user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {user.is_active ? <UserCheck size={14} /> : <UserX size={14} />}
                          {user.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-sm font-medium text-slate-700">
                        {formatDate(user.last_sign_in_at)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <button
                          onClick={() => updateUser(user.id, { is_active: !user.is_active })}
                          disabled={rowBusy}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.08em] ${
                            user.is_active
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <Shield size={14} />
                          {user.is_active ? 'Désactiver' : 'Activer'}
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm font-medium text-slate-500" colSpan={5}>
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
