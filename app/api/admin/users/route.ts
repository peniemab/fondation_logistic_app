import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type AuthUserMeta = {
  role?: string
  is_active?: boolean
}

type AuthUserLike = {
  id: string
  email?: string | null
  user_metadata?: AuthUserMeta
  app_metadata?: { role?: string }
  last_sign_in_at?: string | null
  created_at?: string
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

function isActive(user: AuthUserLike) {
  return user.user_metadata?.is_active !== false
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
  const requesterRole = getRole(requester)

  if (requesterRole !== 'admin') {
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
    const users: AuthUserLike[] = []
    let page = 1
    const perPage = 200

    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const pageUsers = (data?.users || []) as AuthUserLike[]
      users.push(...pageUsers)

      if (pageUsers.length < perPage) {
        break
      }

      page += 1
    }

    const payload = users.map((user) => ({
      id: user.id,
      email: user.email || '',
      role: getRole(user) || 'agent',
      is_active: isActive(user),
      created_at: user.created_at || null,
      last_sign_in_at: user.last_sign_in_at || null,
    }))

    return NextResponse.json({ users: payload })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await getRequesterFromBearerToken(request)
    if ('error' in authResult) {
      return authResult.error
    }

    const body = (await request.json()) as { userId?: string; role?: string; is_active?: boolean }
    const userId = String(body.userId || '').trim()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : undefined
    const isActiveValue = typeof body.is_active === 'boolean' ? body.is_active : undefined

    if (!role && typeof isActiveValue === 'undefined') {
      return NextResponse.json({ error: 'role or is_active must be provided' }, { status: 400 })
    }

    if (role && !['admin', 'agent', 'lecture_seule'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role value' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    const { data: existingData, error: existingError } = await adminClient.auth.admin.getUserById(userId)

    if (existingError || !existingData.user) {
      return NextResponse.json({ error: existingError?.message || 'User not found' }, { status: 404 })
    }

    const existingMeta = (existingData.user.user_metadata || {}) as AuthUserMeta
    const nextMeta: AuthUserMeta = {
      ...existingMeta,
    }

    if (role) {
      nextMeta.role = role
    }

    if (typeof isActiveValue === 'boolean') {
      nextMeta.is_active = isActiveValue
    }

    const { data: updatedData, error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: nextMeta,
    })

    if (updateError || !updatedData.user) {
      return NextResponse.json({ error: updateError?.message || 'Update failed' }, { status: 500 })
    }

    const user = updatedData.user as AuthUserLike
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email || '',
        role: getRole(user) || 'agent',
        is_active: isActive(user),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
