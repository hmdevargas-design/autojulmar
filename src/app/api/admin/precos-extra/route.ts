import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const schemaPost = z.object({
  tenantId:       z.string().min(1),
  campoNome:      z.string().min(1),
  opcaoValor:     z.string().min(1),
  precoAdicional: z.coerce.number().min(0),
})

const schemaDelete = z.object({
  tenantId:   z.string().min(1),
  campoNome:  z.string().min(1),
  opcaoValor: z.string().min(1),
})

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ erro: 'tenantId obrigatório' }, { status: 400 })

  const supabase = criarClienteAdmin()
  const { data, error } = await supabase
    .from('tabela_preco_extra')
    .select('id, campo_nome, opcao_valor, preco_adicional')
    .eq('tenant_id', tenantId)
    .order('campo_nome')

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = schemaPost.parse(body)
    const supabase = criarClienteAdmin()

    const { error } = await supabase
      .from('tabela_preco_extra')
      .upsert({
        tenant_id:       input.tenantId,
        campo_nome:      input.campoNome,
        opcao_valor:     input.opcaoValor,
        preco_adicional: input.precoAdicional,
      }, { onConflict: 'tenant_id,campo_nome,opcao_valor' })

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const input = schemaDelete.parse(body)
    const supabase = criarClienteAdmin()

    const { error } = await supabase
      .from('tabela_preco_extra')
      .delete()
      .eq('tenant_id', input.tenantId)
      .eq('campo_nome', input.campoNome)
      .eq('opcao_valor', input.opcaoValor)

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 })
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
