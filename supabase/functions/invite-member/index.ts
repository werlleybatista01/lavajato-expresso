import { createClient } from 'npm:@supabase/supabase-js@2.55.0'

const allowedOrigins = new Set([
  'https://werlleybatista01.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])
const roles = new Set(['admin', 'operator', 'viewer'])

function headers(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://werlleybatista01.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  }
}
const respond = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headers(req) })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: headers(req) })
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)
  try {
    const authorization = req.headers.get('Authorization')
    if (!authorization) return respond(req, { error: 'authentication_required' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } })
    const token = authorization.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: authError } = await caller.auth.getUser(token)
    if (authError || !user) return respond(req, { error: 'invalid_session' }, 401)

    const { email, displayName, role, organizationId } = await req.json()
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof displayName !== 'string' || displayName.trim().length < 2 || !roles.has(role)) {
      return respond(req, { error: 'invalid_payload' }, 400)
    }
    const { data: membership } = await caller.from('memberships').select('role').eq('organization_id', organizationId).eq('user_id', user.id).eq('active', true).maybeSingle()
    if (!membership || !['owner', 'admin'].includes(membership.role)) return respond(req, { error: 'permission_denied' }, 403)

    const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } })
    const redirectTo = 'https://werlleybatista01.github.io/lavajato-expresso/'
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), { redirectTo })
    if (inviteError || !invited.user) return respond(req, { error: inviteError?.message ?? 'invite_failed' }, 400)
    const { error: memberError } = await admin.from('memberships').upsert({ organization_id: organizationId, user_id: invited.user.id, role, display_name: displayName.trim(), active: true })
    if (memberError) return respond(req, { error: memberError.message }, 400)
    return respond(req, { invited: true, userId: invited.user.id }, 201)
  } catch (error) {
    return respond(req, { error: error instanceof Error ? error.message : 'unexpected_error' }, 500)
  }
})
