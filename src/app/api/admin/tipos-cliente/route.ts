import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { limparCacheConfig } from '@/lib/tenant/config'
import { z } from 'zod'

const schemaPut = z.object({
  id:          z.string().min(1),
  tenantId:    z.string().min(1),
  descontoPct: z.coerce.number().min(0).max(100),
})

const schemaPost = z.object({
  tenantId:    z.string().min(1),
  nome:        z.string().min(1).max(50),
  descontoPct: z.coerce.number().min(0).max(100).default(0),
})

const schemaDelete = z.object({
  id:       z.string().min(1),
  tenantId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ erro: 'tenantId obrigatório' }, { status: 400 })

  const supabase = criarClienteAdmin()
  const { data, error } = await supabase
    .from('tipos_cliente')
    .select('id, nome, desconto_pct, usa_tabela_propria')
    .eq('tenant_id', tenantId)
    .order('ordem')

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  try {
    const body  = await request.json()
    const input = schemaPost.parse(body)
    const supabase = criarClienteAdmin()

    // Determina a próxima ordem
    const { data: ultimo } = await supabase
      .from('tipos_cliente')
      .select('ordem')
      .eq('tenant_id', input.tenantId)
      .order('ordem', { ascending: false })
      .limit(1)
      .single()

    const novaOrdem = ((ultimo?.ordem as number | null) ?? 0) + 1

    const { data, error } = await supabase
      .from('tipos_cliente')
      .insert({
        tenant_id:   input.tenantId,
        nome:        input.nome.toUpperCase(),
        desconto_pct: input.descontoPct,
        ordem:       novaOrdem,
      })
      .select('id, nome, desconto_pct, usa_tabela_propria')
      .single()

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    limparCacheConfig(input.tenantId)
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body  = await request.json()
    const input = schemaPut.parse(body)
    const supabase = criarClienteAdmin()

    const { error } = await supabase
      .from('tipos_cliente')
      .update({ desconto_pct: input.descontoPct })
      .eq('id', input.id)
      .eq('tenant_id', input.tenantId)

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    limparCacheConfig(input.tenantId)
    return NextResponse.json({ ok: true })
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

    // Não apaga se tiver clientes associados
    const { count } = await supabase
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .eq('tipo_cliente_id', input.id)

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { erro: `Não é possível apagar — ${count} cliente(s) usam este tipo` },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('tipos_cliente')
      .delete()
      .eq('id', input.id)
      .eq('tenant_id', input.tenantId)

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    limparCacheConfig(input.tenantId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
