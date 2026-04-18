import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { limparCacheConfig } from '@/lib/tenant/config'
import { z } from 'zod'

const schemaPut = z.object({
  id:       z.string().min(1),
  tenantId: z.string().min(1),
  nome:     z.string().min(1),
  cor:      z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ erro: 'tenantId obrigatório' }, { status: 400 })

  const supabase = criarClienteAdmin()
  const { data, error } = await supabase
    .from('estados_fluxo')
    .select('id, nome, cor, ordem, is_final')
    .eq('tenant_id', tenantId)
    .order('ordem')

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const input = schemaPut.parse(body)
    const supabase = criarClienteAdmin()

    const { error } = await supabase
      .from('estados_fluxo')
      .update({ nome: input.nome, cor: input.cor })
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
