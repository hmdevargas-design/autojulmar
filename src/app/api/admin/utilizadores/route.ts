import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const schemaPost = z.object({
  tenantId: z.string().min(1),
  email:    z.string().email(),
  password: z.string().min(6),
  nome:     z.string().min(1),
  role:     z.enum(['admin', 'operador']).default('operador'),
})

const schemaDelete = z.object({
  userId:   z.string().min(1),
  tenantId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ erro: 'tenantId obrigatório' }, { status: 400 })

  const supabase = criarClienteAdmin()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, nome, role, criado_em')
    .eq('tenant_id', tenantId)
    .order('criado_em')

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

  // Obtém emails via admin API e combina com profiles
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailPorId = new Map(users.map(u => [u.id, u.email ?? '']))

  const utilizadores = (profiles ?? []).map(p => ({
    id:       p.id,
    nome:     p.nome,
    role:     p.role,
    criadoEm: p.criado_em,
    email:    emailPorId.get(p.id) ?? '—',
  }))

  return NextResponse.json(utilizadores)
}

export async function POST(request: NextRequest) {
  try {
    const body  = await request.json()
    const input = schemaPost.parse(body)
    const supabase = criarClienteAdmin()

    // Cria utilizador no Supabase Auth (sem confirmação de email)
    const { data: { user }, error: erroCriar } = await supabase.auth.admin.createUser({
      email:         input.email,
      password:      input.password,
      email_confirm: true,
      user_metadata: { nome: input.nome, tenant_id: input.tenantId },
    })

    if (erroCriar || !user) {
      return NextResponse.json(
        { erro: erroCriar?.message ?? 'Erro ao criar utilizador' },
        { status: 500 }
      )
    }

    // O trigger handle_new_user cria o profile com role='operador'
    // Se for admin, actualiza o role
    if (input.role === 'admin') {
      await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)
    }

    return NextResponse.json({ id: user.id, email: user.email, nome: input.nome, role: input.role })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body  = await request.json()
    const input = schemaDelete.parse(body)
    const supabase = criarClienteAdmin()

    // Verifica que o utilizador pertence a este tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', input.userId)
      .eq('tenant_id', input.tenantId)
      .single()

    if (!profile) return NextResponse.json({ erro: 'Utilizador não encontrado' }, { status: 404 })

    // Remove o utilizador do Auth (o profile é apagado em cascata)
    const { error } = await supabase.auth.admin.deleteUser(input.userId)
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
