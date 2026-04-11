import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type AuthUserLike = {
  id: string
  email?: string | null
  user_metadata?: { role?: string }
  app_metadata?: { role?: string }
}

type AuditLogRow = {
  id: string
  performer_id: string | null
  action_type: string
  table_name: string
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

function getEnvOrThrow(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function getRole(user: AuthUserLike) {
  const fromUserMeta = String(user.user_metadata?.role || '').toLowerCase()
  const fromAppMeta = String(user.app_metadata?.role || '').toLowerCase()
  return fromUserMeta || fromAppMeta
}

async function getRequesterFromBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!token) {
    return { error: NextResponse.json({ error: 'Missing bearer token' }, { status: 401 }) }
  }

  const anonClient = createClient(
    getEnvOrThrow('NEXT_PUBLIC_SUPABASE_URL'),
    getEnvOrThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )

  const { data, error } = await anonClient.auth.getUser(token)
  if (error || !data.user) {
    return { error: NextResponse.json({ error: 'Unauthorized user' }, { status: 401 }) }
  }

  const requester = data.user as AuthUserLike
  if (getRole(requester) !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin role required' }, { status: 403 }) }
  }

  return { requester }
}

function getAdminClient() {
  return createClient(
    getEnvOrThrow('NEXT_PUBLIC_SUPABASE_URL'),
    getEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY')
  )
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await getRequesterFromBearerToken(request)
    if ('error' in authResult) {
      return authResult.error
    }

    const adminClient = getAdminClient()

    const [auditResult, activityResult] = await Promise.all([
      adminClient
        .from('audit_logs')
        .select('id, performer_id, action_type, table_name, record_id, old_data, new_data, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      adminClient
        .from('logs_activite')
        .select('id, created_at, utilisateur, action, details, num_fiche')
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    if (auditResult.error) {
      return NextResponse.json({ error: auditResult.error.message }, { status: 500 })
    }

    if (activityResult.error) {
      return NextResponse.json({ error: activityResult.error.message }, { status: 500 })
    }

    const rawAuditLogs = (auditResult.data || []) as AuditLogRow[]
    const performerIds = new Set(rawAuditLogs.map((row) => row.performer_id).filter(Boolean) as string[])
    const targetIds = new Set(rawAuditLogs.map((row) => row.record_id).filter(Boolean) as string[])

    const userEmailMap = new Map<string, string>()
    if (performerIds.size > 0 || targetIds.size > 0) {
      const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })

      if (!usersError) {
        for (const user of usersData.users) {
          if (performerIds.has(user.id) || targetIds.has(user.id)) {
            userEmailMap.set(user.id, user.email || '')
          }
        }
      }
    }

    const auditLogs = rawAuditLogs.map((row) => ({
      ...row,
      performer_email: row.performer_id ? (userEmailMap.get(row.performer_id) || null) : null,
      target_email: row.record_id ? (userEmailMap.get(row.record_id) || null) : null,
    }))

    return NextResponse.json({
      auditLogs,
      activityLogs: activityResult.data || [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
