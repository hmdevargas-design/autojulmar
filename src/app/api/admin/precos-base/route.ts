import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const schemaPut = z.object({
  tenantId:    z.string().min(1),
  campo1Valor: z.string().min(1),
  campo2Valor: z.string().min(1),
  preco:       z.coerce.number().min(0),
})

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ erro: 'tenantId obrigatório' }, { status: 400 })

  const supabase = criarClienteAdmin()
  const { data, error } = await supabase
    .from('tabela_preco_base')
    .select('campo1_valor, campo2_valor, preco')
    .eq('tenant_id', tenantId)
    .order('campo1_valor')

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const input = schemaPut.parse(body)
    const supabase = criarClienteAdmin()

    const { error } = await supabase
      .from('tabela_preco_base')
      .upsert({
        tenant_id:    input.tenantId,
        campo1_valor: input.campo1Valor,
        campo2_valor: input.campo2Valor,
        preco:        input.preco,
      }, { onConflict: 'tenant_id,campo1_valor,campo2_valor' })

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
